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

  const { error } = await supabase.from("so_shipments").update({ status: "ready" }).eq("id", shipmentId);

  if (error) {
    console.error("Error marking shipment as ready", error);
    // Even on error, return to list; for now we don't surface error state in UI.
    redirect("/warehouse/orders-to-process");
  }

  redirect("/warehouse/orders-to-process?ready=1");
}
