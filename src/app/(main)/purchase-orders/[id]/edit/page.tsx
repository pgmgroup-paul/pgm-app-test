import Link from "next/link";

import { serverSupabase } from "@/lib/serverSupabase";

import { addPurchaseOrderLine, deletePurchaseOrderLine } from "../../po-actions";

async function addPurchaseOrderLineFormAction(formData: FormData): Promise<void> {
  "use server";
  await addPurchaseOrderLine(formData);
}

interface PoWithLines {
  id: string;
  po_number: string;
  supplier: string | null;
  terms: string | null;
  status: string;
  ship_date: string | null;
  eta: string | null;
  notes: string | null;
  created_at: string | null;
  lines: {
    id: string;
    sku: string | null;
    sku_var: string | null;
    description: string | null;
    pieces: number;
    cases: number | null;
    price: number | null;
  }[];
}

async function fetchPo(id: string): Promise<PoWithLines | null> {
  const { data: po, error } = await serverSupabase
    .from("purchase_orders")
    .select("id, po_number, supplier, terms, status, ship_date, eta, notes, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !po) {
    console.error("Error loading PO", error);
    return null;
  }

  const { data: lines, error: linesError } = await serverSupabase
    .from("purchase_order_lines")
    .select("id, product_id, sku, sku_var, description, quantity_cases, price")
    .eq("purchase_order_id", id)
    .order("created_at", { ascending: true });

  if (linesError) {
    console.error("Error loading PO lines", linesError);
  }

  const rawLines = lines || [];

  // Load case pack (units_per) from product_dimensions for these products
  const productIds = rawLines.map((l) => l.product_id as string);
  const unitsPerMap = new Map<string, number>();

  if (productIds.length > 0) {
    const { data: dims, error: dimsError } = await serverSupabase
      .from("product_dimensions")
      .select("product_id, kind, units_per")
      .in("product_id", productIds);

    if (dimsError) {
      console.error("Error loading product dimensions for PO lines", dimsError);
    }

    // Use the first non-null, >0 units_per we find per product, regardless of kind.
    for (const d of dims || []) {
      const pid = d.product_id as string;
      const units = Number(d.units_per) || 0;
      if (units > 0 && !unitsPerMap.has(pid)) {
        unitsPerMap.set(pid, units);
      }
    }
  }

  return {
    id: po.id as string,
    po_number: po.po_number as string,
    supplier: (po.supplier as string) || null,
    terms: (po.terms as string) || null,
    status: po.status as string,
    ship_date: (po.ship_date as string) || null,
    eta: (po.eta as string) || null,
    notes: (po.notes as string) || null,
    created_at: (po.created_at as string) || null,
    lines: rawLines.map((l) => {
      const pid = l.product_id as string;
      const pieces = Number(l.quantity_cases) || 0;
      const unitsPer = unitsPerMap.get(pid) || 0;
      const cases = unitsPer > 0 ? pieces / unitsPer : null;

      return {
        id: l.id as string,
        sku: (l.sku as string) || null,
        sku_var: (l.sku_var as string) || null,
        description: (l.description as string) || null,
        pieces,
        cases,
        price: l.price as number | null,
      };
    }),
  };
}

export const dynamic = "force-dynamic";

export default async function EditPurchaseOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: poId } = await params;
  const { error: errorParam } = await searchParams;

  if (!poId) {
    return <div className="p-6 text-destructive text-sm">Missing purchase order id.</div>;
  }

  const po = await fetchPo(poId);

  if (!po) {
    return <div className="p-6 text-destructive text-sm">Purchase order not found.</div>;
  }

  return (
    <div className="max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-semibold text-lg tracking-tight">Edit purchase order</h1>
          <p className="text-muted-foreground text-sm">
            PO <span className="font-mono">{po.po_number}</span>
          </p>
        </div>
        <Link
          href="/purchase-orders"
          className="inline-flex items-center rounded-md border px-3 py-1.5 font-medium text-[11px] hover:bg-muted"
        >
          Close
        </Link>
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Supplier</div>
            <div className="text-[11px]">{po.supplier || "-"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Ship date</div>
            <div className="text-[11px]">{po.ship_date ? new Date(po.ship_date).toLocaleDateString() : "-"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">ETA</div>
            <div className="text-[11px]">{po.eta ? new Date(po.eta).toLocaleDateString() : "-"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Status</div>
            <div className="text-[11px] capitalize">{po.status}</div>
          </div>
        </div>
        {po.notes && (
          <div className="space-y-1 pt-2">
            <div className="text-[11px] text-muted-foreground">Notes</div>
            <div className="whitespace-pre-wrap text-[11px]">{po.notes}</div>
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="flex items-center justify-between">
          <p className="font-medium">Add product</p>
          <form
            action={async (formData: FormData) => {
              "use server";

              const idFromForm = (formData.get("purchase_order_id") || "").toString().trim();
              const statusFromForm = (formData.get("status") || "").toString().trim();

              if (!idFromForm || !statusFromForm) {
                return;
              }

              const { error: updError } = await serverSupabase
                .from("purchase_orders")
                .update({ status: statusFromForm })
                .eq("id", idFromForm);

              if (updError) {
                console.error("Error updating PO status", updError);
              }
            }}
            className="flex items-center gap-2 text-[11px]"
          >
            <input type="hidden" name="purchase_order_id" value={po.id} />
            <label htmlFor="status" className="text-[11px] text-muted-foreground">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={po.status}
              className="rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
            <button
              type="submit"
              className="inline-flex items-center rounded-md border px-3 py-1.5 font-medium text-[11px] hover:bg-muted"
            >
              Save status
            </button>
          </form>
        </div>
        <form action={addPurchaseOrderLineFormAction} className="space-y-2">
          <input type="hidden" name="purchase_order_id" value={po.id} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <label htmlFor="sku" className="font-medium">
                SKU
              </label>
              <input
                id="sku"
                name="sku"
                type="text"
                required
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="sku_var" className="font-medium">
                Variant (optional)
              </label>
              <input
                id="sku_var"
                name="sku_var"
                type="text"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="quantity_cases" className="font-medium">
                Quantity (pieces)
              </label>
              <input
                id="quantity_cases"
                name="quantity_cases"
                type="number"
                min={0}
                step={1}
                required
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="price" className="font-medium">
                Price
              </label>
              <input
                id="price"
                name="price"
                type="number"
                step="0.01"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* SKU volume (m³) field removed */}

          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
          >
            Add product
          </button>

          {errorParam === "product-not-in-catalog" && (
            <p className="text-[11px] text-destructive">Product not in catalog</p>
          )}
          {errorParam === "failed-to-add-line" && (
            <p className="text-[11px] text-destructive">Failed to add line. Please try again.</p>
          )}
        </form>
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <p className="font-medium">Products</p>
        {po.lines.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No lines added yet.</p>
        ) : (
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2">SKU</th>
                  <th className="py-1 pr-2">Variant</th>
                  <th className="py-1 pr-2">Product</th>
                  <th className="py-1 pr-2 text-right">Pieces</th>
                  <th className="py-1 pr-2 text-right">Qty (cases)</th>
                  <th className="py-1 pr-2 text-right">Price</th>
                  <th className="py-1 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((line) => (
                  <tr key={line.id} className="border-b last:border-none">
                    <td className="py-1 pr-2 font-mono text-[11px]">{line.sku}</td>
                    <td className="py-1 pr-2 text-[11px]">{line.sku_var}</td>
                    <td className="py-1 pr-2 text-[11px]">{line.description}</td>
                    <td className="py-1 pr-2 text-right text-[11px]">{line.pieces}</td>
                    <td className="py-1 pr-2 text-right text-[11px]">
                      {line.cases != null ? line.cases.toFixed(2) : "-"}
                    </td>
                    <td className="py-1 pr-2 text-right text-[11px]">
                      {line.price != null ? line.price.toFixed(2) : "-"}
                    </td>
                    <td className="py-1 pr-2 text-right text-[11px]">
                      <form action={deletePurchaseOrderLine}>
                        <input type="hidden" name="line_id" value={line.id} />
                        <input type="hidden" name="purchase_order_id" value={po.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted"
                        >
                          Remove
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
    </div>
  );
}
