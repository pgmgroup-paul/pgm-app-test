"use server";

import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";
import { logActivity } from "@/lib/activity/log-activity";

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
    .select("status, sales_order_id")
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

  // Get sales order id
  const salesOrderId = (shipment as any).sales_order_id as string;

  // Load all shipments for this sales order
  const { data: allShipments, error: allShipmentsError } = await supabase
    .from("so_shipments")
    .select("status")
    .eq("sales_order_id", salesOrderId);

  if (allShipmentsError) {
    console.error("Error loading shipments for SO status update", allShipmentsError);
  } else if (allShipments && allShipments.length > 0) {
    // Check if all shipments are ready
    const hasNonReady = allShipments.some((s) => (s as any).status !== "ready");
    if (!hasNonReady) {
      // Before updating sales_orders, load current status for transition logging
      const { data: existingSo, error: existingSoError } = await supabase
        .from("sales_orders")
        .select("id, order_number, status")
        .eq("id", salesOrderId)
        .maybeSingle();

      const previousStatus = (((existingSo as any)?.status || "") as string).trim();

      console.log("SALES_ORDER_READY_BEFORE_UPDATE", {
        salesOrderId,
        previousStatus,
        existingSoError,
      });

      // Update sales order status to ready
      const { error: soUpdateError } = await supabase
        .from("sales_orders")
        .update({ status: "ready" })
        .eq("id", salesOrderId);

      if (soUpdateError) {
        console.error("Error updating sales order to ready", soUpdateError);
      } else {
        // Reload sales order to confirm resulting status and get order number
        const { data: updatedSo, error: updatedSoError } = await supabase
          .from("sales_orders")
          .select("id, order_number, status")
          .eq("id", salesOrderId)
          .maybeSingle();

        const resultingStatus = (((updatedSo as any)?.status || "") as string).trim();
        const orderNumber = (((updatedSo as any)?.order_number || existingSo?.order_number || "") as string).trim();

        console.log("SALES_ORDER_READY_AFTER_UPDATE", {
          salesOrderId,
          orderNumber,
          resultingStatus,
          updatedSoError,
        });

        const wasReadyBefore = previousStatus === "ready";
        const isNowReady = resultingStatus === "ready";

        console.log("SALES_ORDER_READY_DECISION", {
          salesOrderId,
          orderNumber,
          previousStatus,
          resultingStatus,
          wasReadyBefore,
          isNowReady,
        });

        // Log activity only when transitioning into ready
        if (!wasReadyBefore && isNowReady && orderNumber) {
          try {
            const userName =
              (profile.full_name as string | undefined) ||
              (profile.email as string | undefined) ||
              "Unknown User";

            console.log("ATTEMPTING_SALES_ORDER_READY_ACTIVITY_LOG", {
              userId: profile.id,
              userName,
              salesOrderId,
              orderNumber,
            });

            await logActivity({
              supabase,
              userId: profile.id as string,
              userName,
              eventType: "sales_order_ready",
              entityType: "sales_order",
              entityId: salesOrderId,
              entityLabel: orderNumber,
              message: `marked Sales Order ${orderNumber} ready`,
            });

            console.log("SALES_ORDER_READY_ACTIVITY_LOGGED");
          } catch (activityErr) {
            console.error("Failed to log sales_order_ready activity", activityErr);
          }
        }
      }
    }
  }

  redirect("/warehouse/orders-to-process?ready=1");
}
