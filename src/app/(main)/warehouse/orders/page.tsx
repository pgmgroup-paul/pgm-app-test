import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

async function markShipmentReady(shipmentId: string) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/auth/v1/login");
  }

  if (!shipmentId) return;

  const { error } = await serverSupabase.from("so_shipments").update({ status: "ready" }).eq("id", shipmentId);

  if (error) {
    console.error("Error marking shipment ready on /warehouse/orders", error);
  }

  // Redirect back to this page with a status flag so we can show feedback
  redirect(`/warehouse/orders?so_id=${shipmentId}&status=ready`);
}

interface ProcessingSalesOrder {
  id: string; // so_shipments.id
  sales_order_id: string; // sales_orders.id
  order_number: string;
  shipment_sequence: number;
  label: string; // e.g. SO10002-2
}

interface OrderLineRow {
  id: string;
  sku: string;
  sku_var: string | null;
  product_name: string;
  quantity_units: number; // ordered / allocated units for this shipment line
  cases_picked: number; // cases deducted for this product/order
  single_units: number; // loose units deducted via dropship overflow
  units_per_case: number; // from products
  total_units_picked: number; // (cases_picked * units_per_case) + single_units
}

async function loadProcessingSalesOrders(): Promise<ProcessingSalesOrder[]> {
  const { data, error } = await serverSupabase
    .from("so_shipments")
    .select(
      `id,
       shipment_sequence,
       status,
       sales_orders!inner(id, order_number)`,
    )
    .eq("status", "processing");

  if (error) {
    console.error("Error loading processing sales orders for warehouse /orders", error);
    return [];
  }

  const results: ProcessingSalesOrder[] = [];
  for (const row of data || []) {
    const so = (row as any).sales_orders as any;
    if (!so || !so.id) continue;
    const shipmentId = (row as any).id as string;
    const soId = so.id as string;
    const orderNumber = (so.order_number as string) || "";
    const shipmentSeq = Number((row as any).shipment_sequence) || 0;
    const label = shipmentSeq > 0 ? `${orderNumber}-${shipmentSeq}` : orderNumber;

    results.push({
      id: shipmentId,
      sales_order_id: soId,
      order_number: orderNumber,
      shipment_sequence: shipmentSeq,
      label,
    });
  }

  // Sort by label ascending for stable dropdown
  return results.sort((a, b) => a.label.localeCompare(b.label));
}

async function loadShipmentLines(shipmentId: string, orderNumber: string): Promise<OrderLineRow[]> {
  const { data, error } = await serverSupabase
    .from("so_shipment_lines")
    .select(
      `id,
       product_id,
       quantity_shipped_units,
       products!inner(sku, sku_var, product_name)`,
    )
    .eq("so_shipment_id", shipmentId);

  if (error) {
    console.error("Error loading shipment lines for warehouse /orders", error);
    return [];
  }

  const linesRaw = (data || []) as any[];

  const productIds = Array.from(new Set(linesRaw.map((row) => (row.product_id as string) || "").filter(Boolean)));

  const casesPickedByProduct = new Map<string, number>();
  const dropshipUnitsByProduct = new Map<string, number>();
  const unitsPerCaseByProduct = new Map<string, number>();

  if (productIds.length > 0) {
    // Load units_per (units per case) from product_dimensions (case/package rows)
    const { data: dims, error: dimsError } = await serverSupabase
      .from("product_dimensions")
      .select("product_id, kind, units_per")
      .in("product_id", productIds);

    if (dimsError) {
      console.error("Error loading product_dimensions for /warehouse/orders", dimsError);
    }

    for (const d of dims || []) {
      const pid = (d as any).product_id as string;
      const kind = (d as any).kind as string | undefined;
      const u = Number((d as any).units_per) || 0;
      if (!pid || u <= 0) continue;

      // Prefer case/package rows for units_per when available
      const isCaseLike = kind === "case" || kind === "package" || kind === "carton";
      const existing = unitsPerCaseByProduct.get(pid) || 0;

      if (existing <= 0 || (isCaseLike && existing !== u)) {
        unitsPerCaseByProduct.set(pid, u);
      }
    }

    if (orderNumber) {
      // Cases picked: standard order deductions in cases
      const { data: moves, error: movesError } = await serverSupabase
        .from("inventory_movements")
        .select("product_id, quantity_cases, movement_type, reason, order_number")
        .in("product_id", productIds)
        .eq("order_number", orderNumber)
        .eq("movement_type", "deduct")
        .eq("reason", "order");

      if (movesError) {
        console.error("Error loading inventory_movements for cases picked on /warehouse/orders", movesError);
      }

      for (const m of moves || []) {
        const pid = (m as any).product_id as string;
        const qtyCases = Number((m as any).quantity_cases) || 0;
        if (!pid || qtyCases <= 0) continue;
        casesPickedByProduct.set(pid, (casesPickedByProduct.get(pid) || 0) + qtyCases);
      }

      // Single units: dropship overflow moves recorded in dropship_transfers
      const { data: dropshipRows, error: dropshipError } = await serverSupabase
        .from("dropship_transfers")
        .select("product_id, quantity, unit, source_type, source_shipment_id")
        .in("product_id", productIds)
        .eq("source_type", "order_leftover")
        .eq("source_shipment_id", shipmentId);

      if (dropshipError) {
        console.error("Error loading dropship_transfers for single units on /warehouse/orders", dropshipError);
      }

      for (const row of dropshipRows || []) {
        const pid = (row as any).product_id as string;
        const qty = Number((row as any).quantity) || 0;
        const unit = (row as any).unit as string | undefined;
        if (!pid || qty <= 0) continue;

        // If stored in cases, convert to units using units_per_case; otherwise treat as pieces
        if (unit === "cases") {
          const uPer = unitsPerCaseByProduct.get(pid) || 0;
          const units = uPer > 0 ? qty * uPer : 0;
          if (units > 0) {
            dropshipUnitsByProduct.set(pid, (dropshipUnitsByProduct.get(pid) || 0) + units);
          }
        } else {
          // default: pieces
          dropshipUnitsByProduct.set(pid, (dropshipUnitsByProduct.get(pid) || 0) + qty);
        }
      }
    }
  }

  return linesRaw.map((row: any) => {
    const p = row.products as any;
    const pid = row.product_id as string;
    const unitsPerCase = unitsPerCaseByProduct.get(pid) || 0;
    const casesPicked = casesPickedByProduct.get(pid) || 0;
    const dropshipUnits = dropshipUnitsByProduct.get(pid) || 0;

    // Single units rule:
    // Single units = case_pack_for_product - pieces_sent_to_dropship_overflow_for_that_SO
    // but only when we actually have dropship overflow; otherwise 0
    let singleUnits = 0;
    if (dropshipUnits > 0 && unitsPerCase > 0) {
      const rawSingleUnits = unitsPerCase - dropshipUnits;
      singleUnits = rawSingleUnits > 0 ? rawSingleUnits : 0;
    }

    // Total Units picked = (Cases picked * units_per_case)
    //                       - pieces_sent_to_dropship_overflow_for_that_SO
    const totalUnitsPicked = casesPicked * unitsPerCase - dropshipUnits;

    return {
      id: row.id as string,
      sku: (p?.sku as string) || "",
      sku_var: (p?.sku_var as string) || null,
      product_name: (p?.product_name as string) || "",
      quantity_units: Number(row.quantity_shipped_units) || 0,
      cases_picked: casesPicked,
      single_units: singleUnits,
      units_per_case: unitsPerCase,
      total_units_picked: totalUnitsPicked,
    };
  });
}

export default async function WarehouseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ so_id?: string; shipmentId?: string; status?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/auth/v1/login");
  }

  const { so_id, shipmentId, status } = await searchParams;

  const salesOrders = await loadProcessingSalesOrders();
  const initialId = shipmentId || so_id;
  const selectedShipmentId = initialId && salesOrders.some((so) => so.id === initialId) ? initialId : "";

  const selectedEntry = selectedShipmentId ? salesOrders.find((so) => so.id === selectedShipmentId) : undefined;

  const orderLines: OrderLineRow[] = selectedEntry
    ? await loadShipmentLines(selectedEntry.id, selectedEntry.order_number)
    : [];

  const allLinesReady =
    orderLines.length > 0 && orderLines.every((line) => line.total_units_picked === line.quantity_units);

  const selectedSoId = selectedShipmentId; // backward-compat alias for JSX below

  return (
    <div className="max-w-3xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Order Progress</h1>
        <p className="text-muted-foreground text-sm">Verify the progress of an order.</p>
        {status === "ready" && <p className="text-[11px] text-emerald-700">Order marked as ready</p>}
      </div>

      <form method="GET" className="max-w-sm space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="space-y-1">
          <label htmlFor="so_id" className="font-medium text-[11px]">
            Sales Order
          </label>
          <select
            id="so_id"
            name="so_id"
            defaultValue={selectedSoId}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select a processing order…</option>
            {salesOrders.map((so) => (
              <option key={so.id} value={so.id}>
                {so.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
        >
          Load order
        </button>
      </form>

      {/* Order lines table */}
      {selectedSoId && (
        <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
          <div className="font-medium text-[11px]">Order lines</div>

          {orderLines.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No lines found for this shipment.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1">SKU/Var</th>
                      <th className="px-2 py-1">Product name</th>
                      <th className="px-2 py-1 text-right">Qty Ordered</th>
                      <th className="px-2 py-1 text-right">Cases picked</th>
                      <th className="px-2 py-1 text-right">Single units</th>
                      <th className="px-2 py-1 text-right">Total Units picked</th>
                      <th className="px-2 py-1 text-right">Ready</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderLines.map((line) => (
                      <tr key={line.id} className="border-b last:border-none">
                        <td className="px-2 py-1 font-mono text-[11px]">
                          {line.sku}
                          {line.sku_var ? ` / ${line.sku_var}` : ""}
                        </td>
                        <td className="px-2 py-1 text-[11px]">{line.product_name}</td>
                        <td className="px-2 py-1 text-right text-[11px]">{line.quantity_units}</td>
                        <td className="px-2 py-1 text-right text-[11px]">{line.cases_picked}</td>
                        <td className="px-2 py-1 text-right text-[11px]">{line.single_units}</td>
                        <td className="px-2 py-1 text-right text-[11px]">{line.total_units_picked}</td>
                        <td className="px-2 py-1 text-right text-[11px]">
                          {line.total_units_picked === line.quantity_units ? (
                            <span className="font-semibold text-emerald-700">✔</span>
                          ) : (
                            <span className="text-muted-foreground">Not ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-3">
                <form
                  action={async () => {
                    "use server";
                    if (!selectedShipmentId || !allLinesReady) return;
                    await markShipmentReady(selectedShipmentId);
                  }}
                >
                  <button
                    type="submit"
                    disabled={!allLinesReady}
                    className="inline-flex items-center rounded-md border px-3 py-1.5 font-medium text-[11px] hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Mark order Ready
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
