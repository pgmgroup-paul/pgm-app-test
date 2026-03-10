import { serverSupabase } from "@/lib/serverSupabase";

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
    sku_volume_m3: number | null;
  }[];
}

async function fetchPoWithLines(id: string): Promise<PoWithLines | null> {
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
    .select("id, product_id, sku, sku_var, description, quantity_cases, price, sku_volume_m3")
    .eq("purchase_order_id", id)
    .order("created_at", { ascending: true });

  if (linesError) {
    console.error("Error loading PO lines", linesError);
  }

  const rawLines = lines || [];
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
        sku_volume_m3: l.sku_volume_m3 as number | null,
      };
    }),
  };
}

export const dynamic = "force-dynamic";

export default async function ViewPurchaseOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!id) {
    return <div className="p-6 text-destructive text-sm">Missing purchase order id.</div>;
  }

  const po = await fetchPoWithLines(id);

  if (!po) {
    return <div className="p-6 text-destructive text-sm">Purchase order not found.</div>;
  }

  return (
    <div className="max-w-4xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg tracking-tight">Purchase order details</h1>
        <p className="text-muted-foreground text-sm">
          PO <span className="font-mono">{po.po_number}</span>
        </p>
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Supplier</div>
            <div className="text-[11px]">{po.supplier || "-"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Terms</div>
            <div className="text-[11px]">{po.terms || "-"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Status</div>
            <div className="text-[11px] capitalize">{po.status}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Ship date</div>
            <div className="text-[11px]">{po.ship_date ? new Date(po.ship_date).toLocaleDateString() : "-"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">ETA</div>
            <div className="text-[11px]">{po.eta ? new Date(po.eta).toLocaleDateString() : "-"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Created</div>
            <div className="text-[11px]">{po.created_at ? new Date(po.created_at).toLocaleDateString() : "-"}</div>
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
        <p className="font-medium">Products</p>
        {po.lines.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No products on this PO.</p>
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
                  <th className="py-1 pr-2 text-right">Volume (m³)</th>
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
                      {line.sku_volume_m3 != null ? line.sku_volume_m3.toFixed(4) : "-"}
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
