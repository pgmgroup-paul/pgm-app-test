import Link from "next/link";

import { serverSupabase } from "@/lib/serverSupabase";

export const dynamic = "force-dynamic";

type PoSort = "created_desc" | "created_asc" | "eta_asc" | "eta_desc" | "ship_asc" | "ship_desc";

interface LoadPoOptions {
  search?: string;
  sort?: PoSort;
  includeClosed?: boolean;
}

async function loadPurchaseOrders({ search, sort = "created_desc", includeClosed = false }: LoadPoOptions) {
  let query = serverSupabase
    .from("purchase_orders")
    .select("id, po_number, supplier, status, ship_date, eta, created_at");

  // By default only show open POs; when includeClosed is true, show all.
  if (!includeClosed) {
    query = query.eq("status", "open");
  }

  if (search) {
    const term = `%${search.trim()}%`;
    // Match on PO number or supplier name
    query = query.or(`po_number.ilike.${term},supplier.ilike.${term}`);
  }

  switch (sort) {
    case "created_asc":
      query = query.order("created_at", { ascending: true });
      break;
    case "eta_asc":
      query = query.order("eta", { ascending: true }).order("created_at", { ascending: false });
      break;
    case "eta_desc":
      query = query.order("eta", { ascending: false }).order("created_at", { ascending: false });
      break;
    case "ship_asc":
      query = query.order("ship_date", { ascending: true }).order("created_at", { ascending: false });
      break;
    case "ship_desc":
      query = query.order("ship_date", { ascending: false }).order("created_at", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error loading purchase orders", error);
    return [] as any[];
  }

  return data ?? [];
}

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; include_closed?: string }>;
}) {
  const { q, sort, include_closed } = await searchParams;

  const includeClosed = include_closed === "1" || include_closed === "true";
  const sortKey = (sort as PoSort) || "created_desc";

  const pos = await loadPurchaseOrders({
    search: q,
    sort: sortKey,
    includeClosed,
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-semibold text-2xl tracking-tight">Purchase orders</h1>
          <p className="text-muted-foreground text-sm">Create and review purchase orders.</p>
        </div>
        <Link
          href="/purchase-orders/new-v2"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-xs hover:bg-primary/90"
        >
          New PO
        </Link>
      </div>

      {/* Filters */}
      <form
        action="/purchase-orders"
        method="GET"
        className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2 text-[11px] sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label htmlFor="po-search" className="text-[11px] text-muted-foreground">
              Search
            </label>
            <input
              id="po-search"
              name="q"
              type="text"
              defaultValue={q ?? ""}
              placeholder="Search by PO # or supplier"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1 sm:w-44">
            <label htmlFor="po-sort" className="text-[11px] text-muted-foreground">
              Sort by
            </label>
            <select
              id="po-sort"
              name="sort"
              defaultValue={sortKey}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="created_desc">Created (newest first)</option>
              <option value="created_asc">Created (oldest first)</option>
              <option value="eta_asc">ETA (earliest first)</option>
              <option value="eta_desc">ETA (latest first)</option>
              <option value="ship_asc">Ship date (earliest first)</option>
              <option value="ship_desc">Ship date (latest first)</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 sm:w-56 sm:justify-end">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground">
            <input
              type="checkbox"
              name="include_closed"
              value="1"
              defaultChecked={includeClosed}
              className="h-3 w-3 rounded border border-input"
            />
            <span>Include closed POs</span>
          </label>
          <button
            type="submit"
            className="inline-flex items-center rounded-md border px-3 py-1 font-medium text-[11px] hover:bg-muted"
          >
            Apply
          </button>
        </div>
      </form>

      {pos.length === 0 ? (
        <p className="text-muted-foreground text-sm">No purchase orders found.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted text-muted-foreground text-xs">
              <tr>
                <th className="py-2 pr-2 pl-3">PO #</th>
                <th className="px-2 py-2">Supplier</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Ship date</th>
                <th className="px-2 py-2">ETA</th>
                <th className="px-2 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {pos.map((po) => (
                <tr
                  key={po.id}
                  className="border-b last:border-none cursor-pointer hover:bg-gray-50"
                >
                  <td className="py-1 pr-2 pl-3 font-mono text-[11px]">
                    <Link
                      href={`/purchase-orders/new-v2?id=${po.id}`}
                      className="block w-full"
                    >
                      {po.po_number}
                    </Link>
                  </td>
                  <td className="px-2 py-1 text-[11px]">
                    <Link
                      href={`/purchase-orders/new-v2?id=${po.id}`}
                      className="block w-full"
                    >
                      {po.supplier}
                    </Link>
                  </td>
                  <td className="px-2 py-1 text-[11px] capitalize">
                    <Link
                      href={`/purchase-orders/new-v2?id=${po.id}`}
                      className="block w-full"
                    >
                      {po.status}
                    </Link>
                  </td>
                  <td className="px-2 py-1 text-[11px]">
                    <Link
                      href={`/purchase-orders/new-v2?id=${po.id}`}
                      className="block w-full"
                    >
                      {po.ship_date
                        ? new Date(po.ship_date).toLocaleDateString()
                        : "-"}
                    </Link>
                  </td>
                  <td className="px-2 py-1 text-[11px]">
                    <Link
                      href={`/purchase-orders/new-v2?id=${po.id}`}
                      className="block w-full"
                    >
                      {po.eta ? new Date(po.eta).toLocaleDateString() : "-"}
                    </Link>
                  </td>
                  <td className="px-2 py-1 text-[11px]">
                    <Link
                      href={`/purchase-orders/new-v2?id=${po.id}`}
                      className="block w-full"
                    >
                      {po.created_at
                        ? new Date(po.created_at).toLocaleDateString()
                        : "-"}
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
