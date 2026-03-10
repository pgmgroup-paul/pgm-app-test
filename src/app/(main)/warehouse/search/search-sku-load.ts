"use server";

import { serverSupabase } from "@/lib/serverSupabase";

export interface SearchSkuState {
  ok: boolean | null;
  error?: string;
  productName?: string;
  productId?: string;
  sku?: string;
  skuVar?: string;
  rows?: {
    location_id: string;
    location_code: string;
    quantity_cases: number;
  }[];
}

export async function loadSearchBySku(_prev: SearchSkuState, formData: FormData): Promise<SearchSkuState> {
  const sku = (formData.get("sku") || "").toString().trim();
  const skuVar = (formData.get("sku_var") || "").toString().trim();

  if (!sku) {
    return { ok: false, error: "SKU is required" };
  }

  const supabase = serverSupabase;

  // Resolve product by sku / sku_var (same logic as Deduct), case-insensitive
  let productQuery = supabase.from("products").select("id, sku, sku_var, product_name").ilike("sku", sku);

  if (skuVar) {
    productQuery = productQuery.ilike("sku_var", skuVar);
  } else {
    productQuery = productQuery.is("sku_var", null);
  }

  const { data: product, error: prodError } = await productQuery.maybeSingle();

  if (prodError || !product) {
    console.error("Error looking up product for search", prodError);
    return { ok: false, error: "Product not found for that SKU / variant (case-insensitive lookup)" };
  }

  // Load all locations for this product
  const { data: rows, error: locError } = await supabase
    .from("inventory_location")
    .select("location_id, quantity_cases, locations ( code )")
    .eq("product_id", product.id);

  if (locError) {
    console.error("Error loading locations for search", locError);
    return { ok: false, error: "Error loading locations for this product" };
  }

  const normalized = (rows || []).map((r: any) => ({
    location_id: r.location_id as string,
    location_code: (r.locations?.code as string) || "",
    quantity_cases: Number(r.quantity_cases) || 0,
  }));

  return {
    ok: true,
    productName: (product.product_name as string) || sku,
    productId: product.id as string,
    sku,
    skuVar,
    rows: normalized,
  };
}
