"use server";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export interface ConsolidateMoveState {
  ok: boolean | null;
  error?: string;
  message?: string;
}

export async function handleConsolidateMove(
  _prevState: ConsolidateMoveState,
  formData: FormData,
): Promise<ConsolidateMoveState> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }

  const sourceWarehouse = (formData.get("source_warehouse") || "").toString().trim();
  const sourceLocation = (formData.get("source_location") || "").toString().trim();
  const productId = (formData.get("source_product_id") || "").toString().trim();
  const destWarehouse = (formData.get("dest_warehouse") || "").toString().trim();
  const destLocation = (formData.get("dest_location") || "").toString().trim();
  const qtyRaw = (formData.get("move_quantity") || "").toString().trim();
  const unit = (formData.get("move_unit") || "cases").toString().trim().toLowerCase();

  if (!sourceWarehouse || !sourceLocation || !productId || !destWarehouse || !destLocation || !qtyRaw) {
    return { ok: false, error: "Please select a SKU and fill all destination and quantity fields" };
  }

  const quantity = Number(qtyRaw);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "Quantity must be a positive number" };
  }

  if (unit !== "cases" && unit !== "pallets") {
    return { ok: false, error: "Unit must be Cases or Pallets" };
  }

  const supabase = serverSupabase;

  const { error } = await supabase.rpc("consolidate_inventory", {
    p_source_warehouse_name: sourceWarehouse,
    p_source_location_code: sourceLocation,
    p_product_id: productId,
    p_dest_warehouse_name: destWarehouse,
    p_dest_location_code: destLocation,
    p_quantity: quantity,
    p_unit: unit,
  });

  if (error) {
    console.error("Error consolidating inventory", error);
    return { ok: false, error: error.message || "Consolidate movement failed" };
  }

  const normalizedSourceLoc = sourceLocation.replace(/\s+/g, "").toUpperCase();
  const normalizedDestLoc = destLocation.replace(/\s+/g, "").toUpperCase();

  return {
    ok: true,
    message: `Movement saved: ${qtyRaw} ${unit} from ${sourceWarehouse} / ${normalizedSourceLoc} to ${destWarehouse} / ${normalizedDestLoc}.`,
  };
}
