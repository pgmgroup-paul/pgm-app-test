"use server";

import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export async function addShipmentForSo(salesOrderId: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  if (!salesOrderId) {
    throw new Error("Missing sales order id");
  }

  const { data: existing, error: existingError } = await serverSupabase
    .from("so_shipments")
    .select("shipment_sequence")
    .eq("sales_order_id", salesOrderId);

  if (existingError) {
    console.error("Error loading existing shipments for addShipmentForSo", existingError);
  }

  const nextSeq =
    existing && existing.length > 0 ? Math.max(...existing.map((s) => Number(s.shipment_sequence) || 0)) + 1 : 1;

  const { data, error } = await serverSupabase
    .from("so_shipments")
    .insert({
      sales_order_id: salesOrderId,
      shipment_sequence: nextSeq,
      status: "planned",
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("Error inserting new shipment", error);
    throw new Error(error?.message ?? "Failed to add shipment");
  }

  // After creating the shipment, return to the SO shipments page so the list refreshes
  redirect(`/sales-orders/${salesOrderId}/shipments`);
}

export async function deleteShipmentForSoOnList(salesOrderId: string, shipmentId: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  if (!salesOrderId || !shipmentId) {
    redirect(`/sales-orders/${salesOrderId}/shipments`);
  }

  // 1) Delete any dropship transfers that reference this shipment
  const { error: delDropshipError } = await serverSupabase
    .from("dropship_transfers")
    .delete()
    .eq("source_shipment_id", shipmentId);

  if (delDropshipError) {
    console.error("Error deleting dropship_transfers for shipment", delDropshipError);
  }

  // 2) Delete child shipment lines
  const { error: delLinesError } = await serverSupabase
    .from("so_shipment_lines")
    .delete()
    .eq("so_shipment_id", shipmentId);

  if (delLinesError) {
    console.error("Error deleting shipment lines from list page", delLinesError);
  }

  // 3) Delete the shipment header
  const { error: delError } = await serverSupabase.from("so_shipments").delete().eq("id", shipmentId);

  if (delError) {
    console.error("Error deleting shipment from list page", delError);
  }

  // After delete, redirect back to the shipments page so both sections reload
  redirect(`/sales-orders/${salesOrderId}/shipments`);
}
