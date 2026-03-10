"use server";

import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export async function updateProductionStatus(formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "supplier" && profile.role !== "admin")) {
    throw new Error("Not authorized");
  }

  const lineId = (formData.get("po_line_id") || "").toString().trim();
  const status = (formData.get("production_status") || "").toString().trim();

  if (!lineId || !status) {
    throw new Error("Missing line or status");
  }

  if (!["under_production", "ready", "cancelled"].includes(status)) {
    throw new Error("Invalid status");
  }

  const { error } = await serverSupabase
    .from("purchase_order_lines")
    .update({
      production_status: status,
      production_status_updated_at: new Date().toISOString(),
      production_status_updated_by: profile.id,
    })
    .eq("id", lineId);

  if (error) {
    console.error("Error updating production status", error);
    throw new Error("Failed to update status");
  }

  redirect("/supplier/production-status");
}
