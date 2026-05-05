import Link from "next/link";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";
import { markShipmentAsShipped } from "./mark-shipped";
import { cancelShipment } from "./cancel-shipment";

export const dynamic = "force-dynamic";

type ShipmentStatusFilter = "ready" | "processing" | "shipped" | "all";

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

  if (statusFilter === "ready" || statusFilter === "processing" || statusFilter === "shipped") {
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

  const statusFilter: ShipmentStatusFilter =
    status === "ready" || status === "processing" || status === "shipped" || status === "all"
      ? (status as ShipmentStatusFilter)
      : "ready";

  const shipments = await loadShipmentsByStatus(statusFilter);

  return (
    <div className="max-w-4xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Shipments</h1>
        <p className="text-muted-foreground text-sm">Sales order shipments by status.</p>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-md border bg-muted p-0.5 text-[11px]">
        <a
          href="/sales-shipments?status=ready"
          className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
            statusFilter === "ready" ? "bg-background text-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Ready
        </a>
        <a
          href="/sales-shipments?status=processing"
          className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
            statusFilter === "processing" ? "bg-background text-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Processing
        </a>
        <a
          href="/sales-shipments?status=shipped"
          className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
            statusFilter === "shipped" ? "bg-background text-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Shipped
        </a>
        <a
          href="/sales-shipments?status=all"
          className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
            statusFilter === "all" ? "bg-background text-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          All
        </a>
      </div>

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
