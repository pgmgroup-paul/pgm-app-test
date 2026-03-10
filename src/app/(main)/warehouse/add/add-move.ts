"use server";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export interface AddMoveState {
  ok: boolean | null;
  error?: string;
  message?: string;
  movementId?: string;
}

export async function handleAddMove(_prev: AddMoveState, formData: FormData): Promise<AddMoveState> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }

  const productId = (formData.get("product_id") || "").toString().trim();
  const qtyRaw = (formData.get("add_quantity") || "").toString().trim();
  const unit = (formData.get("add_unit") || "cases").toString().trim().toLowerCase();
  const warehouseName = (formData.get("add_warehouse_name") || "").toString().trim();
  const locationCodeRaw = (formData.get("add_location_code") || "").toString().trim();

  const sourceType = (formData.get("add_source_type") || "").toString().trim();
  const sourceRef = (formData.get("add_source_ref") || "").toString().trim();

  // When source is container, use the container code as the reference so
  // Container received page can aggregate by source_ref = container.code
  const normalizedSourceRef = sourceType === "container" ? sourceRef : sourceRef;
  const sourceNote = (formData.get("add_source_note") || "").toString().trim();

  if (!productId) {
    return { ok: false, error: "Product must be selected first" };
  }

  if (!qtyRaw) {
    return { ok: false, error: "Quantity is required" };
  }

  const quantity = Number(qtyRaw);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "Quantity must be a positive number" };
  }

  if (unit !== "cases" && unit !== "pallets") {
    return { ok: false, error: "Unit must be Cases or Pallets" };
  }

  if (!warehouseName) {
    return { ok: false, error: "Warehouse is required" };
  }

  if (!locationCodeRaw) {
    return { ok: false, error: "Location code is required" };
  }

  if (!sourceType) {
    return { ok: false, error: "Source is required" };
  }

  if (sourceType === "container" && !sourceRef) {
    return { ok: false, error: "Please select a container" };
  }

  if (sourceType !== "container" && !sourceRef) {
    return { ok: false, error: "Please provide source details" };
  }

  const locationCode = locationCodeRaw;

  const supabase = serverSupabase;

  const { data, error } = await supabase.rpc("add_inventory", {
    p_warehouse_name: warehouseName,
    p_location_code: locationCode,
    p_product_id: productId,
    p_quantity: quantity,
    p_unit: unit,
    p_source_type: sourceType,
    p_source_ref: normalizedSourceRef,
    p_source_note: sourceNote,
  });

  if (error) {
    console.error("Error adding inventory", error);
    return { ok: false, error: error.message || "Add inventory failed" };
  }

  const normalizedLoc = locationCode.replace(/\s+/g, "").toUpperCase();

  return {
    ok: true,
    message: `Added ${qtyRaw} ${unit} to ${warehouseName} / ${normalizedLoc}.`,
    movementId: data as string | undefined,
  };
}
