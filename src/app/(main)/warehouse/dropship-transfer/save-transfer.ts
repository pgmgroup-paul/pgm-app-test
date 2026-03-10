"use server";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export interface DropshipSaveState {
  ok: boolean | null;
  error?: string;
  message?: string;
}

export async function saveDropshipTransfer(_prev: DropshipSaveState, formData: FormData): Promise<DropshipSaveState> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }

  const productId = (formData.get("product_id") || "").toString().trim();
  const sku = (formData.get("sku") || "").toString().trim();
  const skuVar = (formData.get("sku_var") || "").toString().trim() || null;

  const sourceType = (formData.get("source_type") || "").toString().trim();
  const containerId = (formData.get("source_container_id") || "").toString().trim();
  const shipmentId = (formData.get("source_shipment_id") || "").toString().trim();

  const qtyRaw = (formData.get("quantity") || "").toString().trim();
  const unit = (formData.get("unit") || "pieces").toString().trim();

  if (!productId || !sku) {
    return { ok: false, error: "Product information is missing" };
  }

  if (!qtyRaw) {
    return { ok: false, error: "Quantity is required" };
  }

  const quantity = Number(qtyRaw);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "Quantity must be a positive number" };
  }

  if (unit !== "pieces" && unit !== "cases") {
    return { ok: false, error: "Unit must be pieces or cases" };
  }

  if (!sourceType) {
    return { ok: false, error: "Please select a source type" };
  }

  if (sourceType === "container" && !containerId) {
    return { ok: false, error: "Please select a container" };
  }

  if (sourceType === "order_leftover" && !shipmentId) {
    return { ok: false, error: "Please select a shipment" };
  }

  const supabase = serverSupabase;

  const { error } = await supabase.from("dropship_transfers").insert({
    product_id: productId,
    sku,
    sku_var: skuVar,
    quantity,
    unit,
    source_type: sourceType,
    source_container_id: sourceType === "container" ? containerId : null,
    source_shipment_id: sourceType === "order_leftover" ? shipmentId : null,
    created_by: profile.id as string,
  });

  if (error) {
    console.error("Error inserting dropship transfer", error);
    return { ok: false, error: error.message || "Failed to save dropship transfer" };
  }

  return {
    ok: true,
    message: `Logged transfer of ${qtyRaw} ${unit} for SKU ${sku} to dropship area.`,
  };
}
