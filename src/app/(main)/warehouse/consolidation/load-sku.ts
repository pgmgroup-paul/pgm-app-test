"use server";

import { serverSupabase } from "@/lib/serverSupabase";

export interface ConsolidationSkuLocationRow {
  location_id: string;
  location_code: string;
  quantity_cases: number;
  pallet_capacity_cartons: number;
  pallet_fill_percent: number;
}

export interface ConsolidationSkuState {
  ok: boolean | null;
  error?: string;
  productId?: string;
  productName?: string;
  sku?: string;
  skuVar?: string;
  cartonsPerPallet?: number;
  totalSmallLocations?: number;
  totalSmallCases?: number;
  totalUnusedPalletSpace?: number;
  rows?: ConsolidationSkuLocationRow[];
}

export async function loadConsolidationBySku(
  _prev: ConsolidationSkuState,
  formData: FormData,
): Promise<ConsolidationSkuState> {
  const rawSku = (formData.get("sku") || "").toString().trim();
  const rawSkuVar = (formData.get("sku_var") || "").toString().trim();

  if (!rawSku) {
    return { ok: false, error: "SKU is required" };
  }

  const supabase = serverSupabase;

  // Resolve product by sku / sku_var (case-insensitive), same pattern as other warehouse search flows
  let productQuery = supabase.from("products").select("id, sku, sku_var, product_name").ilike("sku", rawSku);

  if (rawSkuVar) {
    productQuery = productQuery.ilike("sku_var", rawSkuVar);
  } else {
    productQuery = productQuery.is("sku_var", null);
  }

  const { data: product, error: prodError } = await productQuery.maybeSingle();

  if (prodError || !product) {
    console.error("Error looking up product for consolidation (SKU)", prodError);
    return { ok: false, error: "Product not found for that SKU / variant (case-insensitive lookup)" };
  }

  const productId = product.id as string;
  const productName = (product.product_name as string) || rawSku;

  // Load pallet dimensions for this product (cartons_per_pallet)
  const { data: palletDims, error: dimsError } = await supabase
    .from("product_dimensions")
    .select("cartons_per_pallet")
    .eq("product_id", productId)
    .eq("kind", "pallet")
    .maybeSingle();

  if (dimsError) {
    console.error("Error loading pallet dimensions for consolidation (SKU)", dimsError);
    return { ok: false, error: "Error loading pallet dimensions for this product" };
  }

  const cartonsPerPallet = palletDims && typeof palletDims.cartons_per_pallet === "number"
    ? palletDims.cartons_per_pallet
    : Number(palletDims?.cartons_per_pallet || 0);

  if (!Number.isFinite(cartonsPerPallet) || cartonsPerPallet <= 0) {
    return {
      ok: false,
      error: "Pallet configuration not found for this product (kind = pallet)",
      productId,
      productName,
      sku: rawSku,
      skuVar: rawSkuVar || undefined,
    };
  }

  // Load all locations for this product where quantity_cases is between 0 and cartons_per_pallet
  const { data: rows, error: locError } = await supabase
    .from("inventory_location")
    .select("location_id, quantity_cases, locations ( code )")
    .eq("product_id", productId)
    .gt("quantity_cases", 0)
    .lt("quantity_cases", cartonsPerPallet);

  if (locError) {
    console.error("Error loading locations for consolidation (SKU)", locError);
    return { ok: false, error: "Error loading locations for this product" };
  }

  const normalized: ConsolidationSkuLocationRow[] = (rows || []).map((r: any) => {
    const qty = Number(r.quantity_cases) || 0;
    const fill = cartonsPerPallet > 0 ? qty / cartonsPerPallet : 0;

    return {
      location_id: r.location_id as string,
      location_code: (r.locations?.code as string) || "",
      quantity_cases: qty,
      pallet_capacity_cartons: cartonsPerPallet,
      pallet_fill_percent: fill,
    };
  });

  // Sort by smallest quantity first
  normalized.sort((a, b) => (a.quantity_cases || 0) - (b.quantity_cases || 0));

  const totalSmallLocations = normalized.length;
  const totalSmallCases = normalized.reduce((sum, row) => sum + (row.quantity_cases || 0), 0);
  const totalUnusedPalletSpace = totalSmallLocations * cartonsPerPallet - totalSmallCases;

  return {
    ok: true,
    productId,
    productName,
    sku: rawSku,
    skuVar: rawSkuVar || undefined,
    cartonsPerPallet,
    totalSmallLocations,
    totalSmallCases,
    totalUnusedPalletSpace,
    rows: normalized,
  };
}
