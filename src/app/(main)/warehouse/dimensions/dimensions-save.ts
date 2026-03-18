"use server";

import { serverSupabase } from "@/lib/serverSupabase";

export interface SaveDimensionsState {
  ok: boolean | null;
  error?: string;
  message?: string;
}

export async function saveDimensions(_prev: SaveDimensionsState, formData: FormData): Promise<SaveDimensionsState> {
  const productId = (formData.get("product_id") || "").toString().trim();

  if (!productId) {
    return { ok: false, error: "Product not loaded" };
  }

  const supabase = serverSupabase;

  // Helper to parse optional numeric fields
  const num = (name: string): number | null => {
    const raw = (formData.get(name) || "").toString().trim();
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return value;
  };

  const _text = (name: string): string | null => {
    const raw = (formData.get(name) || "").toString().trim();
    return raw || null;
  };

  // CASE dims
  const caseLength = num("case_length");
  const caseWidth = num("case_width");
  const caseHeight = num("case_height");
  const caseWeight = num("case_weight");
  const caseUnitsPer = num("case_units_per");
  const caseUomLength = "in";
  const caseUomWeight = "lb";

  // PALLET dims
  const palletLength = num("pallet_length");
  const palletWidth = num("pallet_width");
  const palletHeight = num("pallet_height");
  const palletUomLength = "in";
  const palletUomWeight = "lb";
  const cartonsPerLayer = num("pallet_cartons_per_layer");
  const numberOfLayers = num("pallet_number_of_layers");
  const cartonsPerPallet =
    cartonsPerLayer !== null && numberOfLayers !== null ? cartonsPerLayer * numberOfLayers : null;

  const palletWeight = cartonsPerPallet !== null && caseWeight !== null ? cartonsPerPallet * caseWeight + 50 : null;

  const rowsToUpsert: any[] = [];

  // We only write a row if at least one key field is provided
  if (
    caseLength !== null ||
    caseWidth !== null ||
    caseHeight !== null ||
    caseWeight !== null ||
    caseUnitsPer !== null
  ) {
    rowsToUpsert.push({
      product_id: productId,
      kind: "case",
      length: caseLength,
      width: caseWidth,
      height: caseHeight,
      weight: caseWeight,
      uom_length: caseUomLength || "in",
      uom_weight: caseUomWeight || "lb",
      units_per: caseUnitsPer,
    });
  }

  if (
    palletLength !== null ||
    palletWidth !== null ||
    palletHeight !== null ||
    cartonsPerLayer !== null ||
    numberOfLayers !== null ||
    cartonsPerPallet !== null ||
    palletWeight !== null
  ) {
    rowsToUpsert.push({
      product_id: productId,
      kind: "pallet",
      length: palletLength,
      width: palletWidth,
      height: palletHeight,
      weight: palletWeight,
      uom_length: palletUomLength,
      uom_weight: palletUomWeight,
      cartons_per_layer: cartonsPerLayer,
      number_of_layers: numberOfLayers,
      cartons_per_pallet: cartonsPerPallet,
    });
  }

  if (rowsToUpsert.length === 0) {
    return { ok: false, error: "Nothing to save. Enter at least one dimension value." };
  }

  // Upsert by (product_id, kind) if there is a unique constraint; otherwise this will behave like insert+update by PK
  const { error } = await supabase.from("product_dimensions").upsert(rowsToUpsert, {
    onConflict: "product_id,kind",
  });

  if (error) {
    console.error("Error saving dimensions", error);
    return { ok: false, error: error.message || "Error saving dimensions" };
  }

  return { ok: true, message: "Dimensions saved successfully." };
}
