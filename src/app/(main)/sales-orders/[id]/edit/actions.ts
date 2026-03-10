"use server";

import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export async function createShipmentDraftForSo(soId: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  if (!soId) {
    throw new Error("Missing sales order id");
  }

  // Compute remaining quantity on this SO
  const { data: soLines, error: soLinesError } = await serverSupabase
    .from("sales_order_lines")
    .select("id, quantity_units")
    .eq("sales_order_id", soId);

  if (soLinesError) {
    console.error("Error loading SO lines for shipments button", soLinesError);
  }

  const lineIds = (soLines || []).map((l) => l.id as string);
  let hasRemaining = false;

  if (lineIds.length > 0) {
    const { data: shippedAgg, error: shippedError } = await serverSupabase
      .from("so_shipment_lines")
      .select("sales_order_line_id, quantity_shipped_units")
      .in("sales_order_line_id", lineIds);

    if (shippedError) {
      console.error("Error loading shipped aggregates for shipments button", shippedError);
    }

    const shippedMap = new Map<string, number>();
    for (const row of shippedAgg || []) {
      const id = row.sales_order_line_id as string;
      const qty = Number(row.quantity_shipped_units) || 0;
      shippedMap.set(id, (shippedMap.get(id) || 0) + qty);
    }

    for (const l of soLines || []) {
      const ordered = Number(l.quantity_units) || 0;
      const shipped = shippedMap.get(l.id as string) || 0;
      if (ordered > shipped) {
        hasRemaining = true;
        break;
      }
    }
  }

  // Load existing shipments for this SO
  const { data: existing, error: existingError } = await serverSupabase
    .from("so_shipments")
    .select("id, shipment_sequence, status")
    .eq("sales_order_id", soId)
    .order("shipment_sequence", { ascending: true });

  if (existingError) {
    console.error("Error checking existing shipments", existingError);
  }

  if (existing && existing.length > 0) {
    if (hasRemaining) {
      // If there is a planned shipment, go to it; otherwise create a new one below
      const planned = existing.find((s) => s.status === "planned");
      if (planned) {
        redirect(`/sales-orders/${soId}/shipments/${planned.id as string}`);
      }
    } else {
      // No remaining quantity: show list/contents view on first shipment (read-only)
      const first = existing[0];
      redirect(`/sales-orders/${soId}/shipments/${first.id as string}?mode=list`);
    }
  }

  // If we get here and hasRemaining is true but no planned shipment exists yet,
  // create a new planned shipment draft and land in planning view.
  const { data, error } = await serverSupabase.rpc("create_so_shipment_draft", {
    p_sales_order_id: soId,
    p_carrier_name: null,
    p_tracking_number: null,
    p_ship_date: null,
  });

  if (error) {
    console.error("create_so_shipment_draft error", error);
    throw new Error(error.message ?? "Failed to create shipment");
  }

  const shipmentId = (data as string) || "";

  if (!shipmentId) {
    throw new Error("No shipment_id returned from draft RPC");
  }

  redirect(`/sales-orders/${soId}/shipments/${shipmentId}`);
}

export async function deleteShipmentForSo(soId: string, shipmentId: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  if (!soId || !shipmentId) {
    redirect(`/sales-orders/${soId}/edit`);
  }

  // Optionally, only allow delete when shipment is still planned
  const { data: shipment, error: loadError } = await serverSupabase
    .from("so_shipments")
    .select("id, sales_order_id, status")
    .eq("id", shipmentId)
    .maybeSingle();

  if (loadError || !shipment || (shipment.sales_order_id as string) !== soId) {
    console.error("Error loading shipment for delete", loadError);
    redirect(`/sales-orders/${soId}/edit`);
  }

  if (shipment.status !== "planned") {
    // For now, do not allow deleting shipped/processing shipments
    redirect(`/sales-orders/${soId}/edit`);
  }

  // Delete child shipment lines first (in case FKs do not cascade)
  const { error: delLinesError } = await serverSupabase
    .from("so_shipment_lines")
    .delete()
    .eq("so_shipment_id", shipmentId);

  if (delLinesError) {
    console.error("Error deleting shipment lines", delLinesError);
    redirect(`/sales-orders/${soId}/edit`);
  }

  const { error: delError } = await serverSupabase.from("so_shipments").delete().eq("id", shipmentId);

  if (delError) {
    console.error("Error deleting shipment", delError);
  }

  redirect(`/sales-orders/${soId}/edit`);
}
