import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

import { addShipmentForSo, deleteShipmentForSoOnList } from "./shipments-actions";

export const dynamic = "force-dynamic";

async function loadShipmentsForSo(salesOrderId: string) {
  const { data: so, error: soError } = await serverSupabase
    .from("sales_orders")
    .select("id, order_number, customer_name")
    .eq("id", salesOrderId)
    .maybeSingle();

  if (soError || !so) {
    console.error("Error loading SO for shipments", soError);
    return null;
  }

  const { data: shipments, error: shipError } = await serverSupabase
    .from("so_shipments")
    .select("id, shipment_sequence, status")
    .eq("sales_order_id", salesOrderId)
    .order("shipment_sequence", { ascending: true });

  if (shipError) {
    console.error("Error loading shipments for SO", shipError);
  }

  // Load SO lines and shipped totals to compute remaining per product
  const { data: soLines, error: soLinesError } = await serverSupabase
    .from("sales_order_lines")
    .select("id, product_id, sku, sku_var, description, quantity_units")
    .eq("sales_order_id", salesOrderId)
    .order("created_at", { ascending: true });

  if (soLinesError) {
    console.error("Error loading SO lines for shipments page", soLinesError);
  }

  const soLineIds = (soLines || []).map((l) => l.id as string);

  let pendingProducts: any[] = [];

  if (soLineIds.length > 0) {
    const { data: shippedAgg, error: shippedError } = await serverSupabase
      .from("so_shipment_lines")
      .select("sales_order_line_id, quantity_shipped_units")
      .in("sales_order_line_id", soLineIds);

    if (shippedError) {
      console.error("Error loading shipped aggregates for shipments page", shippedError);
    }

    const shippedMap = new Map<string, number>();
    for (const row of shippedAgg || []) {
      const lineId = row.sales_order_line_id as string;
      const qty = Number(row.quantity_shipped_units) || 0;
      shippedMap.set(lineId, (shippedMap.get(lineId) || 0) + qty);
    }

    pendingProducts = (soLines || [])
      .map((l: any) => {
        const ordered = Number(l.quantity_units) || 0;
        const shipped = shippedMap.get(l.id as string) || 0;
        const remaining = Math.max(ordered - shipped, 0);

        return {
          sales_order_line_id: l.id as string,
          sku: (l.sku as string) || "",
          sku_var: (l.sku_var as string) || null,
          description: (l.description as string) || "",
          ordered_units: ordered,
          remaining_units: remaining,
        };
      })
      .filter((p) => p.remaining_units > 0);
  }

  return { so, shipments: shipments || [], pendingProducts };
}

export default async function SalesOrderShipmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  const { id: salesOrderId } = await params;

  const data = await loadShipmentsForSo(salesOrderId);

  if (!data) {
    return <div className="p-6 text-destructive text-sm">Sales order not found.</div>;
  }

  const { so, shipments, pendingProducts } = data as any;

  const nextSeq =
    (shipments?.length || 0) > 0 ? Math.max(...shipments.map((s: any) => Number(s.shipment_sequence) || 0)) + 1 : 1;

  return (
    <div className="max-w-4xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-semibold text-lg tracking-tight">Prepare shipments</h1>
          <p className="text-muted-foreground text-sm">
            Sales order <span className="font-mono">{so.order_number}</span>
            {so.customer_name && <span> – {so.customer_name}</span>}
          </p>
        </div>
        <a
          href={`/sales-orders/${salesOrderId}/edit`}
          className="inline-flex items-center rounded-md border px-3 py-1.5 font-medium text-[11px] hover:bg-muted"
        >
          Back to order details
        </a>
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="font-medium text-[11px]">Create new shipment</div>
        <div className="flex items-center justify-between text-[11px]">
          <div>
            <span className="text-muted-foreground">Next shipment number: </span>
            <span className="font-mono">
              {so.order_number}-{nextSeq}
            </span>
          </div>
          <form
            action={async () => {
              "use server";
              await addShipmentForSo(salesOrderId);
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
            >
              + Shipment
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="font-medium text-[11px]">Shipments for this order</div>
        {!shipments || shipments.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No shipments created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">Shipment #</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s: any) => (
                  <tr key={s.id} className="border-b last:border-none">
                    <td className="py-1 pr-2 pl-3 text-[11px]">
                      {so.order_number}-{s.shipment_sequence}
                    </td>
                    <td className="px-2 py-1 text-[11px] capitalize">{s.status}</td>
                    <td className="space-x-1 px-2 py-1 text-right text-[11px]">
                      <a
                        href={`/sales-orders/${salesOrderId}/shipments/${s.id}`}
                        className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted"
                      >
                        Open shipment
                      </a>
                      {s.status === "planned" && (
                        <form
                          action={async () => {
                            "use server";
                            await deleteShipmentForSoOnList(salesOrderId, s.id as string);
                          }}
                          className="inline-block"
                        >
                          <button
                            type="submit"
                            className="inline-flex items-center rounded-md border border-destructive px-2 py-0.5 text-[10px] text-destructive hover:bg-destructive/10"
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Products with remaining quantity not yet allocated */}
      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="font-medium text-[11px]">Products not yet assigned to shipments</div>
        {!pendingProducts || pendingProducts.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">All product quantity already allocated in shipments.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">SKU / Variant</th>
                  <th className="px-2 py-1">Product</th>
                  <th className="px-2 py-1 text-right">Quantity ordered (units)</th>
                  <th className="px-2 py-1 text-right">Quantity remaining (units)</th>
                </tr>
              </thead>
              <tbody>
                {pendingProducts.map((p: any) => (
                  <tr key={p.sales_order_line_id} className="border-b last:border-none">
                    <td className="py-1 pr-2 pl-3 text-[11px]">
                      <span className="font-mono">{p.sku}</span>
                      {p.sku_var && <span className="text-muted-foreground"> / {p.sku_var}</span>}
                    </td>
                    <td className="px-2 py-1 text-[11px]">{p.description}</td>
                    <td className="px-2 py-1 text-right text-[11px]">{p.ordered_units}</td>
                    <td className="px-2 py-1 text-right text-[11px]">{p.remaining_units}</td>
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
