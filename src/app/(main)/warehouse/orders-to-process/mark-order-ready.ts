"use server";

import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export async function markShipmentReady(formData: FormData): Promise<void> {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/auth/v1/login");
  }

  const shipmentId = (formData.get("shipment_id") || "").toString().trim();
  if (!shipmentId) {
    redirect("/warehouse/orders-to-process");
  }

  const supabase = serverSupabase;

  // Load current status for validation
  const { data: shipment, error: loadError } = await supabase
    .from("so_shipments")
    .select("status")
    .eq("id", shipmentId)
    .maybeSingle();

  if (loadError || !shipment) {
    console.error("Error loading shipment before mark ready", loadError);
    redirect("/warehouse/orders-to-process");
  }

  const currentStatus = (shipment as any).status as string;
  const newStatus = "ready";

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
      currentStatus === "shipped" || currentStatus === "cancelled"
        ? "Cannot modify a shipped or cancelled shipment"
        : `Invalid status transition from ${currentStatus} to ${newStatus}`;

    console.error(message);
    redirect("/warehouse/orders-to-process");
  }

  const { error } = await supabase.from("so_shipments").update({ status: newStatus }).eq("id", shipmentId);

  if (error) {
    console.error("Error marking shipment as ready", error);
    // Even on error, return to list; for now we don't surface error state in UI.
    redirect("/warehouse/orders-to-process");
  }

  redirect("/warehouse/orders-to-process?ready=1");
}
