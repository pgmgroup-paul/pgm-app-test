import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

interface ProcessingShipmentRow {
  id: string; // so_shipments.id
  sales_order_id: string; // sales_orders.id
  order_number: string;
  customer_name: string | null;
  ship_date: string | null;
  shipment_sequence: number;
  status: string;
}

export const dynamic = "force-dynamic";

async function loadProcessingShipments(): Promise<ProcessingShipmentRow[]> {
  const { data, error } = await serverSupabase
    .from("so_shipments")
    .select(
      `id,
       sales_order_id,
       shipment_sequence,
       status,
       sales_orders!inner(id, order_number, customer_name, requested_ship_date)`,
    )
    .eq("status", "processing");

  if (error) {
    console.error("Error loading processing shipments for /warehouse/orders-to-process", error);
    return [];
  }

  const results: ProcessingShipmentRow[] = [];

  for (const row of data || []) {
    const so = (row as any).sales_orders as any;
    if (!so || !so.id) continue;

    results.push({
      id: (row as any).id as string,
      sales_order_id: so.id as string,
      order_number: (so.order_number as string) || "",
      customer_name: (so.customer_name as string) || null,
      ship_date: (so.requested_ship_date as string) || null,
      shipment_sequence: Number((row as any).shipment_sequence) || 0,
      status: (row as any).status as string,
    });
  }

  // Sort by ship_date ascending (oldest first), then by order_number/shipment_sequence
  return results.sort((a, b) => {
    const aTime = a.ship_date ? new Date(a.ship_date).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.ship_date ? new Date(b.ship_date).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;

    const aLabel = `${a.order_number}-${a.shipment_sequence}`;
    const bLabel = `${b.order_number}-${b.shipment_sequence}`;
    return aLabel.localeCompare(bLabel);
  });
}

async function loadShipmentProgress(
  rows: ProcessingShipmentRow[],
): Promise<Map<string, { pickedItems: number; totalItems: number }>> {
  const result = new Map<string, { pickedItems: number; totalItems: number }>();
  if (rows.length === 0) return result;

  const supabase = serverSupabase;

  const shipmentIds = rows.map((r) => r.id);
  const orderNumbers = Array.from(new Set(rows.map((r) => r.order_number).filter(Boolean)));

  // Load shipment lines for these shipments
  const { data: lineRows, error: lineError } = await supabase
    .from("so_shipment_lines")
    .select("so_shipment_id, product_id, quantity_shipped_units")
    .in("so_shipment_id", shipmentIds);

  if (lineError) {
    console.error("Error loading shipment lines for progress", lineError);
    return result;
  }

  const shipmentLines = (lineRows || []) as any[];
  const productIds = Array.from(new Set(shipmentLines.map((r) => (r.product_id as string) || "").filter(Boolean)));

  // Load units_per_case from product_dimensions
  const unitsPerCaseByProduct = new Map<string, number>();

  if (productIds.length > 0) {
    const { data: dims, error: dimsError } = await supabase
      .from("product_dimensions")
      .select("product_id, kind, units_per")
      .in("product_id", productIds);

    if (dimsError) {
      console.error("Error loading product_dimensions for progress", dimsError);
    }

    for (const d of dims || []) {
      const pid = (d as any).product_id as string;
      const kind = (d as any).kind as string | undefined;
      const u = Number((d as any).units_per) || 0;
      if (!pid || u <= 0) continue;

      const isCaseLike = kind === "case" || kind === "package" || kind === "carton";
      const existing = unitsPerCaseByProduct.get(pid) || 0;

      if (existing <= 0 || (isCaseLike && existing !== u)) {
        unitsPerCaseByProduct.set(pid, u);
      }
    }
  }

  // Load deducted quantities per order/product via inventory_movements
  const deductedCasesByOrderProduct = new Map<string, number>();

  if (orderNumbers.length > 0 && productIds.length > 0) {
    const { data: moves, error: movesError } = await supabase
      .from("inventory_movements")
      .select("order_number, product_id, quantity_cases, movement_type, reason")
      .in("order_number", orderNumbers)
      .eq("movement_type", "deduct")
      .eq("reason", "order")
      .in("product_id", productIds);

    if (movesError) {
      console.error("Error loading inventory_movements for progress", movesError);
    }

    for (const m of moves || []) {
      const ord = (m as any).order_number as string;
      const pid = (m as any).product_id as string;
      const qtyCases = Number((m as any).quantity_cases) || 0;
      if (!ord || !pid || qtyCases <= 0) continue;
      const key = `${ord}::${pid}`;
      deductedCasesByOrderProduct.set(key, (deductedCasesByOrderProduct.get(key) || 0) + qtyCases);
    }
  }

  // Compute picked/total per shipment
  const rowsByShipment = new Map<string, any[]>();
  for (const line of shipmentLines) {
    const sid = (line as any).so_shipment_id as string;
    if (!sid) continue;
    const arr = rowsByShipment.get(sid) || [];
    arr.push(line);
    rowsByShipment.set(sid, arr);
  }

  for (const shipment of rows) {
    const sid = shipment.id;
    const lines = rowsByShipment.get(sid) || [];
    if (lines.length === 0) {
      result.set(sid, { pickedItems: 0, totalItems: 0 });
      continue;
    }

    let pickedItems = 0;
    const totalItems = lines.length;

    for (const line of lines) {
      const pid = (line as any).product_id as string;
      const qtyUnits = Number((line as any).quantity_shipped_units) || 0;
      const unitsPerCase = unitsPerCaseByProduct.get(pid) || 0;
      const casesRequired = unitsPerCase > 0 ? Math.ceil(qtyUnits / unitsPerCase) : 0;
      const key = `${shipment.order_number}::${pid}`;
      const casesPicked = deductedCasesByOrderProduct.get(key) || 0;
      const casesRemaining = Math.max(casesRequired - casesPicked, 0);

      if (casesRemaining <= 0 && casesRequired > 0) {
        pickedItems += 1;
      }
    }

    result.set(sid, { pickedItems, totalItems });
  }

  return result;
}

export default async function WarehouseOrdersToProcessPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;

  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/auth/v1/login");
  }

  const rows = await loadProcessingShipments();
  const progressMap = await loadShipmentProgress(rows);

  const isReadyMessage = (sp?.ready as string | undefined) === "1";

  return (
    <div className="max-w-4xl space-y-4 p-6">
      {isReadyMessage && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-800 text-xs">
          Order marked as ready
        </div>
      )}
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Orders to process</h1>
        <p className="text-muted-foreground text-sm">
          Sales order shipments that are currently being processed by the warehouse and still require picking.
        </p>
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="font-medium text-[11px]">Processing shipments</div>

        {rows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">There are no sales order shipments in processing status.</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-[11px]">
                <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2 pl-3">Order</th>
                    <th className="px-2 py-1">Ship Date</th>
                    <th className="px-2 py-1 text-right">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const progress = progressMap.get(row.id) || { pickedItems: 0, totalItems: 0 };
                    const completed = progress.totalItems > 0 && progress.pickedItems >= progress.totalItems;

                    return (
                      <tr key={row.id} className="border-b last:border-none">
                        <td className="py-1 pr-2 pl-3 text-[11px]">
                          <a
                            href={`/warehouse/orders-to-process/${row.id}`}
                            className="font-mono text-[11px] text-primary hover:underline"
                          >
                            {row.order_number}-{row.shipment_sequence}
                          </a>
                        </td>
                        <td className="px-2 py-1 text-[11px]">
                          {row.ship_date ? row.ship_date : <span className="text-muted-foreground">(no date)</span>}
                        </td>
                        <td className="px-2 py-1 text-right text-[11px]">
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <span>
                              {progress.pickedItems} / {progress.totalItems}
                            </span>
                            {completed && <span className="text-emerald-600">✓</span>}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {rows.map((row) => {
                const progress = progressMap.get(row.id) || { pickedItems: 0, totalItems: 0 };
                const completed = progress.totalItems > 0 && progress.pickedItems >= progress.totalItems;

                return (
                  <a
                    key={row.id}
                    href={`/warehouse/orders-to-process/${row.id}`}
                    className="block rounded-lg border bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-baseline justify-between">
                      <div className="font-mono font-semibold text-primary text-sm">
                        {row.order_number}-{row.shipment_sequence}
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Ship date: {row.ship_date ? row.ship_date : "(no date)"}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 text-[11px]">
                      <span className="font-medium">Progress</span>
                      <span>
                        {progress.pickedItems} / {progress.totalItems}
                      </span>
                      {completed && <span className="text-emerald-600">✓</span>}
                    </div>
                  </a>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
