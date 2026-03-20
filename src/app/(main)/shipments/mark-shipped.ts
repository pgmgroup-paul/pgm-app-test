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
    redirect("/shipments");
  }

  const { error } = await serverSupabase
    .from("so_shipments")
    .update({ status: "shipped" })
    .eq("id", shipmentId);

  if (error) {
    console.error("Error marking shipment as shipped", error);
  }

  // After update, reload the list; shipments with status != ready disappear
  redirect("/shipments");
}
