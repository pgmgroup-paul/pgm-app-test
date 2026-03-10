import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

import { updateProductionStatus } from "./actions";

export const dynamic = "force-dynamic";

interface SupplierPoLineRow {
  po_id: string;
  po_number: string;
  ship_date: string | null;
  eta: string | null;
  status: string;
  line_id: string;
  product_id: string;
  sku: string | null;
  sku_var: string | null;
  description: string | null;
  quantity_cases: number | null;
  production_status: string | null;
}

type StatusFilter = "all" | "under_production" | "ready" | "cancelled";
type SortKey = "ship_asc" | "ship_desc" | "eta_asc" | "eta_desc" | "po_asc" | "po_desc";

interface LoadOptions {
  profile: any;
  search?: string;
  statusFilter?: StatusFilter;
  sort?: SortKey;
}

async function loadSupplierPoLines({
  profile,
  search,
  statusFilter = "all",
  sort = "ship_asc",
}: LoadOptions): Promise<SupplierPoLineRow[]> {
  const isSupplier = profile?.role === "supplier";

  let query = serverSupabase
    .from("purchase_orders")
    .select(
      `id, po_number, supplier, status, ship_date, eta,
       purchase_order_lines ( id, product_id, sku, sku_var, description, quantity_cases, production_status )`,
    )
    .eq("status", "open");

  // If this is a supplier, filter to "their" POs by company name stored in purchase_orders.supplier.
  // This assumes you store the supplier's company name from profiles.company in purchase_orders.supplier
  // when creating POs (via the New PO supplier dropdown).
  const supplierCompany = (profile as any).company as string | undefined;
  if (isSupplier && supplierCompany) {
    query = query.eq("supplier", supplierCompany);
  }

  const { data: pos, error } = await query.order("ship_date", { ascending: true });

  if (error) {
    console.error("Error loading POs for production status", error);
    return [];
  }

  let rows: SupplierPoLineRow[] = [];

  for (const po of pos || []) {
    const lines = (po as any).purchase_order_lines as any[] | null;
    if (!lines || lines.length === 0) continue;

    for (const line of lines) {
      rows.push({
        po_id: po.id as string,
        po_number: (po.po_number as string) || "",
        ship_date: (po.ship_date as string) || null,
        eta: (po.eta as string) || null,
        status: (po.status as string) || "",
        line_id: line.id as string,
        product_id: line.product_id as string,
        sku: (line.sku as string) || null,
        sku_var: (line.sku_var as string) || null,
        description: (line.description as string) || null,
        quantity_cases: (line.quantity_cases as number) ?? null,
        production_status: (line.production_status as string) || "under_production",
      });
    }
  }

  // In-memory filtering: status + search

  if (statusFilter === "under_production") {
    rows = rows.filter((r) => (r.production_status || "under_production") === "under_production");
  } else if (statusFilter === "ready") {
    rows = rows.filter((r) => r.production_status === "ready");
  } else if (statusFilter === "cancelled") {
    rows = rows.filter((r) => r.production_status === "cancelled");
  }

  if (search?.trim()) {
    const term = search.trim().toLowerCase();
    rows = rows.filter((r) => {
      const haystack = [r.po_number, r.sku ?? "", r.description ?? ""].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }

  // Sorting
  rows.sort((a, b) => {
    const shipA = a.ship_date || "";
    const shipB = b.ship_date || "";
    const etaA = a.eta || "";
    const etaB = b.eta || "";

    switch (sort) {
      case "ship_desc": {
        if (shipA !== shipB) return shipB.localeCompare(shipA);
        break;
      }
      case "eta_asc": {
        if (etaA !== etaB) return etaA.localeCompare(etaB);
        break;
      }
      case "eta_desc": {
        if (etaA !== etaB) return etaB.localeCompare(etaA);
        break;
      }
      case "po_asc": {
        if (a.po_number !== b.po_number) return a.po_number.localeCompare(b.po_number);
        break;
      }
      case "po_desc": {
        if (a.po_number !== b.po_number) return b.po_number.localeCompare(a.po_number);
        break;
      }
      default: {
        if (shipA !== shipB) return shipA.localeCompare(shipB);
        break;
      }
    }

    // Secondary sort: PO number, then SKU
    if (a.po_number !== b.po_number) return a.po_number.localeCompare(b.po_number);
    return (a.sku || "").localeCompare(b.sku || "");
  });

  return rows;
}

export default async function SupplierProductionStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "supplier" && profile.role !== "admin")) {
    return <div className="p-6 text-destructive text-sm">Not authorized to view this page.</div>;
  }

  const { q, status, sort } = await searchParams;

  const statusFilter: StatusFilter =
    status === "under_production" || status === "ready" || status === "cancelled" ? (status as StatusFilter) : "all";

  const sortKey: SortKey =
    sort === "ship_desc" || sort === "eta_asc" || sort === "eta_desc" || sort === "po_asc" || sort === "po_desc"
      ? (sort as SortKey)
      : "ship_asc";

  const rows = await loadSupplierPoLines({
    profile,
    search: q,
    statusFilter,
    sort: sortKey,
  });

  return (
    <div className="space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Production status</h1>
        <p className="text-muted-foreground text-sm">
          Update production readiness for products on open purchase orders.
        </p>
      </div>

      {/* Filters */}
      <form
        action="/supplier/production-status"
        method="GET"
        className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2 text-[11px] sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label htmlFor="prod-search" className="text-[11px] text-muted-foreground">
              Search
            </label>
            <input
              id="prod-search"
              name="q"
              type="text"
              defaultValue={q ?? ""}
              placeholder="Search by PO #, SKU, or product name"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1 sm:w-40">
            <label htmlFor="prod-status" className="text-[11px] text-muted-foreground">
              Status
            </label>
            <select
              id="prod-status"
              name="status"
              defaultValue={statusFilter}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All</option>
              <option value="under_production">Under production</option>
              <option value="ready">Ready</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="space-y-1 sm:w-44">
            <label htmlFor="prod-sort" className="text-[11px] text-muted-foreground">
              Sort by
            </label>
            <select
              id="prod-sort"
              name="sort"
              defaultValue={sortKey}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="ship_asc">Ship date (earliest first)</option>
              <option value="ship_desc">Ship date (latest first)</option>
              <option value="eta_asc">ETA (earliest first)</option>
              <option value="eta_desc">ETA (latest first)</option>
              <option value="po_asc">PO # (A–Z)</option>
              <option value="po_desc">PO # (Z–A)</option>
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

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No open purchase order lines found.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-left text-[11px]">
            <thead className="border-b bg-muted text-[11px] text-muted-foreground">
              <tr>
                <th className="py-1 pr-2 pl-3">PO #</th>
                <th className="px-2 py-1">Ship date</th>
                <th className="px-2 py-1">SKU</th>
                <th className="px-2 py-1">Product</th>
                <th className="px-2 py-1 text-right">Quantity</th>
                <th className="px-2 py-1">Production status</th>
                <th className="px-2 py-1 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.line_id} className="border-b last:border-none">
                  <td className="py-1 pr-2 pl-3 font-mono text-[11px]">{row.po_number}</td>
                  <td className="px-2 py-1 text-[11px]">
                    {row.ship_date ? new Date(row.ship_date).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-2 py-1 text-[11px]">{row.sku}</td>
                  <td className="px-2 py-1 text-[11px]">{row.description}</td>
                  <td className="px-2 py-1 text-right text-[11px]">{row.quantity_cases ?? "-"}</td>
                  <td className="px-2 py-1 text-[11px] capitalize">
                    <span
                      className={
                        row.production_status === "ready"
                          ? "font-semibold text-emerald-600"
                          : row.production_status === "cancelled"
                            ? "font-semibold text-destructive"
                            : "text-muted-foreground"
                      }
                    >
                      {row.production_status === "ready"
                        ? "Ready"
                        : row.production_status === "cancelled"
                          ? "Cancelled"
                          : "Under production"}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-right text-[11px]">
                    <form action={updateProductionStatus} className="inline-flex items-center gap-2">
                      <input type="hidden" name="po_line_id" value={row.line_id} />
                      <select
                        name="production_status"
                        defaultValue={row.production_status || "under_production"}
                        className="rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="under_production">Under production</option>
                        <option value="ready">Ready</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <button
                        type="submit"
                        className="inline-flex items-center rounded-md border px-2 py-1 font-medium text-[10px] hover:bg-muted"
                      >
                        Save
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
  );
}
