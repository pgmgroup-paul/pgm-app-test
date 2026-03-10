import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

async function loadSalesOrder(id: string) {
  const { data: so, error } = await serverSupabase
    .from("sales_orders")
    .select("id, order_number, customer_name, status, order_date, requested_ship_date, notes")
    .eq("id", id)
    .maybeSingle();

  if (error || !so) {
    console.error("Error loading sales order", error);
    return null;
  }

  const { data: lines, error: linesError } = await serverSupabase
    .from("sales_order_lines")
    .select("id, product_id, sku, sku_var, description, quantity_units")
    .eq("sales_order_id", id)
    .order("created_at", { ascending: true });

  if (linesError) {
    console.error("Error loading sales order lines", linesError);
  }

  // Load shipments summary for this sales order
  const { data: shipments, error: shipmentsError } = await serverSupabase
    .from("so_shipments")
    .select("id, shipment_sequence, status")
    .eq("sales_order_id", id)
    .order("shipment_sequence", { ascending: true });

  if (shipmentsError) {
    console.error("Error loading shipments for sales order", shipmentsError);
  }

  let shipmentsWithTotals: any[] = [];

  if (shipments && shipments.length > 0) {
    const shipmentIds = shipments.map((s) => s.id as string);

    const { data: shipLines, error: shipLinesError } = await serverSupabase
      .from("so_shipment_lines")
      .select("so_shipment_id, quantity_shipped_units")
      .in("so_shipment_id", shipmentIds);

    if (shipLinesError) {
      console.error("Error loading shipment line totals", shipLinesError);
    }

    const totalsMap = new Map<string, number>();
    for (const sl of shipLines || []) {
      const sid = sl.so_shipment_id as string;
      const qty = Number(sl.quantity_shipped_units) || 0;
      totalsMap.set(sid, (totalsMap.get(sid) || 0) + qty);
    }

    shipmentsWithTotals = shipments.map((s) => ({
      id: s.id as string,
      shipment_sequence: s.shipment_sequence as number,
      status: s.status as string,
      total_shipped_units: totalsMap.get(s.id as string) || 0,
    }));
  }

  return { so, lines: lines || [], shipments: shipmentsWithTotals };
}

export default async function EditSalesOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const { error } = await searchParams;

  const data = await loadSalesOrder(id);

  if (!data) {
    return <div className="p-6 text-destructive text-sm">Sales order not found.</div>;
  }

  const { so, lines, shipments } = data as any;

  return (
    <div className="max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-semibold text-lg tracking-tight">Edit sales order</h1>
          <p className="text-muted-foreground text-sm">
            SO <span className="font-mono">{so.order_number}</span> – {so.customer_name}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            redirect(`/sales-orders/${so.id as string}/shipments`);
          }}
        >
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
          >
            Shipments
          </button>
        </form>
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Order date</div>
            <div className="text-[11px]">{so.order_date ? new Date(so.order_date).toLocaleDateString() : "-"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Requested ship</div>
            <div className="text-[11px]">
              {so.requested_ship_date ? new Date(so.requested_ship_date).toLocaleDateString() : "-"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Status</div>
            <div className="text-[11px] capitalize">{so.status}</div>
          </div>
        </div>
        {so.notes && (
          <div className="space-y-1 pt-2">
            <div className="text-[11px] text-muted-foreground">Notes</div>
            <div className="whitespace-pre-wrap text-[11px]">{so.notes}</div>
          </div>
        )}
      </div>

      {/* Shipments summary removed: shown on shipment page instead */}
      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="font-medium text-[11px]">Lines</div>
        </div>

        {lines.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No lines yet. Add the first product below.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">SKU</th>
                  <th className="px-2 py-1">Variant</th>
                  <th className="px-2 py-1">Product</th>
                  <th className="px-2 py-1 text-right">Quantity (units)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line: any) => (
                  <tr key={line.id} className="border-b last:border-none">
                    <td className="py-1 pr-2 pl-3 font-mono text-[11px]">{line.sku}</td>
                    <td className="px-2 py-1 text-[11px]">{line.sku_var}</td>
                    <td className="px-2 py-1 text-[11px]">{line.description}</td>
                    <td className="px-2 py-1 text-right text-[11px]">{line.quantity_units}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="font-medium text-[11px]">Add line</div>
        <form
          action={async (formData: FormData) => {
            "use server";

            const profile = await getCurrentUserProfile();

            if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
              redirect("/unauthorized");
            }

            const soId = (formData.get("sales_order_id") || "").toString().trim();
            const sku = (formData.get("sku") || "").toString().trim();
            const skuVar = (formData.get("sku_var") || "").toString().trim();
            const qtyRaw = (formData.get("quantity_units") || "").toString().trim();

            if (!soId || !sku || !qtyRaw) {
              redirect(`/sales-orders/${id}/edit?error=missing-line-fields`);
            }

            const quantity = Number(qtyRaw);
            if (!Number.isFinite(quantity) || quantity <= 0) {
              redirect(`/sales-orders/${id}/edit?error=bad-qty`);
            }

            // Resolve product by SKU / variant, similar to PO lines
            let productQuery = serverSupabase
              .from("products")
              .select("id, sku, sku_var, product_name")
              .ilike("sku", sku);

            if (skuVar) {
              productQuery = productQuery.ilike("sku_var", skuVar);
            } else {
              productQuery = productQuery.is("sku_var", null);
            }

            const { data: product, error: prodError } = await productQuery.maybeSingle();

            if (prodError || !product) {
              console.error("Error looking up product for SO line", prodError);
              redirect(`/sales-orders/${id}/edit?error=product-not-in-catalog`);
            }

            const { error: insertError } = await serverSupabase.from("sales_order_lines").insert({
              sales_order_id: soId,
              product_id: product.id as string,
              sku: product.sku as string,
              sku_var: (product.sku_var as string) || null,
              description: (product.product_name as string) || null,
              quantity_units: quantity,
            });

            if (insertError) {
              console.error("Error inserting SO line", insertError);
              redirect(`/sales-orders/${id}/edit?error=failed-to-add-line`);
            }

            redirect(`/sales-orders/${id}/edit`);
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-4"
        >
          <input type="hidden" name="sales_order_id" value={so.id as string} />
          <div className="space-y-1">
            <label htmlFor="sku" className="font-medium text-[11px]">
              SKU
            </label>
            <input
              id="sku"
              name="sku"
              type="text"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="sku_var" className="font-medium text-[11px]">
              Variant
            </label>
            <input
              id="sku_var"
              name="sku_var"
              type="text"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="quantity_units" className="font-medium text-[11px]">
              Quantity (units)
            </label>
            <input
              id="quantity_units"
              name="quantity_units"
              type="number"
              min="1"
              step="1"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-md border px-3 py-1.5 font-medium text-[11px] hover:bg-muted"
            >
              Add line
            </button>
          </div>
        </form>

        {error && (
          <p className="pt-2 text-[11px] text-destructive">
            {error === "missing-line-fields" && "SKU and quantity are required."}
            {error === "bad-qty" && "Quantity must be a positive number."}
            {error === "product-not-in-catalog" && "Product not found in catalog."}
            {error === "failed-to-add-line" && "Failed to add line."}
          </p>
        )}
      </div>
    </div>
  );
}
