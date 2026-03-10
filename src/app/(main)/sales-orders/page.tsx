import Link from "next/link";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

type SoStatus = "open" | "shipped" | "cancelled";

type SortKey = "order_desc" | "order_asc" | "requested_asc" | "requested_desc";

interface SalesOrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  status: SoStatus;
  order_date: string | null;
  requested_ship_date: string | null;
  created_at: string | null;
}

interface LoadOptions {
  search?: string;
  status?: SoStatus | "all";
  sort?: SortKey;
}

async function loadSalesOrders({
  search,
  status = "open",
  sort = "order_desc",
}: LoadOptions): Promise<SalesOrderRow[]> {
  let query = serverSupabase
    .from("sales_orders")
    .select("id, order_number, customer_name, status, order_date, requested_ship_date, created_at");

  if (status !== "all") {
    query = query.eq("status", status);
  }

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`order_number.ilike.${term},customer_name.ilike.${term}`);
  }

  switch (sort) {
    case "order_asc":
      query = query.order("order_date", { ascending: true });
      break;
    case "requested_asc":
      query = query.order("requested_ship_date", { ascending: true }).order("order_date", { ascending: false });
      break;
    case "requested_desc":
      query = query.order("requested_ship_date", { ascending: false }).order("order_date", { ascending: false });
      break;
    default:
      query = query.order("order_date", { ascending: false });
      break;
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error loading sales orders", error);
    return [];
  }

  return (data ?? []).map((so) => ({
    id: so.id as string,
    order_number: (so.order_number as string) || "",
    customer_name: (so.customer_name as string) || "",
    status: (so.status as SoStatus) || "open",
    order_date: (so.order_date as string) || null,
    requested_ship_date: (so.requested_ship_date as string) || null,
    created_at: (so.created_at as string) || null,
  }));
}

export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return <div className="p-6 text-destructive text-sm">Not authorized.</div>;
  }

  const { q, status, sort } = await searchParams;

  const statusFilter: SoStatus | "all" =
    status === "open" || status === "shipped" || status === "cancelled" ? (status as SoStatus) : "open";

  const sortKey: SortKey =
    sort === "order_asc" || sort === "requested_asc" || sort === "requested_desc" ? (sort as SortKey) : "order_desc";

  const orders = await loadSalesOrders({
    search: q,
    status: statusFilter,
    sort: sortKey,
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-semibold text-2xl tracking-tight">Sales orders</h1>
          <p className="text-muted-foreground text-sm">Track customer demand for container planning.</p>
        </div>
        <Link
          href="/sales-orders/new"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-xs hover:bg-primary/90"
        >
          New SO
        </Link>
      </div>

      {/* Filters */}
      <form
        action="/sales-orders"
        method="GET"
        className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2 text-[11px] sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label htmlFor="so-search" className="text-[11px] text-muted-foreground">
              Search
            </label>
            <input
              id="so-search"
              name="q"
              type="text"
              defaultValue={q ?? ""}
              placeholder="Search by SO # or customer"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1 sm:w-40">
            <label htmlFor="so-status" className="text-[11px] text-muted-foreground">
              Status
            </label>
            <select
              id="so-status"
              name="status"
              defaultValue={statusFilter}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="open">Open</option>
              <option value="shipped">Shipped</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All</option>
            </select>
          </div>
          <div className="space-y-1 sm:w-44">
            <label htmlFor="so-sort" className="text-[11px] text-muted-foreground">
              Sort by
            </label>
            <select
              id="so-sort"
              name="sort"
              defaultValue={sortKey}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="order_desc">Order date (newest first)</option>
              <option value="order_asc">Order date (oldest first)</option>
              <option value="requested_asc">Requested ship (earliest first)</option>
              <option value="requested_desc">Requested ship (latest first)</option>
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

      {orders.length === 0 ? (
        <p className="text-muted-foreground text-sm">No sales orders found.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted text-muted-foreground text-xs">
              <tr>
                <th className="py-2 pr-2 pl-3">SO #</th>
                <th className="px-2 py-2">Customer</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Order date</th>
                <th className="px-2 py-2">Requested ship</th>
                <th className="px-2 py-2">Created</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {orders.map((so) => (
                <tr key={so.id} className="border-b last:border-none">
                  <td className="py-1 pr-2 pl-3 font-mono text-[11px]">{so.order_number}</td>
                  <td className="px-2 py-1 text-[11px]">{so.customer_name}</td>
                  <td className="px-2 py-1 text-[11px] capitalize">{so.status}</td>
                  <td className="px-2 py-1 text-[11px]">
                    {so.order_date ? new Date(so.order_date).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-2 py-1 text-[11px]">
                    {so.requested_ship_date ? new Date(so.requested_ship_date).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-2 py-1 text-[11px]">
                    {so.created_at ? new Date(so.created_at).toLocaleDateString() : "-"}
                  </td>
                  <td className="space-x-1 px-2 py-1 text-right text-[11px]">
                    <Link
                      href={`/sales-orders/${so.id}`}
                      className="inline-flex items-center rounded-md border px-2 py-1 text-[11px] hover:bg-muted"
                    >
                      View
                    </Link>
                    <Link
                      href={`/sales-orders/${so.id}/edit`}
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
