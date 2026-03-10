import Link from "next/link";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

type ShipmentStatus = "planned" | "booked" | "on_water" | "arrived" | "delivered" | "cancelled";

type SortKey = "etd_asc" | "etd_desc" | "eta_asc" | "eta_desc" | "created_desc";

interface ShipmentRow {
  id: string;
  shipment_number: string;
  status: ShipmentStatus;
  origin_port: string | null;
  destination_port: string | null;
  etd: string | null;
  eta: string | null;
  created_at: string | null;
}

interface LoadOptions {
  search?: string;
  status?: ShipmentStatus | "all";
  sort?: SortKey;
}

async function loadShipments({ search, status = "all", sort = "etd_asc" }: LoadOptions): Promise<ShipmentRow[]> {
  let query = serverSupabase
    .from("shipments")
    .select("id, shipment_number, status, origin_port, destination_port, etd, eta, created_at");

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`shipment_number.ilike.${term},origin_port.ilike.${term},destination_port.ilike.${term}`);
  }

  switch (sort) {
    case "etd_desc":
      query = query.order("etd", { ascending: false });
      break;
    case "eta_asc":
      query = query.order("eta", { ascending: true });
      break;
    case "eta_desc":
      query = query.order("eta", { ascending: false });
      break;
    case "created_desc":
      query = query.order("created_at", { ascending: false });
      break;
    default:
      query = query.order("etd", { ascending: true });
      break;
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error loading shipments", error);
    return [];
  }

  return (data ?? []).map((s) => ({
    id: s.id as string,
    shipment_number: (s.shipment_number as string) || "",
    status: (s.status as ShipmentStatus) || "planned",
    origin_port: (s.origin_port as string) || null,
    destination_port: (s.destination_port as string) || null,
    etd: (s.etd as string) || null,
    eta: (s.eta as string) || null,
    created_at: (s.created_at as string) || null,
  }));
}

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return <div className="p-6 text-destructive text-sm">Not authorized.</div>;
  }

  const { q, status, sort } = await searchParams;

  const statusFilter: ShipmentStatus | "all" =
    status === "planned" ||
    status === "booked" ||
    status === "on_water" ||
    status === "arrived" ||
    status === "delivered" ||
    status === "cancelled"
      ? (status as ShipmentStatus)
      : "all";

  const sortKey: SortKey =
    sort === "etd_desc" || sort === "eta_asc" || sort === "eta_desc" || sort === "created_desc"
      ? (sort as SortKey)
      : "etd_asc";

  const shipments = await loadShipments({
    search: q,
    status: statusFilter,
    sort: sortKey,
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-semibold text-2xl tracking-tight">Shipments</h1>
          <p className="text-muted-foreground text-sm">Plan and track shipments that group containers and POs.</p>
        </div>
        <Link
          href="/shipments/new"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-xs hover:bg-primary/90"
        >
          New shipment
        </Link>
      </div>

      {/* Filters */}
      <form
        action="/shipments"
        method="GET"
        className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2 text-[11px] sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label htmlFor="ship-search" className="text-[11px] text-muted-foreground">
              Search
            </label>
            <input
              id="ship-search"
              name="q"
              type="text"
              defaultValue={q ?? ""}
              placeholder="Search by shipment # or port"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1 sm:w-40">
            <label htmlFor="ship-status" className="text-[11px] text-muted-foreground">
              Status
            </label>
            <select
              id="ship-status"
              name="status"
              defaultValue={statusFilter}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All</option>
              <option value="planned">Planned</option>
              <option value="booked">Booked</option>
              <option value="on_water">On water</option>
              <option value="arrived">Arrived</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="space-y-1 sm:w-44">
            <label htmlFor="ship-sort" className="text-[11px] text-muted-foreground">
              Sort by
            </label>
            <select
              id="ship-sort"
              name="sort"
              defaultValue={sortKey}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="etd_asc">ETD (earliest first)</option>
              <option value="etd_desc">ETD (latest first)</option>
              <option value="eta_asc">ETA (earliest first)</option>
              <option value="eta_desc">ETA (latest first)</option>
              <option value="created_desc">Created (newest first)</option>
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
        </div>
      </form>

      {shipments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No shipments found.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted text-muted-foreground text-xs">
              <tr>
                <th className="py-2 pr-2 pl-3">Shipment #</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Origin</th>
                <th className="px-2 py-2">Destination</th>
                <th className="px-2 py-2">ETD</th>
                <th className="px-2 py-2">ETA</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {shipments.map((s) => (
                <tr key={s.id} className="border-b last:border-none">
                  <td className="py-1 pr-2 pl-3 font-mono text-[11px]">{s.shipment_number}</td>
                  <td className="px-2 py-1 text-[11px] capitalize">{s.status}</td>
                  <td className="px-2 py-1 text-[11px]">{s.origin_port}</td>
                  <td className="px-2 py-1 text-[11px]">{s.destination_port}</td>
                  <td className="px-2 py-1 text-[11px]">{s.etd ? new Date(s.etd).toLocaleDateString() : "-"}</td>
                  <td className="px-2 py-1 text-[11px]">{s.eta ? new Date(s.eta).toLocaleDateString() : "-"}</td>
                  <td className="space-x-1 px-2 py-1 text-right text-[11px]">
                    <Link
                      href={`/shipments/${s.id}`}
                      className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] hover:bg-muted"
                    >
                      View
                    </Link>
                    <Link
                      href={`/shipments/${s.id}/edit`}
                      className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] hover:bg-muted"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
