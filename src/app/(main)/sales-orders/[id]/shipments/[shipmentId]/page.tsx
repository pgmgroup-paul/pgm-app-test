import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

import { allocateUnitsToShipment, deleteShipmentFromShipmentPage, sendShipmentToWarehouse } from "./actions";

export const dynamic = "force-dynamic";

async function loadShipmentView(salesOrderId: string, shipmentId: string) {
  const { data: shipment, error: shipError } = await serverSupabase
    .from("so_shipments")
    .select(
      `id,
       sales_order_id,
       shipment_sequence,
       carrier_name,
       tracking_number,
       ship_date,
       status,
       sales_orders!inner(order_number, customer_name)`,
    )
    .eq("id", shipmentId)
    .maybeSingle();

  if (shipError || !shipment || (shipment.sales_order_id as string) !== salesOrderId) {
    console.error("Error loading shipment for SO", shipError);
    return null;
  }

  const { data: soLines, error: soLinesError } = await serverSupabase
    .from("sales_order_lines")
    .select("id, product_id, sku, sku_var, description, quantity_units")
    .eq("sales_order_id", salesOrderId)
    .order("created_at", { ascending: true });

  if (soLinesError) {
    console.error("Error loading SO lines for shipment view", soLinesError);
    return null;
  }

  const soLineIds = (soLines ?? []).map((l) => l.id as string);

  const { data: shippedAgg, error: shippedError } = await serverSupabase
    .from("so_shipment_lines")
    .select("sales_order_line_id, quantity_shipped_units")
    .in("sales_order_line_id", soLineIds);

  if (shippedError) {
    console.error("Error loading shipped aggregates", shippedError);
    return null;
  }

  const shippedMap = new Map<string, number>();
  for (const row of shippedAgg || []) {
    const lineId = row.sales_order_line_id as string;
    const qty = Number(row.quantity_shipped_units) || 0;
    shippedMap.set(lineId, (shippedMap.get(lineId) || 0) + qty);
  }

  const lines = (soLines || []).map((l: any) => {
    const ordered = Number(l.quantity_units) || 0;
    const shipped = shippedMap.get(l.id as string) || 0;
    const remaining = Math.max(ordered - shipped, 0);

    return {
      sales_order_line_id: l.id as string,
      product_id: l.product_id as string,
      sku: (l.sku as string) || "",
      sku_var: (l.sku_var as string) || null,
      description: (l.description as string) || "",
      ordered_units: ordered,
      shipped_units: shipped,
      remaining_units: remaining,
    };
  });

  // Load all shipments for this SO with shipment totals
  const { data: shipments, error: shipmentsError } = await serverSupabase
    .from("so_shipments")
    .select("id, shipment_sequence, status")
    .eq("sales_order_id", shipment.sales_order_id)
    .order("shipment_sequence", { ascending: true });

  if (shipmentsError) {
    console.error("Error loading shipments for SO", shipmentsError);
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

  // Load contents of this specific shipment (lines for this shipment only)
  const { data: shipmentContentsRaw, error: contentsError } = await serverSupabase
    .from("so_shipment_lines")
    .select(
      `id,
       sales_order_line_id,
       quantity_shipped_units,
       sales_order_lines!inner(sku, sku_var, description)`,
    )
    .eq("so_shipment_id", shipment.id);

  if (contentsError) {
    console.error("Error loading contents for shipment", contentsError);
  }

  const shipmentContents = (shipmentContentsRaw || []).map((row: any) => {
    const line = row.sales_order_lines as any;
    return {
      id: row.id as string,
      sales_order_line_id: row.sales_order_line_id as string,
      sku: (line?.sku as string) || "",
      sku_var: (line?.sku_var as string) || null,
      description: (line?.description as string) || "",
      quantity_units: Number(row.quantity_shipped_units) || 0,
    };
  });

  return { shipment, lines, shipments: shipmentsWithTotals, shipmentContents };
}

export default async function SalesOrderShipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; shipmentId: string }>;
  searchParams: Promise<{ status?: string; mode?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  const { id: salesOrderId, shipmentId } = await params;
  const { status, mode } = await searchParams;

  const data = await loadShipmentView(salesOrderId, shipmentId);

  if (!data) {
    return <div className="p-6 text-destructive text-sm">Shipment not found.</div>;
  }

  const { shipment, lines, shipments, shipmentContents } = data as any;
  const soHeader = shipment.sales_orders as any | null;
  const soNumber = soHeader?.order_number as string | undefined;
  const soCustomer = soHeader?.customer_name as string | undefined;

  const showShipmentsList = mode === "list";
  const showLinesEditor = shipment.status === "planned";

  return (
    <div className="max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-semibold text-lg tracking-tight">Shipment</h1>
          <p className="text-muted-foreground text-sm">
            SO <span className="font-mono">{soNumber ?? salesOrderId}</span>
            {soCustomer && <span> – {soCustomer}</span>} • Shipment {shipment.shipment_sequence} — {shipment.status}
          </p>
          {status === "allocated" && <p className="text-[11px] text-emerald-700">Units allocated to this shipment.</p>}
          {status === "sent-to-warehouse" && (
            <p className="text-[11px] text-emerald-700">Shipment sent to warehouse and is now processing.</p>
          )}
          {status === "no-lines" && (
            <p className="text-[11px] text-destructive">
              You must allocate at least one line before sending this shipment to the warehouse.
            </p>
          )}
          {status === "packing-error" && (
            <p className="text-[11px] text-destructive">
              There was an error sending this shipment to the warehouse. Check server logs for details.
            </p>
          )}
          {status === "bad-qty" && <p className="text-[11px] text-destructive">Quantity must be a positive number.</p>}
          {status === "over-allocate" && (
            <p className="text-[11px] text-destructive">
              Cannot allocate more units than remaining on the sales order.
            </p>
          )}
          {status === "duplicate-line" && (
            <p className="text-[11px] text-destructive">
              This line is already allocated to this shipment. Delete it above before changing the quantity.
            </p>
          )}
          {status === "alloc-error" && (
            <p className="text-[11px] text-destructive">
              There was an error allocating units. Check the console/logs for details.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {shipmentContents.length > 0 && shipment.status === "planned" && (
            <form
              action={async () => {
                "use server";
                await sendShipmentToWarehouse(salesOrderId, shipment.id as string);
              }}
            >
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
              >
                Send to warehouse
              </button>
            </form>
          )}
          <a
            href={`/sales-orders/${salesOrderId}/edit`}
            className="inline-flex items-center rounded-md border px-3 py-1.5 font-medium text-[11px] hover:bg-muted"
          >
            Close
          </a>
        </div>
      </div>

      {showLinesEditor && (
        <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-medium text-[11px]">Products to add in this shipment</div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Enter quantities to add products from the order to this shipment.
          </p>

          {lines.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No lines for this sales order.</p>
          ) : (
            <form
              action={async (formData: FormData) => {
                "use server";
                await allocateUnitsToShipment(salesOrderId, shipmentId, formData);
              }}
              className="space-y-2"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2 pl-3">SKU</th>
                      <th className="px-2 py-1">Variant</th>
                      <th className="px-2 py-1">Product</th>
                      <th className="px-2 py-1 text-right">Ordered (units)</th>
                      <th className="px-2 py-1 text-right">Shipped (units)</th>
                      <th className="px-2 py-1 text-right">Remaining (units)</th>
                      <th className="px-2 py-1 text-right">Allocate (units)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l: any) => (
                      <tr key={l.sales_order_line_id} className="border-b last:border-none">
                        <td className="py-1 pr-2 pl-3 font-mono text-[11px]">{l.sku}</td>
                        <td className="px-2 py-1 text-[11px]">{l.sku_var}</td>
                        <td className="px-2 py-1 text-[11px]">{l.description}</td>
                        <td className="px-2 py-1 text-right text-[11px]">{l.ordered_units}</td>
                        <td className="px-2 py-1 text-right text-[11px]">{l.shipped_units}</td>
                        <td className="px-2 py-1 text-right text-[11px]">{l.remaining_units}</td>
                        <td className="px-2 py-1 text-right text-[11px]">
                          <input
                            type="number"
                            name={`allocate_${l.sales_order_line_id}`}
                            min={0}
                            max={l.remaining_units}
                            className="w-24 rounded-md border border-input bg-background px-2 py-0.5 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
                >
                  Allocate units
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Inventory to send in this shipment */}
      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="font-medium text-[11px]">Products in this shipment</div>
        {!shipmentContents || shipmentContents.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No lines have been allocated to this shipment yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">SKU</th>
                  <th className="px-2 py-1">Variant</th>
                  <th className="px-2 py-1">Product</th>
                  <th className="px-2 py-1 text-right">Units allocated</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shipmentContents.map((row: any) => (
                  <tr key={row.id} className="border-b last:border-none">
                    <td className="py-1 pr-2 pl-3 font-mono text-[11px]">{row.sku}</td>
                    <td className="px-2 py-1 text-[11px]">{row.sku_var}</td>
                    <td className="px-2 py-1 text-[11px]">{row.description}</td>
                    <td className="px-2 py-1 text-right text-[11px]">{row.quantity_units}</td>
                    <td className="px-2 py-1 text-right text-[11px]">
                      <form
                        action={async () => {
                          "use server";
                          // delete a single allocation row
                          const profile = await getCurrentUserProfile();
                          if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
                            redirect("/unauthorized");
                          }

                          const { error } = await serverSupabase
                            .from("so_shipment_lines")
                            .delete()
                            .eq("id", row.id as string);

                          if (error) {
                            console.error("Error deleting allocation row", error);
                          }

                          redirect(`/sales-orders/${salesOrderId}/shipments/${shipmentId}`);
                        }}
                        className="inline-block"
                      >
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-md border border-destructive px-2 py-0.5 text-[10px] text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shipments list is for planning and for list mode */}
      {showShipmentsList && (
        <>
          {/* Shipments for this order */}
          <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
            <div className="font-medium text-[11px]">Shipments for this order</div>
            {!shipments || shipments.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No shipments created yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2 pl-3">Shipment</th>
                      <th className="px-2 py-1">Status</th>
                      <th className="px-2 py-1 text-right">Total shipped (units)</th>
                      <th className="px-2 py-1 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.map((s: any) => (
                      <tr key={s.id} className="border-b last:border-none">
                        <td className="py-1 pr-2 pl-3 text-[11px]">
                          Shipment {s.shipment_sequence}
                          {s.id === shipment.id && " (this)"}
                        </td>
                        <td className="px-2 py-1 text-[11px] capitalize">{s.status}</td>
                        <td className="px-2 py-1 text-right text-[11px]">{s.total_shipped_units}</td>
                        <td className="space-x-1 px-2 py-1 text-right text-[11px]">
                          <a
                            href={`/sales-orders/${shipment.sales_order_id as string}/shipments/${s.id}?mode=contents`}
                            className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted"
                          >
                            View
                          </a>
                          {s.status === "planned" && s.id !== shipment.id && (
                            <form
                              action={async () => {
                                "use server";
                                await deleteShipmentFromShipmentPage(
                                  shipment.sales_order_id as string,
                                  s.id as string,
                                  shipment.id as string,
                                );
                              }}
                              className="inline-block"
                            >
                              <button
                                type="submit"
                                className="inline-flex items-center rounded-md border border-destructive px-2 py-0.5 text-[10px] text-destructive hover:bg-destructive/10"
                              >
                                Delete
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
