"use server";

import { serverSupabase } from "@/lib/serverSupabase";

export interface ConsolidationCandidateRow {
  product_id: string;
  sku: string;
  sku_var: string | null;
  product_name: string | null;
  cartonsPerPallet: number;
  smallLocationCount: number;
  totalSmallCases: number;
  totalUnusedPalletSpace: number;
  spacesSaved: number;
  priorityScore: number;
}

export interface ConsolidationCandidatesState {
  ok: boolean | null;
  error?: string;
  rows?: ConsolidationCandidateRow[];
}

export async function loadConsolidationCandidates(
  _prev: ConsolidationCandidatesState,
  _formData: FormData,
): Promise<ConsolidationCandidatesState> {
  const supabase = serverSupabase;

  // Load all products that have pallet dimensions
  const { data: palletDims, error: dimsError } = await supabase
    .from("product_dimensions")
    .select("product_id, cartons_per_pallet")
    .eq("kind", "pallet");

  if (dimsError) {
    console.error("Error loading pallet dimensions for consolidation candidates", dimsError);
    return { ok: false, error: "Error loading pallet dimensions" };
  }

  const palletsByProduct = new Map<string, number>();
  for (const d of palletDims || []) {
    const pid = (d as any).product_id as string;
    const cartonsPerPallet = Number((d as any).cartons_per_pallet) || 0;
    if (!pid || cartonsPerPallet <= 0) continue;
    // If multiple rows exist, keep the latest non-zero value
    palletsByProduct.set(pid, cartonsPerPallet);
  }

  const productIds = Array.from(palletsByProduct.keys());

  if (productIds.length === 0) {
    return { ok: true, rows: [] };
  }

  // Load inventory_location for all these products
  const { data: invRows, error: invError } = await supabase
    .from("inventory_location")
    .select("product_id, quantity_cases")
    .in("product_id", productIds);

  if (invError) {
    console.error("Error loading inventory_location for consolidation candidates", invError);
    return { ok: false, error: "Error loading inventory locations" };
  }

  // Aggregate small locations per product (0 < qty < cartonsPerPallet)
  interface Agg {
    smallLocationCount: number;
    totalSmallCases: number;
  }

  const aggByProduct = new Map<string, Agg>();

  for (const row of invRows || []) {
    const pid = (row as any).product_id as string;
    const qty = Number((row as any).quantity_cases) || 0;
    const cartonsPerPallet = palletsByProduct.get(pid) || 0;
    if (!pid || cartonsPerPallet <= 0) continue;

    if (qty > 0 && qty < cartonsPerPallet) {
      const agg = aggByProduct.get(pid) || { smallLocationCount: 0, totalSmallCases: 0 };
      agg.smallLocationCount += 1;
      agg.totalSmallCases += qty;
      aggByProduct.set(pid, agg);
    }
  }

  // Filter to products with 2+ small locations
  const candidateProductIds = Array.from(aggByProduct.entries())
    .filter(([_, agg]) => agg.smallLocationCount >= 2)
    .map(([pid]) => pid);

  if (candidateProductIds.length === 0) {
    return { ok: true, rows: [] };
  }

  // Load basic product info for candidates
  const { data: products, error: prodError } = await supabase
    .from("products")
    .select("id, sku, sku_var, product_name")
    .in("id", candidateProductIds);

  if (prodError) {
    console.error("Error loading products for consolidation candidates", prodError);
    return { ok: false, error: "Error loading products for consolidation candidates" };
  }

  const rows: ConsolidationCandidateRow[] = (products || []).map((p: any) => {
    const pid = p.id as string;
    const cartonsPerPallet = palletsByProduct.get(pid) || 0;
    const agg = aggByProduct.get(pid) || { smallLocationCount: 0, totalSmallCases: 0 };

    const totalUnusedPalletSpace = agg.smallLocationCount * cartonsPerPallet - agg.totalSmallCases;
    const palletsNeeded = cartonsPerPallet > 0 ? Math.ceil(agg.totalSmallCases / cartonsPerPallet) : 0;
    const spacesSaved = Math.max(agg.smallLocationCount - palletsNeeded, 0);
    const priorityScore = (spacesSaved * 100) * totalUnusedPalletSpace * agg.smallLocationCount;

    return {
      product_id: pid,
      sku: (p.sku as string) || "",
      sku_var: (p.sku_var as string) || null,
      product_name: (p.product_name as string) || null,
      cartonsPerPallet,
      smallLocationCount: agg.smallLocationCount,
      totalSmallCases: agg.totalSmallCases,
      totalUnusedPalletSpace,
      spacesSaved,
      priorityScore,
    } satisfies ConsolidationCandidateRow;
  });

  // Sort by highest priorityScore first
  rows.sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    ok: true,
    rows,
  };
}
