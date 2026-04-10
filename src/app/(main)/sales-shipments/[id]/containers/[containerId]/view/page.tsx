import Link from "next/link";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

async function loadContainerReceipt(containerId: string) {
  const { data: receipt, error: recError } = await serverSupabase
    .from("container_receipts")
    .select("id")
    .eq("shipment_container_id", containerId)
    .maybeSingle();

  if (recError) {
    console.error("Error loading container_receipt header (view)", recError);
    return { lines: [] as any[] };
  }

  if (!receipt) {
    return { lines: [] as any[] };
  }

  const { data: lines, error: linesError } = await serverSupabase
    .from("container_receipt_lines")
    .select(
      `id,
       sku,
       sku_var,
       product_name,
       quantity_expected_units,
       quantity_received_units,
       quantity_received_cases,
       loose_pieces_received,
       purchase_order_lines (
         purchase_orders ( po_number )
       )`,
    )
    .eq("container_receipt_id", receipt.id as string)
    .order("sku", { ascending: true });

  if (linesError) {
    console.error("Error loading container_receipt_lines (view)", linesError);
    return { lines: [] as any[] };
  }

  const mapped = (lines || []).map((l: any) => {
    const pol = l.purchase_order_lines as any | null;
    const po = pol?.purchase_orders as any | null;
    return {
      id: l.id as string,
      sku: l.sku as string,
      sku_var: (l.sku_var as string) || null,
      product_name: (l.product_name as string) || "",
      quantity_expected_units: Number(l.quantity_expected_units) || 0,
      quantity_received_units: Number(l.quantity_received_units) || 0,
      quantity_received_cases: l.quantity_received_cases,
      loose_pieces_received: Number(l.loose_pieces_received) || 0,
      po_number: (po?.po_number as string) || "",
    };
  });

  return { lines: mapped };
}

async function loadContainerView(shipmentId: string, containerId: string) {
  const { data: shipment, error: shipError } = await serverSupabase
    .from("shipments")
    .select("id, shipment_number, origin_port, destination_port, etd, eta")
    .eq("id", shipmentId)
    .maybeSingle();

  if (shipError || !shipment) {
    console.error("Error loading shipment for container view", shipError);
    return null;
  }

  const { data: container, error: contError } = await serverSupabase
    .from("shipment_containers")
    .select("id, container_number, type, status, seal_number")
    .eq("id", containerId)
    .eq("shipment_id", shipmentId)
    .maybeSingle();

  if (contError || !container) {
    console.error("Error loading shipment container", contError);
    return null;
  }

  const { data: items, error: itemsError } = await serverSupabase
    .from("shipment_items")
    .select(
      `
      id,
      quantity,
      purchase_order_lines (
        id,
        purchase_order_id,
        product_id,
        sku,
        sku_var,
        description,
        quantity_cases,
        quantity_shipped,
        quantity_received,
        purchase_orders (
          id,
          po_number
        )
      )
    `,
    )
    .eq("shipment_container_id", containerId);

  if (itemsError) {
    console.error("Error loading shipment items for container view", itemsError);
  }

  const lines =
    items?.map((it: any) => {
      const line = it.purchase_order_lines;
      const po = line?.purchase_orders;

      return {
        id: it.id as string,
        po_number: (po?.po_number as string) || "",
        product_id: line?.product_id as string,
        sku: (line?.sku as string) || "",
        description: (line?.description as string) || "",
        quantity_units: Number(it.quantity) || 0,
        received_units: Number(line?.quantity_received) || 0,
      };
    }) ?? [];

  const productIds = Array.from(new Set(lines.map((l) => l.product_id)));
  const unitsPerMap = new Map<string, number>();

  if (productIds.length > 0) {
    const { data: dims, error: dimsError } = await serverSupabase
      .from("product_dimensions")
      .select("product_id, units_per")
      .in("product_id", productIds);

    if (dimsError) {
      console.error("Error loading product dimensions for container view", dimsError);
    }

    for (const d of dims || []) {
      const pid = d.product_id as string;
      const units = Number(d.units_per) || 0;
      if (units > 0 && !unitsPerMap.has(pid)) {
        unitsPerMap.set(pid, units);
      }
    }
  }

  return { shipment, container, lines, unitsPerMap };
}

export default async function ContainerViewPage({ params }: { params: Promise<{ id: string; containerId: string }> }) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return <div className="p-6 text-destructive text-sm">Not authorized.</div>;
  }

  const { id: shipmentId, containerId } = await params;

  const data = await loadContainerView(shipmentId, containerId);

  if (!data) {
    return <div className="p-6 text-destructive text-sm">Container not found.</div>;
  }

  const { shipment, container, lines, unitsPerMap } = data as any;

  // Load immutable received contents snapshot for this container, if it exists
  const { lines: receiptLines } = await loadContainerReceipt(container.id as string);

  return (
    <div className="max-w-5xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg tracking-tight">Container</h1>
        <p className="text-muted-foreground text-sm">
          Shipment{" "}
          <Link href={`/sales-shipments/${shipment.id}`} className="underline">
            {shipment.shipment_number}
          </Link>{" "}
          – Container {container.container_number || "(pending)"}
        </p>
      </div>

      {/* Tabs (view-only) */}
      <div className="space-y-2 rounded-md border px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-[11px]">
          <button className="rounded-md border bg-muted px-2 py-1 font-medium text-[11px]">Contents</button>
          <button className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground" disabled>
            Shipment events
          </button>
          <button className="rounded-md border px-2 py-1 text-[11px] text-muted-foreground" disabled>
            Problems
          </button>
        </div>
      </div>

      {/* Metadata block */}
      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="font-medium text-[11px]">Container details</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Status</div>
            <div className="text-[11px] capitalize">{container.status}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Lane</div>
            <div className="text-[11px]">
              {shipment.origin_port || "?"} → {shipment.destination_port || "?"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">ETD / ETA</div>
            <div className="text-[11px]">
              {shipment.etd ? new Date(shipment.etd).toLocaleDateString() : "-"} /{" "}
              {shipment.eta ? new Date(shipment.eta).toLocaleDateString() : "-"}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Container</div>
            <div className="text-[11px]">
              {container.container_number || "(pending)"} • {container.type || "type?"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Seal</div>
            <div className="text-[11px]">{container.seal_number || "-"}</div>
          </div>
        </div>
      </div>

      {/* Contents block */}
      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="font-medium text-[11px]">Contents</div>

        {receiptLines.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">PO #</th>
                  <th className="px-2 py-1">SKU</th>
                  <th className="px-2 py-1">Variant</th>
                  <th className="px-2 py-1">Product</th>
                  <th className="px-2 py-1 text-right">Qty expected (units)</th>
                  <th className="px-2 py-1 text-right">Qty received (units)</th>
                  <th className="px-2 py-1 text-right">Qty received (cases)</th>
                  <th className="px-2 py-1 text-right">Loose pieces received</th>
                  <th className="px-2 py-1 text-right">Discrepancy (units)</th>
                </tr>
              </thead>
              <tbody>
                {receiptLines.map((r: any) => {
                  const discrepancy =
                    (Number(r.quantity_expected_units) || 0) -
                    ((Number(r.quantity_received_units) || 0) + (Number(r.loose_pieces_received) || 0));
                  return (
                    <tr key={r.id} className="border-b last:border-none">
                      <td className="py-1 pr-2 pl-3 font-mono text-[11px]">{r.po_number}</td>
                      <td className="px-2 py-1 font-mono text-[11px]">{r.sku}</td>
                      <td className="px-2 py-1 text-[11px]">{r.sku_var}</td>
                      <td className="px-2 py-1 text-[11px]">{r.product_name}</td>
                      <td className="px-2 py-1 text-right text-[11px]">{Number(r.quantity_expected_units) || 0}</td>
                      <td className="px-2 py-1 text-right text-[11px]">{Number(r.quantity_received_units) || 0}</td>
                      <td className="px-2 py-1 text-right text-[11px]">
                        {r.quantity_received_cases != null ? Number(r.quantity_received_cases).toFixed(2) : "-"}
                      </td>
                      <td className="px-2 py-1 text-right text-[11px]">{Number(r.loose_pieces_received) || 0}</td>
                      <td
                        className={
                          "px-2 py-1 text-right text-[11px]" +
                          (discrepancy !== 0 ? "font-semibold text-destructive" : "")
                        }
                      >
                        {discrepancy === 0 ? "-" : discrepancy}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : lines.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No products assigned to this container.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">PO #</th>
                  <th className="px-2 py-1">SKU / Var</th>
                  <th className="px-2 py-1">Product</th>
                  <th className="px-2 py-1 text-right">Qty (units)</th>
                  <th className="px-2 py-1 text-right">Qty (cases)</th>
                  <th className="px-2 py-1 text-right">Quantity received</th>
                  <th className="px-2 py-1 text-right">Discrepancy</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any) => {
                  const unitsPer = unitsPerMap.get(l.product_id as string) || 0;
                  const units = Number(l.quantity_units) || 0;
                  const cases = unitsPer > 0 ? units / unitsPer : null;
                  const received = Number(l.received_units) || 0;
                  const discrepancy = received - units;

                  return (
                    <tr key={l.id} className="border-b last:border-none">
                      <td className="py-1 pr-2 pl-3 font-mono text-[11px]">{l.po_number}</td>
                      <td className="px-2 py-1 text-[11px]">{l.sku}</td>
                      <td className="px-2 py-1 text-[11px]">{l.description}</td>
                      <td className="px-2 py-1 text-right text-[11px]">{units}</td>
                      <td className="px-2 py-1 text-right text-[11px]">{cases != null ? cases.toFixed(2) : "-"}</td>
                      <td className="px-2 py-1 text-right text-[11px]">{received}</td>
                      <td
                        className={
                          "px-2 py-1 text-right text-[11px]" +
                          (discrepancy !== 0 ? "font-semibold text-destructive" : "")
                        }
                      >
                        {discrepancy === 0 ? "-" : discrepancy}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
