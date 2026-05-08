"use server";

import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export async function markShipmentAsShipped(shipmentId: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  if (!shipmentId) {
    redirect("/sales-shipments");
  }

  // Load current status for validation
  const { data: shipment, error: loadError } = await serverSupabase
    .from("so_shipments")
    .select("status, sales_order_id")
    .eq("id", shipmentId)
    .maybeSingle();

  if (loadError || !shipment) {
    console.error("Error loading shipment before mark as shipped", loadError);
    redirect("/sales-shipments");
  }

  const currentStatus = (shipment as any).status as string;
  const newStatus = "shipped";

  const allowedTransitions: Record<string, string[]> = {
    planned: ["processing", "cancelled"],
    processing: ["ready", "cancelled"],
    ready: ["shipped", "cancelled"],
    shipped: [],
    cancelled: [],
  };

  const allowed = allowedTransitions[currentStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    const message =
      currentStatus === "ready"
        ? "Cannot mark shipment as shipped unless it is ready"
        : currentStatus === "shipped" || currentStatus === "cancelled"
          ? "Cannot modify a shipped or cancelled shipment"
          : `Invalid status transition from ${currentStatus} to ${newStatus}`;

    console.error(message);
    // For now, just return to the list without updating
    redirect("/sales-shipments");
  }

  const { error } = await serverSupabase
    .from("so_shipments")
    .update({
      status: newStatus,
      shipped_at: new Date().toISOString(),
      shipped_by: profile.id,
    })
    .eq("id", shipmentId);

  if (error) {
    console.error("Error marking shipment as shipped", error);
  } else {
    // Get sales order id
    const salesOrderId = (shipment as any).sales_order_id as string;

    // Load all shipments for this sales order
    const { data: allShipments, error: allShipmentsError } = await serverSupabase
      .from("so_shipments")
      .select("status")
      .eq("sales_order_id", salesOrderId);

    if (allShipmentsError) {
      console.error("Error loading shipments for SO shipped update", allShipmentsError);
    } else if (allShipments && allShipments.length > 0) {
      // Check if all shipments are shipped
      const hasNonShipped = allShipments.some((s) => (s as any).status !== "shipped");
      if (!hasNonShipped) {
        const { error: soUpdateError } = await serverSupabase
          .from("sales_orders")
          .update({ status: "shipped" })
          .eq("id", salesOrderId);

        if (soUpdateError) {
          console.error("Error updating sales order to shipped", soUpdateError);
        }
      }
    }
  }

  // After update, reload the list; shipments with status != ready disappear
  redirect("/sales-shipments");
}
