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
    .select("status")
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
  }

  // After update, reload the list; shipments with status != ready disappear
  redirect("/sales-shipments");
}
