import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";
import { cancelSalesOrder } from "../cancel-order";
import { sendShipmentToWarehouse } from "../shipments/[shipmentId]/actions";
import { AddLineForm } from "./AddLineForm";
import { RequestedShipDateInput } from "./RequestedShipDateInput";
import { LineQuantityInput } from "./LineQuantityInput";

export const dynamic = "force-dynamic";

export async function sendAllInOneShipment(salesOrderId: string) {
  "use server";

  // 1. Load sales order lines
  const { data: lines, error: linesError } = await serverSupabase
    .from("sales_order_lines")
    .select("id, product_id, sku, sku_var, description, quantity_units")
    .eq("sales_order_id", salesOrderId);

  if (linesError || !lines || lines.length === 0) {
    console.error("Error loading sales order lines for fast ship", linesError);
    redirect(`/sales-orders/${salesOrderId}/edit?error=no-lines`);
  }

  // 2. Check existing shipments
  const { data: shipments, error: shipmentsError } = await serverSupabase
    .from("so_shipments")
    .select("id")
    .eq("sales_order_id", salesOrderId);

  if (shipmentsError) {
    console.error("Error checking existing shipments for fast ship", shipmentsError);
    redirect(`/sales-orders/${salesOrderId}/edit?error=failed-fast-ship`);
  }

  if (shipments && shipments.length > 0) {
    redirect(`/sales-orders/${salesOrderId}/edit?error=shipments-exist`);
  }

  // 3. Create shipment (sequence = 1)
  const { data: newShipment, error: shipmentError } = await serverSupabase
    .from("so_shipments")
    .insert({
      sales_order_id: salesOrderId,
      shipment_sequence: 1,
      status: "planned",
    })
    .select("id")
    .single();

  if (shipmentError || !newShipment) {
    console.error("Error creating shipment for fast ship", shipmentError);
    redirect(`/sales-orders/${salesOrderId}/edit?error=failed-fast-ship`);
  }

  const shipmentId = newShipment.id as string;

  // 4. Allocate all lines with full shipment line details
  const allocationRows = lines.map((l) => ({
    so_shipment_id: shipmentId,
    sales_order_line_id: l.id as string,
    product_id: l.product_id as string,
    sku: l.sku,
    sku_var: l.sku_var || null,
    description: l.description || null,
    quantity_ordered_units: l.quantity_units,
    quantity_shipped_units: l.quantity_units,
  }));

  const { error: allocError } = await serverSupabase.from("so_shipment_lines").insert(allocationRows);

  if (allocError) {
    console.error("Error allocating shipment lines for fast ship", allocError);
    redirect(`/sales-orders/${salesOrderId}/edit?error=failed-fast-ship`);
  }

  // 5. Send to warehouse (reuse existing logic)
  await sendShipmentToWarehouse(salesOrderId, shipmentId, { skipRedirect: true });

  // Update sales order status to "processing"
  const { error: soUpdateError } = await serverSupabase
    .from("sales_orders")
    .update({ status: "processing" })
    .eq("id", salesOrderId);

  if (soUpdateError) {
    console.error("Error updating sales order to processing", soUpdateError);
  }

  // 6. Success
  redirect(`/sales-orders/${salesOrderId}/edit?status=fast-shipped`);
}

async function loadSalesOrder(id: string) {
  const { data: so, error } = await serverSupabase
    .from("sales_orders")
    .select("id, order_number, customer_name, status, order_date, requested_ship_date, notes")
    .eq("id", id)
    .maybeSingle();

  if (error || !so) {
    console.error("Error loading sales order", error);
    return null;
  }

  const { data: lines, error: linesError } = await serverSupabase
    .from("sales_order_lines")
    .select("id, product_id, sku, sku_var, description, quantity_units")
    .eq("sales_order_id", id)
    .order("created_at", { ascending: true });

  if (linesError) {
    console.error("Error loading sales order lines", linesError);
  }

  // Load shipments summary for this sales order
  const { data: shipments, error: shipmentsError } = await serverSupabase
    .from("so_shipments")
    .select("id, shipment_sequence, status")
    .eq("sales_order_id", id)
    .order("shipment_sequence", { ascending: true });

  if (shipmentsError) {
    console.error("Error loading shipments for sales order", shipmentsError);
  }

  let shipmentsWithTotals: any[] = [];

  if (shipments && shipments.length > 0) {
    const shipmentIds = shipments.map((s) => s.id as string);

    const { data: shipLines, error: shipLinesError } = await serverSupabase
      .from("so_shipment_lines")
      .select("so_shipment_id, quantity_shipped_units")
      .in("so_shipment_id", shipmentIds);

    if (shipLinesError) {
      console.error("Error loading shipment line totals", shipLinesError);
    }

    const totalsMap = new Map<string, number>();
    for (const sl of shipLines || []) {
      const sid = sl.so_shipment_id as string;
      const qty = Number(sl.quantity_shipped_units) || 0;
      totalsMap.set(sid, (totalsMap.get(sid) || 0) + qty);
    }

    shipmentsWithTotals = shipments.map((s) => ({
      id: s.id as string,
      shipment_sequence: s.shipment_sequence as number,
      status: s.status as string,
      total_shipped_units: totalsMap.get(s.id as string) || 0,
    }));
  }

  return { so, lines: lines || [], shipments: shipmentsWithTotals };
}

export default async function EditSalesOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const { error, status } = await searchParams;

  const data = await loadSalesOrder(id);

  if (!data) {
    return <div className="p-6 text-destructive text-sm">Sales order not found.</div>;
  }

  const { so, lines, shipments } = data as any;

  const hasShippedShipment = (shipments as any[] | undefined)?.some((s) => (s.status as string) === "shipped");
  const hasShipments = shipments && shipments.length > 0;
  const canCancelSo = (so.status as string) !== "cancelled" && !hasShippedShipment;

  return (
    <div className="max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-1">
          <h1 className="font-semibold text-lg tracking-tight">Edit sales order</h1>
          <p className="text-muted-foreground text-sm">
            SO <span className="font-mono">{so.order_number}</span> – {so.customer_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCancelSo && (
            <form
              action={async () => {
                "use server";
                // NOTE: for a true modal confirmation, wrap this in a client component with window.confirm.
                await cancelSalesOrder(so.id as string);
              }}
            >
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-destructive px-3 py-1.5 font-medium text-[11px] text-destructive hover:bg-destructive/10"
              >
                Cancel Sales Order
              </button>
            </form>
          )}
          <form
            action={async () => {
              "use server";
              redirect(`/sales-orders/${so.id as string}/shipments`);
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
            >
              Multi-shipment
            </button>
          </form>
          {!hasShipments && so.status !== "cancelled" && (
            <form
              action={async () => {
                "use server";
                await sendAllInOneShipment(so.id as string);
              }}
            >
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
              >
                Send to warehouse as 1 shipment
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Order date</div>
            <div className="text-[11px]">{so.order_date ? new Date(so.order_date).toLocaleDateString() : "-"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Requested ship date</div>
            {so.status === "shipped" ? (
              <p className="text-[11px]">
                {so.requested_ship_date ? new Date(so.requested_ship_date).toLocaleDateString() : "-"}
              </p>
            ) : (
              <RequestedShipDateInput
                salesOrderId={so.id as string}
                defaultValue={so.requested_ship_date || ""}
                onSubmitAction={async (formData: FormData) => {
                  "use server";

                  const salesOrderId = formData.get("sales_order_id")?.toString();
                  const requestedShipDateRaw = formData.get("requested_ship_date")?.toString() || "";
                  const requestedShipDate = requestedShipDateRaw || null;

                  console.log("Update requested_ship_date action triggered");
                  console.log("salesOrderId:", salesOrderId);
                  console.log("requestedShipDateRaw:", requestedShipDateRaw);

                  if (!salesOrderId) {
                    redirect(`/sales-orders/${id}/edit?error=failed-to-update-date`);
                  }

                  const { error } = await serverSupabase
                    .from("sales_orders")
                    .update({ requested_ship_date: requestedShipDate })
                    .eq("id", salesOrderId);

                  console.log("Update result error:", error);

                  if (error) {
                    console.error("Error updating requested ship date", error);
                    redirect(`/sales-orders/${id}/edit?error=failed-to-update-date`);
                  }

                  redirect(`/sales-orders/${id}/edit`);
                }}
              />
            )}
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Status</div>
            <div className="text-[11px] capitalize">{so.status}</div>
          </div>
        </div>
        {so.notes && (
          <div className="space-y-1 pt-2">
            <div className="text-[11px] text-muted-foreground">Notes</div>
            <div className="whitespace-pre-wrap text-[11px]">{so.notes}</div>
          </div>
        )}
      </div>

      {so.status !== "shipped" && (
        <AddLineForm
          salesOrderId={so.id as string}
          error={error}
          status={status}
          action={async (formData: FormData) => {
          "use server";

          const profile = await getCurrentUserProfile();

          if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
            redirect("/unauthorized");
          }

          const soId = (formData.get("sales_order_id") || "").toString().trim();
          const sku = (formData.get("sku") || "").toString().trim();
          const skuVar = (formData.get("sku_var") || "").toString().trim();
          const qtyRaw = (formData.get("quantity_units") || "").toString().trim();

          if (!soId || !sku || !qtyRaw) {
            redirect(`/sales-orders/${id}/edit?error=missing-line-fields`);
          }

          const quantity = Number(qtyRaw);
          if (!Number.isFinite(quantity) || quantity <= 0) {
            redirect(`/sales-orders/${id}/edit?error=bad-qty`);
          }

          // Resolve product by SKU / variant, similar to PO lines
          let productQuery = serverSupabase
            .from("products")
            .select("id, sku, sku_var, product_name")
            .ilike("sku", sku);

          if (skuVar) {
            productQuery = productQuery.ilike("sku_var", skuVar);
          } else {
            productQuery = productQuery.is("sku_var", null);
          }

          const { data: product, error: prodError } = await productQuery.maybeSingle();

          if (prodError || !product) {
            console.error("Error looking up product for SO line", prodError);
            redirect(`/sales-orders/${id}/edit?error=product-not-in-catalog`);
          }

          const { error: insertError } = await serverSupabase.from("sales_order_lines").insert({
            sales_order_id: soId,
            product_id: product.id as string,
            sku: product.sku as string,
            sku_var: (product.sku_var as string) || null,
            description: (product.product_name as string) || null,
            quantity_units: quantity,
          });

          if (insertError) {
            console.error("Error inserting SO line", insertError);
            redirect(`/sales-orders/${id}/edit?error=failed-to-add-line`);
          }

          redirect(`/sales-orders/${id}/edit`);
        }}
      />
      )}

      {/* Shipments summary removed: shown on shipment page instead */}
      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="font-medium text-[11px]">Products in this order</div>
        </div>

        {lines.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No lines yet. Add the first product below.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">SKU</th>
                  <th className="px-2 py-1">Variant</th>
                  <th className="px-2 py-1">Product</th>
                  <th className="px-2 py-1 text-right">Quantity (units)</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line: any) => (
                  <tr key={line.id} className="border-b last:border-none">
                    <td className="py-1 pr-2 pl-3 font-mono text-[11px]">{line.sku}</td>
                    <td className="px-2 py-1 text-[11px]">{line.sku_var}</td>
                    <td className="px-2 py-1 text-[11px]">{line.description}</td>
                    <td className="px-2 py-1 text-right text-[11px]">
                      <LineQuantityInput
                        lineId={line.id as string}
                        defaultValue={line.quantity_units}
                        disabled={hasShippedShipment || (so.status as string) === "cancelled"}
                        onSubmitAction={async (formData: FormData) => {
                          "use server";

                          const lineId = formData.get("line_id")?.toString();
                          const qtyRaw = formData.get("quantity_units")?.toString();
                          const quantity = Number(qtyRaw);

                          if (!lineId || !Number.isFinite(quantity) || quantity <= 0) {
                            redirect(`/sales-orders/${id}/edit?error=failed-to-update-line`);
                          }

                          const { error } = await serverSupabase
                            .from("sales_order_lines")
                            .update({ quantity_units: quantity })
                            .eq("id", lineId);

                          if (error) {
                            console.error("Error updating quantity", error);
                            redirect(`/sales-orders/${id}/edit?error=failed-to-update-line`);
                          }

                          redirect(`/sales-orders/${id}/edit`);
                        }}
                      />
                    </td>
                    <td className="px-2 py-1 text-right text-[11px]">
                      <form
                        action={async (formData: FormData) => {
                          "use server";

                          const lineId = (formData.get("line_id") || "").toString().trim();
                          if (!lineId) {
                            redirect(`/sales-orders/${id}/edit?error=failed-to-delete-line`);
                          }

                          const { error: deleteError } = await serverSupabase
                            .from("sales_order_lines")
                            .delete()
                            .eq("id", lineId);

                          if (deleteError) {
                            console.error("Error deleting sales order line", deleteError);
                            redirect(`/sales-orders/${id}/edit?error=failed-to-delete-line`);
                          }

                          redirect(`/sales-orders/${id}/edit`);
                        }}
                      >
                        <input type="hidden" name="line_id" value={line.id as string} />
                        {so.status !== "shipped" && (
                          <button
                            type="submit"
                            className="inline-flex items-center rounded-md border px-2 py-0.5 font-medium text-[10px] hover:bg-muted"
                          >
                            Remove
                          </button>
                        )}
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
