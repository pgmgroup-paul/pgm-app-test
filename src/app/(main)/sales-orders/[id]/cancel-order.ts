"use server";

import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export async function cancelSalesOrder(soId: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  if (!soId) {
    redirect("/sales-orders");
  }

  // 1) Load current SO + shipments, ensure no shipped shipments
  const { data: so, error: soError } = await serverSupabase
    .from("sales_orders")
    .select("id, status")
    .eq("id", soId)
    .maybeSingle();

  if (soError || !so) {
    console.error("Error loading sales order before cancel", soError);
    redirect("/sales-orders");
  }

  const { data: shipments, error: shipError } = await serverSupabase
    .from("so_shipments")
    .select("id, status")
    .eq("sales_order_id", soId);

  if (shipError) {
    console.error("Error loading shipments before cancel", shipError);
    redirect(`/sales-orders/${soId}/edit`);
  }

  // Step 1 — Validate shipped shipments
  const hasShipped = (shipments || []).some((s: any) => (s.status as string) === "shipped");
  if (hasShipped) {
    console.error("Cannot cancel order with shipped shipments", { soId });
    redirect(`/sales-orders/${soId}/edit`);
  }

  if ((so as any).status === "cancelled") {
    redirect(`/sales-orders/${soId}/edit`);
  }

  // Step 2 — Cancel shipments: planned/processing/ready
  const { error: updShipErr } = await serverSupabase
    .from("so_shipments")
    .update({ status: "cancelled" })
    .eq("sales_order_id", soId)
    .in("status", ["planned", "processing", "ready"]);

  if (updShipErr) {
    console.error("Error cancelling shipments for sales order", updShipErr);
    redirect(`/sales-orders/${soId}/edit`);
  }

  // Step 3 — Cancel order
  const { error: updSoErr } = await serverSupabase
    .from("sales_orders")
    .update({ status: "cancelled" })
    .eq("id", soId);

  if (updSoErr) {
    console.error("Error cancelling sales order", updSoErr);
    redirect(`/sales-orders/${soId}/edit`);
  }

  // Step 4 — Return success (redirect back to edit view)
  redirect(`/sales-orders/${soId}/edit`);
}
