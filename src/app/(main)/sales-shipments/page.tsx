import Link from "next/link";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";
import { markShipmentAsShipped } from "./mark-shipped";
import { cancelShipment } from "./cancel-shipment";

export const dynamic = "force-dynamic";

type ShipmentStatusFilter = string;

interface ReadyShipmentRow {
  id: string; // shipment id
  sales_order_id: string;
  shipment_sequence: number;
  status: string;
  order_number: string;
  customer_name: string | null;
  requested_ship_date: string | null;
}

async function loadShipmentsByStatus(statusFilter: ShipmentStatusFilter): Promise<ReadyShipmentRow[]> {
  let query = serverSupabase
    .from("so_shipments")
    .select(
      `id,
       sales_order_id,
       shipment_sequence,
       status,
       sales_orders!inner(order_number, customer_name, requested_ship_date)`
    )
    .order("created_at", { ascending: true });

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error loading ready shipments", error);
    return [];
  }

  const rows = (data || []) as any[];

  return rows.map((row) => {
    const so = (row as any).sales_orders as any;
    return {
      id: row.id as string,
      sales_order_id: row.sales_order_id as string,
      shipment_sequence: Number(row.shipment_sequence) || 0,
      status: row.status as string,
      order_number: (so?.order_number as string) || (row.sales_order_id as string),
      customer_name: (so?.customer_name as string) || null,
      requested_ship_date: (so?.requested_ship_date as string) || null,
    } satisfies ReadyShipmentRow;
  });
}

export default async function ReadyShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return <div className="p-6 text-destructive text-sm">Not authorized.</div>;
  }

  const { status } = await searchParams;

  // Load distinct statuses from so_shipments for the Status dropdown
  const { data: statusRows, error: statusError } = await serverSupabase
    .from("so_shipments")
    .select("status")
    .not("status", "is", null);

  if (statusError) {
    console.error("Error loading shipment statuses for filter", statusError);
  }

  const distinctStatuses = Array.from(
    new Set(
      (statusRows || [])
        .map((row: any) => (row.status as string | null) || "")
        .filter((s: string) => s.trim().length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const allowedStatusFilters = new Set<string>(["all", ...distinctStatuses]);

  const statusFilter: ShipmentStatusFilter =
    status && allowedStatusFilters.has(status) ? status : "ready";

  const shipments = await loadShipmentsByStatus(statusFilter);

  return (
    <div className="max-w-4xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Shipments</h1>
        <p className="text-muted-foreground text-sm">Sales order shipments by status.</p>
      </div>

      {/* Status filter */}
      <form
        method="GET"
        action="/sales-shipments"
        className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2 text-[11px] sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="space-y-1 sm:w-48">
            <label htmlFor="status" className="text-[11px] text-muted-foreground">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={statusFilter}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All</option>
              {distinctStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 sm:w-40">
          <button
            type="submit"
            className="inline-flex items-center rounded-md border px-3 py-1 font-medium text-[11px] hover:bg-muted"
          >
            Apply
          </button>
          <a
            href="/sales-shipments"
            className="inline-flex items-center rounded-md border px-3 py-1 font-medium text-[11px] hover:bg-muted"
          >
            Clear
          </a>
        </div>
      </form>

      <div className="space-y-1" />

      {shipments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {statusFilter === "ready" && "No shipments ready to ship."}
          {statusFilter === "shipped" && "No shipped shipments found."}
          {statusFilter === "all" && "No shipments found."}
        </p>
      ) : (
        <div className="rounded-md border px-3 py-3 text-xs">
          <div className="font-medium text-[11px] mb-1">Shipments</div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">Shipment</th>
                  <th className="px-2 py-1">Order</th>
                  <th className="px-2 py-1">Customer</th>
                  <th className="px-2 py-1">Ship date</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.id} className="border-b last:border-none">
                    <td className="py-1 pr-2 pl-3 font-mono text-[11px]">
                      <Link href={`/sales-orders/${s.sales_order_id}/shipments/${s.id}`} className="text-primary hover:underline">
                        {s.order_number}-{s.shipment_sequence}
                      </Link>
                    </td>
                    <td className="px-2 py-1 font-mono text-[11px]">
                      <Link href={`/sales-orders/${s.sales_order_id}/edit`} className="text-primary hover:underline">
                        {s.order_number}
                      </Link>
                    </td>
                    <td className="px-2 py-1 text-[11px]">{s.customer_name ?? "-"}</td>
                    <td className="px-2 py-1 text-[11px]">
                      {s.requested_ship_date
                        ? new Date(s.requested_ship_date).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-2 py-1 text-[11px] capitalize">{s.status}</td>
                    <td className="px-2 py-1 text-right space-x-1">
                      {s.status === "ready" && (
                        <form
                          action={async () => {
                            "use server";
                            await markShipmentAsShipped(s.id);
                          }}
                          className="inline-block"
                        >
                          <button
                            type="submit"
                            className="inline-flex items-center rounded-md border px-2 py-1 text-[10px] hover:bg-muted"
                          >
                            Mark as shipped
                          </button>
                        </form>
                      )}
                      {(s.status === "processing" || s.status === "ready") && (
                        <form
                          action={async () => {
                            "use server";
                            await cancelShipment(s.id);
                          }}
                          className="inline-block"
                        >
                          <button
                            type="submit"
                            className="inline-flex items-center rounded-md border border-destructive px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10"
                          >
                            Cancel shipment
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
