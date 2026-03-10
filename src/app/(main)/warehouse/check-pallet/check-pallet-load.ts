"use server";

import { serverSupabase } from "@/lib/serverSupabase";

export interface CheckPalletState {
  ok: boolean | null;
  error?: string;
  productName?: string;
  productId?: string;
  sku?: string;
  skuVar?: string | null;
  cartonsPerLayer?: number | null;
  numberOfLayers?: number | null;
  cartonsPerPallet?: number | null;
}

export async function loadPalletConfig(_prev: CheckPalletState, formData: FormData): Promise<CheckPalletState> {
  const sku = (formData.get("sku") || "").toString().trim();
  const skuVar = (formData.get("sku_var") || "").toString().trim();

  if (!sku) {
    return { ok: false, error: "SKU is required" };
  }

  const supabase = serverSupabase;

  // Resolve product by SKU / variant, case-insensitive (same pattern as /warehouse/dimensions)
  let productQuery = supabase.from("products").select("id, sku, sku_var, product_name").ilike("sku", sku);

  if (skuVar) {
    productQuery = productQuery.ilike("sku_var", skuVar);
  } else {
    productQuery = productQuery.is("sku_var", null);
  }

  const { data: product, error: prodError } = await productQuery.maybeSingle();

  if (prodError || !product) {
    console.error("Error looking up product for pallet check", prodError);
    return { ok: false, error: "Product not found for that SKU / variant" };
  }

  const { data: palletDims, error: dimsError } = await supabase
    .from("product_dimensions")
    .select("cartons_per_layer, number_of_layers, cartons_per_pallet")
    .eq("product_id", product.id)
    .eq("kind", "pallet")
    .maybeSingle();

  if (dimsError) {
    console.error("Error loading pallet configuration", dimsError);
    return { ok: false, error: "Error loading pallet configuration for this product" };
  }

  if (!palletDims) {
    return {
      ok: false,
      error: "No pallet configuration found for this product",
      productName: (product.product_name as string) || sku,
      productId: product.id as string,
      sku: product.sku as string,
      skuVar: (product.sku_var as string) || null,
    };
  }

  const cartonsPerLayer = palletDims.cartons_per_layer as number | null;
  const numberOfLayers = palletDims.number_of_layers as number | null;
  const cartonsPerPalletStored = palletDims.cartons_per_pallet as number | null;

  const calculatedCartonsPerPallet =
    cartonsPerPalletStored ??
    (cartonsPerLayer != null && numberOfLayers != null ? cartonsPerLayer * numberOfLayers : null);

  return {
    ok: true,
    productName: (product.product_name as string) || sku,
    productId: product.id as string,
    sku: product.sku as string,
    skuVar: (product.sku_var as string) || null,
    cartonsPerLayer,
    numberOfLayers,
    cartonsPerPallet: calculatedCartonsPerPallet,
  };
}
