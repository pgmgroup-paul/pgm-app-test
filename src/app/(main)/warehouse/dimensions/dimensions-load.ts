"use server";

import { serverSupabase } from "@/lib/serverSupabase";

export interface DimensionRecord {
  kind: string; // 'case' | 'pallet'
  length: number | null;
  width: number | null;
  height: number | null;
  weight: number | null;
  uom_length: string | null;
  uom_weight: string | null;
  units_per: number | null; // units per case or cases per pallet
  cartons_per_layer: number | null;
  number_of_layers: number | null;
  cartons_per_pallet: number | null;
}

export interface DimensionsState {
  ok: boolean | null;
  error?: string;
  productName?: string;
  productId?: string;
  sku?: string;
  skuVar?: string;
  caseDims?: DimensionRecord | null;
  palletDims?: DimensionRecord | null;
}

export async function loadDimensions(_prev: DimensionsState, formData: FormData): Promise<DimensionsState> {
  const sku = (formData.get("sku") || "").toString().trim();
  const skuVar = (formData.get("sku_var") || "").toString().trim();

  if (!sku) {
    return { ok: false, error: "SKU is required" };
  }

  const supabase = serverSupabase;

  // Resolve product by sku / sku_var (same pattern as other pages), case-insensitive
  let productQuery = supabase.from("products").select("id, sku, sku_var, product_name").ilike("sku", sku);

  if (skuVar) {
    productQuery = productQuery.ilike("sku_var", skuVar);
  } else {
    productQuery = productQuery.is("sku_var", null);
  }

  const { data: product, error: prodError } = await productQuery.maybeSingle();

  if (prodError || !product) {
    console.error("Error looking up product for dimensions", prodError);
    return { ok: false, error: "Product not found for that SKU / variant (case-insensitive lookup)" };
  }

  const { data: dims, error: dimsError } = await supabase
    .from("product_dimensions")
    .select(
      "kind, length, width, height, weight, uom_length, uom_weight, units_per, cartons_per_layer, number_of_layers, cartons_per_pallet",
    )
    .eq("product_id", product.id);

  if (dimsError) {
    console.error("Error loading dimensions for product", dimsError);
    return { ok: false, error: "Error loading dimensions for this product" };
  }

  const caseDims = (dims || []).find((d) => d.kind === "case") || null;
  const palletDims = (dims || []).find((d) => d.kind === "pallet") || null;

  return {
    ok: true,
    productName: (product.product_name as string) || sku,
    productId: product.id as string,
    sku,
    skuVar,
    caseDims: caseDims
      ? {
          kind: "case",
          length: caseDims.length as number | null,
          width: caseDims.width as number | null,
          height: caseDims.height as number | null,
          weight: caseDims.weight as number | null,
          uom_length: (caseDims.uom_length as string) || null,
          uom_weight: (caseDims.uom_weight as string) || null,
          units_per: caseDims.units_per as number | null,
          cartons_per_layer: caseDims.cartons_per_layer as number | null,
          number_of_layers: caseDims.number_of_layers as number | null,
          cartons_per_pallet: caseDims.cartons_per_pallet as number | null,
        }
      : null,
    palletDims: palletDims
      ? {
          kind: "pallet",
          length: palletDims.length as number | null,
          width: palletDims.width as number | null,
          height: palletDims.height as number | null,
          weight: palletDims.weight as number | null,
          uom_length: (palletDims.uom_length as string) || null,
          uom_weight: (palletDims.uom_weight as string) || null,
          units_per: palletDims.units_per as number | null,
          cartons_per_layer: palletDims.cartons_per_layer as number | null,
          number_of_layers: palletDims.number_of_layers as number | null,
          cartons_per_pallet: palletDims.cartons_per_pallet as number | null,
        }
      : null,
  };
}
