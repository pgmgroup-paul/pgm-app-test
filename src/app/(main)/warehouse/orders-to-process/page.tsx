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

export default async function WarehouseOrdersToProcessPage() {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/auth/v1/login");
  }

  const rows = await loadProcessingShipments();

  return (
    <div className="max-w-4xl space-y-4 p-6">
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">Order</th>
                  <th className="px-2 py-1">Ship Date</th>
                  <th className="px-2 py-1 text-right">Progress</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
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
                      <a
                        href={`/warehouse/orders?shipmentId=${row.id}`}
                        className="inline-flex items-center font-medium text-[11px] text-primary hover:underline"
                      >
                        View progress
                      </a>
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
