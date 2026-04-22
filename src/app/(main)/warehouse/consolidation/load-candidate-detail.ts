"use server";

import { serverSupabase } from "@/lib/serverSupabase";

export interface ConsolidationCandidateDetailRow {
  location_id: string;
  location_code: string;
  quantity_cases: number;
  pallet_fill_percent: number;
}

export interface ConsolidationCandidateDetailState {
  ok: boolean | null;
  error?: string;
  productId?: string;
  cartonsPerPallet?: number;
  rows?: ConsolidationCandidateDetailRow[];
}

export async function loadConsolidationCandidateDetail(
  _prev: ConsolidationCandidateDetailState,
  formData: FormData,
): Promise<ConsolidationCandidateDetailState> {
  const productId = (formData.get("product_id") || "").toString().trim();

  if (!productId) {
    return { ok: false, error: "Missing product_id" };
  }

  const supabase = serverSupabase;

  // Load pallet configuration for this product
  const { data: palletDims, error: dimsError } = await supabase
    .from("product_dimensions")
    .select("cartons_per_pallet")
    .eq("product_id", productId)
    .eq("kind", "pallet")
    .maybeSingle();

  if (dimsError) {
    console.error("Error loading pallet dimensions for candidate detail", dimsError);
    return { ok: false, error: "Error loading pallet dimensions" };
  }

  const cartonsPerPallet =
    palletDims && typeof palletDims.cartons_per_pallet === "number"
      ? palletDims.cartons_per_pallet
      : Number(palletDims?.cartons_per_pallet || 0);

  if (!Number.isFinite(cartonsPerPallet) || cartonsPerPallet <= 0) {
    return {
      ok: false,
      error: "Pallet configuration not found for this product (kind = pallet)",
      productId,
    };
  }

  // Load small locations for this product
  const { data: rows, error: locError } = await supabase
    .from("inventory_location")
    .select("location_id, quantity_cases, locations ( code )")
    .eq("product_id", productId)
    .gt("quantity_cases", 0)
    .lt("quantity_cases", cartonsPerPallet);

  if (locError) {
    console.error("Error loading locations for candidate detail", locError);
    return { ok: false, error: "Error loading locations for this product" };
  }

  const detailRows: ConsolidationCandidateDetailRow[] = (rows || []).map((r: any) => {
    const qty = Number(r.quantity_cases) || 0;
    const fill = cartonsPerPallet > 0 ? qty / cartonsPerPallet : 0;

    return {
      location_id: r.location_id as string,
      location_code: (r.locations?.code as string) || "",
      quantity_cases: qty,
      pallet_fill_percent: fill,
    };
  });

  // Sort by smallest quantity first
  detailRows.sort((a, b) => (a.quantity_cases || 0) - (b.quantity_cases || 0));

  return {
    ok: true,
    productId,
    cartonsPerPallet,
    rows: detailRows,
  };
}
