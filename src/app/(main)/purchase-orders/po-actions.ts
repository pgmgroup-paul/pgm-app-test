"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export async function createPurchaseOrder(formData: FormData): Promise<void> {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  const supplier = (formData.get("supplier") || "").toString().trim();
  const terms = (formData.get("terms") || "").toString().trim();
  const shipDateRaw = (formData.get("ship_date") || "").toString().trim();
  const etaRaw = (formData.get("eta") || "").toString().trim();
  const notes = (formData.get("notes") || "").toString().trim();

  if (!supplier) {
    redirect("/purchase-orders/new?error=missing-supplier");
  }

  const ship_date = shipDateRaw || null;
  const eta = etaRaw || null;

  const { data, error } = await serverSupabase
    .from("purchase_orders")
    .insert({
      supplier: supplier || null,
      terms: terms || null,
      ship_date,
      eta,
      notes: notes || null,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Error creating purchase order", error);
    redirect("/purchase-orders/new?error=create-failed");
  }

  redirect(`/purchase-orders/new-v2?id=${data.id}`);
}

export async function closePurchaseOrder(formData: FormData): Promise<void> {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  const id = (formData.get("id") || "").toString().trim();

  if (!id) {
    redirect("/purchase-orders/new-v2?error=missing-id");
  }

  const { error } = await serverSupabase
    .from("purchase_orders")
    .update({ status: "closed" })
    .eq("id", id);

  if (error) {
    console.error("Error closing purchase order", error);
    redirect(`/purchase-orders/new-v2?id=${id}&error=close-failed`);
  }

  redirect(`/purchase-orders/new-v2?id=${id}`);
}

export async function updatePurchaseOrder(formData: FormData): Promise<void> {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  const id = (formData.get("id") || "").toString().trim();
  const supplier = (formData.get("supplier") || "").toString().trim();
  const terms = (formData.get("terms") || "").toString().trim();
  const shipDateRaw = (formData.get("ship_date") || "").toString().trim();
  const etaRaw = (formData.get("eta") || "").toString().trim();
  const notes = (formData.get("notes") || "").toString().trim();

  if (!id) {
    redirect("/purchase-orders/new-v2?error=missing-id");
  }

  if (!supplier) {
    redirect(`/purchase-orders/new-v2?id=${id}&error=missing-supplier`);
  }

  const ship_date = shipDateRaw || null;
  const eta = etaRaw || null;

  const { error } = await serverSupabase
    .from("purchase_orders")
    .update({
      supplier: supplier || null,
      terms: terms || null,
      ship_date,
      eta,
      notes: notes || null,
      status: "open",
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating purchase order", error);
    redirect(`/purchase-orders/new-v2?id=${id}&error=update-failed`);
  }

  redirect(`/purchase-orders`);
}

export async function addPurchaseOrderLine(formData: FormData): Promise<{ ok: boolean | null; error?: string }> {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { ok: false, error: "Not authorized" };
  }

  const purchaseOrderId = (formData.get("purchase_order_id") || "").toString().trim();
  const sku = (formData.get("sku") || "").toString().trim();
  const skuVar = (formData.get("sku_var") || "").toString().trim();
  const qtyRaw = (formData.get("quantity_cases") || "").toString().trim();
  const priceRaw = (formData.get("price") || "").toString().trim();
  const volumeRaw = (formData.get("sku_volume_m3") || "").toString().trim();
  const returnTo = (formData.get("return_to") || "").toString();

  if (!purchaseOrderId) {
    return { ok: false, error: "Missing purchase order" };
  }

  if (!sku) {
    return { ok: false, error: "SKU is required" };
  }

  if (!qtyRaw) {
    return { ok: false, error: "Quantity is required" };
  }

  const quantity = Number(qtyRaw);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "Quantity must be a positive number" };
  }

  const price = priceRaw ? Number(priceRaw) : null;
  const skuVolume = volumeRaw ? Number(volumeRaw) : null;

  const supabase = serverSupabase;

  // Resolve product by SKU / variant, case-insensitive (same logic as warehouse tools)
  let productQuery = supabase.from("products").select("id, sku, sku_var, product_name").ilike("sku", sku);

  if (skuVar) {
    productQuery = productQuery.ilike("sku_var", skuVar);
  } else {
    productQuery = productQuery.is("sku_var", null);
  }

  const { data: product, error: prodError } = await productQuery.maybeSingle();

  if (prodError || !product) {
    console.error("Error looking up product for PO line", prodError);
    redirect(`/purchase-orders/${purchaseOrderId}/edit?error=product-not-in-catalog`);
  }

  const { error } = await supabase.from("purchase_order_lines").insert({
    purchase_order_id: purchaseOrderId,
    product_id: product.id as string,
    sku: product.sku as string,
    sku_var: (product.sku_var as string) || null,
    description: (product.product_name as string) || null,
    quantity_cases: quantity,
    price,
    sku_volume_m3: skuVolume,
  });

  if (error) {
    console.error("Error inserting PO line", error);
    redirect(`/purchase-orders/${purchaseOrderId}/edit?error=failed-to-add-line`);
  }

  if (returnTo === "new-v2") {
    redirect(`/purchase-orders/new-v2?id=${purchaseOrderId}`);
  } else {
    redirect(`/purchase-orders/${purchaseOrderId}/edit`);
  }
}

export async function updatePurchaseOrderLineQuantity(formData: FormData): Promise<{ ok: boolean | null; error?: string }> {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { ok: false, error: "Not authorized" };
  }

  const lineId = (formData.get("line_id") || "").toString().trim();
  const poId = (formData.get("purchase_order_id") || "").toString().trim();
  const qtyRaw = (formData.get("quantity_cases") || "").toString().trim();
  const returnTo = (formData.get("return_to") || "").toString();

  if (!lineId || !poId || !qtyRaw) {
    return { ok: false, error: "Missing data for update" };
  }

  const quantity = Number(qtyRaw);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "Quantity must be a positive number" };
  }

  const { error } = await serverSupabase
    .from("purchase_order_lines")
    .update({ quantity_cases: quantity })
    .eq("id", lineId);

  if (error) {
    console.error("Error updating PO line quantity", error);
    return { ok: false, error: "Failed to update line" };
  }

  if (returnTo === "new-v2") {
    revalidatePath("/purchase-orders/new-v2");
    redirect(`/purchase-orders/new-v2?id=${poId}&refresh=${Date.now()}`);
  } else {
    redirect(`/purchase-orders/${poId}/edit`);
  }
}

export async function deletePurchaseOrderLine(formData: FormData): Promise<{ ok: boolean | null; error?: string }> {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { ok: false, error: "Not authorized" };
  }

  const lineId = (formData.get("line_id") || "").toString().trim();
  const poId = (formData.get("purchase_order_id") || "").toString().trim();
  const returnTo = (formData.get("return_to") || "").toString();

  if (!lineId || !poId) {
    return { ok: false, error: "Missing line or purchase order" };
  }

  const { error } = await serverSupabase.from("purchase_order_lines").delete().eq("id", lineId);

  if (error) {
    console.error("Error deleting PO line", error);
    return { ok: false, error: "Failed to remove line" };
  }

  if (returnTo === "new-v2") {
    redirect(`/purchase-orders/new-v2?id=${poId}`);
  } else {
    redirect(`/purchase-orders/${poId}/edit`);
  }
}
