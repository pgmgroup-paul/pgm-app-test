"use server";

import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export async function allocateUnitsToShipment(salesOrderId: string, shipmentId: string, formData: FormData) {
  const profile = await getCurrentUserProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  // Expect a single non-empty allocate_<sales_order_line_id> field
  let targetLineId: string | null = null;
  let rawQty = "";

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("allocate_")) continue;
    const candidateQty = (value || "").toString().trim();
    if (!candidateQty) continue; // skip empty inputs
    targetLineId = key.replace("allocate_", "");
    rawQty = candidateQty;
    break;
  }

  if (!targetLineId || !rawQty) {
    redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}`);
  }

  const qty = Number(rawQty);
  if (!Number.isFinite(qty) || qty <= 0) {
    redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}?status=bad-qty`);
  }

  // Load ordered + shipped to enforce remaining >= qty
  const { data: soLine, error: soLineError } = await serverSupabase
    .from("sales_order_lines")
    .select("id, product_id, sku, sku_var, description, quantity_units")
    .eq("id", targetLineId)
    .maybeSingle();

  if (soLineError || !soLine) {
    console.error("Error loading SO line for allocation", soLineError);
    redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}?status=alloc-error`);
  }

  const { data: shippedAgg, error: shippedError } = await serverSupabase
    .from("so_shipment_lines")
    .select("sales_order_line_id, quantity_shipped_units")
    .eq("sales_order_line_id", targetLineId);

  if (shippedError) {
    console.error("Error loading shipped aggregates for allocation", shippedError);
    redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}?status=alloc-error`);
  }

  const totalShipped = (shippedAgg || []).reduce((acc, row) => {
    return acc + (Number(row.quantity_shipped_units) || 0);
  }, 0);

  const ordered = Number(soLine.quantity_units) || 0;
  const remaining = Math.max(ordered - totalShipped, 0);

  if (qty > remaining) {
    redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}?status=over-allocate`);
  }

  // Enforce unique (so_shipment_id, sales_order_line_id)
  const { data: existingAlloc, error: existingAllocError } = await serverSupabase
    .from("so_shipment_lines")
    .select("id")
    .eq("so_shipment_id", shipmentId)
    .eq("sales_order_line_id", targetLineId)
    .maybeSingle();

  if (existingAllocError) {
    console.error("Error checking existing allocation", existingAllocError);
    redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}?status=alloc-error`);
  }

  if (existingAlloc) {
    // Do not allow duplicate in this design; user must delete and re-add if needed
    redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}?status=duplicate-line`);
  }

  const { error } = await serverSupabase.from("so_shipment_lines").insert({
    so_shipment_id: shipmentId,
    sales_order_line_id: targetLineId,
    product_id: soLine.product_id as string,
    sku: soLine.sku as string,
    sku_var: (soLine.sku_var as string) || null,
    description: (soLine.description as string) || null,
    quantity_ordered_units: Number(soLine.quantity_units) || 0,
    quantity_shipped_units: qty,
  });

  if (error) {
    console.error("Error inserting shipment allocation", error);
    redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}?status=alloc-error`);
  }

  redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}?status=allocated`);
}

export async function sendShipmentToWarehouse(salesOrderId: string, shipmentId: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  // Load shipment header
  const { data: shipment, error: shipError } = await serverSupabase
    .from("so_shipments")
    .select("id, sales_order_id, shipment_sequence, ship_date, status")
    .eq("id", shipmentId)
    .maybeSingle();

  if (shipError || !shipment) {
    console.error("Error loading shipment for sendShipmentToWarehouse", shipError);
    redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}?status=packing-error`);
  }

  // Make sure there is at least one line allocated
  const { data: lines, error: linesError } = await serverSupabase
    .from("so_shipment_lines")
    .select("id")
    .eq("so_shipment_id", shipmentId);

  if (linesError) {
    console.error("Error loading shipment lines before send to warehouse", linesError);
    redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}?status=packing-error`);
  }

  if (!lines || lines.length === 0) {
    redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}?status=no-lines`);
  }

  const { error: statusError } = await serverSupabase
    .from("so_shipments")
    .update({ status: "processing" })
    .eq("id", shipmentId);

  if (statusError) {
    console.error("Error updating shipment status to processing", statusError);
    redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}?status=packing-error`);
  }

  redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}?status=sent-to-warehouse`);
}

export async function deleteShipmentFromShipmentPage(
  salesOrderId: string,
  shipmentIdToDelete: string,
  returnShipmentId: string,
) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  if (!salesOrderId || !shipmentIdToDelete) {
    redirect(`/sales-orders/${salesOrderId}/edit`);
  }

  const { data: shipment, error: loadError } = await serverSupabase
    .from("so_shipments")
    .select("id, sales_order_id, status")
    .eq("id", shipmentIdToDelete)
    .maybeSingle();

  if (loadError || !shipment || (shipment.sales_order_id as string) !== salesOrderId) {
    console.error("Error loading shipment for delete", loadError);
    redirect(`/sales-orders/${salesOrderId}/shipments/${returnShipmentId}`);
  }

  // Only allow deleting planned shipments
  if (shipment.status !== "planned") {
    redirect(`/sales-orders/${salesOrderId}/shipments/${returnShipmentId}`);
  }

  const { error: delLinesError } = await serverSupabase
    .from("so_shipment_lines")
    .delete()
    .eq("so_shipment_id", shipmentIdToDelete);

  if (delLinesError) {
    console.error("Error deleting shipment lines", delLinesError);
    redirect(`/sales-orders/${salesOrderId}/shipments/${returnShipmentId}`);
  }

  const { error: delError } = await serverSupabase.from("so_shipments").delete().eq("id", shipmentIdToDelete);

  if (delError) {
    console.error("Error deleting shipment", delError);
  }

  // After delete, stay on the currently viewed shipment page (returnShipmentId)
  redirect(`/sales-orders/${salesOrderId}/shipments/${returnShipmentId}`);
}
