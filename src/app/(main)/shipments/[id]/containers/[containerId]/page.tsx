import Link from "next/link";
import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

import ContainerShipmentEventsSection from "./ContainerShipmentEventsSection";
import ContainerTabs from "./ContainerTabs";

export const dynamic = "force-dynamic";

async function loadContainer(shipmentId: string, containerId: string) {
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

  // Load container items from shipment_items joined to PO + product
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
        purchase_order_line_id: line?.id as string,
        sku: (line?.sku as string) || "",
        description: (line?.description as string) || "",
        quantity_units: Number(it.quantity) || 0,
        received_units: Number(line?.quantity_received) || 0,
      };
    }) ?? [];

  const productIds = Array.from(new Set(lines.map((l) => l.product_id)));
  const unitsPerMap = new Map<string, number>();
  const caseVolumeMap = new Map<string, number>(); // m3 per case
  const caseWeightMap = new Map<string, number>(); // kg per case

  if (productIds.length > 0) {
    const { data: dims, error: dimsError } = await serverSupabase
      .from("product_dimensions")
      .select("product_id, kind, length, width, height, weight, units_per")
      .in("product_id", productIds);

    if (dimsError) {
      console.error("Error loading product dimensions for container view", dimsError);
    }

    const IN3_TO_M3 = 0.000016387064;
    const LB_TO_KG = 0.45359237;

    for (const d of dims || []) {
      const pid = d.product_id as string;
      const kind = (d as any).kind as string | undefined;
      const unitsPer = Number(d.units_per) || 0;
      const lengthIn = Number(d.length) || 0;
      const widthIn = Number(d.width) || 0;
      const heightIn = Number(d.height) || 0;
      const weightLb = Number(d.weight) || 0;

      // Use carton/case/package rows as potential case dimensions
      const isCaseLike = kind === "carton" || kind === "case" || kind === "package";

      if (unitsPer > 0 && !unitsPerMap.has(pid)) {
        unitsPerMap.set(pid, unitsPer);
      }

      if (isCaseLike && lengthIn > 0 && widthIn > 0 && heightIn > 0) {
        const volumeM3 = lengthIn * widthIn * heightIn * IN3_TO_M3;
        if (!caseVolumeMap.has(pid)) {
          caseVolumeMap.set(pid, volumeM3);
        }
      }

      if (isCaseLike && weightLb > 0) {
        const weightKg = weightLb * LB_TO_KG;
        if (!caseWeightMap.has(pid)) {
          caseWeightMap.set(pid, weightKg);
        }
      }
    }
  }

  // Compute total container weight/volume used (metric)
  let totalWeightKg = 0;
  let totalVolumeM3 = 0;

  for (const line of lines) {
    const units = line.quantity_units as number;
    const unitsPer = unitsPerMap.get(line.product_id) || 0;
    if (unitsPer <= 0) continue;
    const cases = units / unitsPer;
    const caseVol = caseVolumeMap.get(line.product_id) || 0;
    const caseWt = caseWeightMap.get(line.product_id) || 0;
    totalVolumeM3 += cases * caseVol;
    totalWeightKg += cases * caseWt;
  }

  return { shipment, container, lines, unitsPerMap, totalWeightKg, totalVolumeM3 };
}

async function loadPoLinesWithBalance(poNumber: string) {
  const { data: po, error: poError } = await serverSupabase
    .from("purchase_orders")
    .select("id, po_number")
    .eq("po_number", poNumber)
    .maybeSingle();

  if (poError || !po) {
    console.error("Error resolving PO number for container allocation", poError);
    return { po: null, lines: [] };
  }

  const poId = po.id as string;

  const { data: lines, error: linesError } = await serverSupabase
    .from("purchase_order_lines")
    .select("id, product_id, sku, sku_var, description, quantity_cases, quantity_shipped, quantity_received")
    .eq("purchase_order_id", poId)
    .order("created_at", { ascending: true });

  if (linesError) {
    console.error("Error loading PO lines for container allocation", linesError);
    return { po, lines: [] };
  }

  return { po, lines: lines ?? [] };
}

export async function saveShipmentEvents(formData: FormData) {
  "use server";

  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { ok: false, error: "Not authorized" };
  }

  const shipmentContainerId = (formData.get("shipment_container_id") || "").toString().trim();
  const etdRaw = (formData.get("events_etd") || "").toString().trim();
  const etaRaw = (formData.get("events_eta") || "").toString().trim();
  const bol = (formData.get("events_bol") || "").toString().trim();

  if (!shipmentContainerId) {
    return { ok: false, error: "Missing container id" };
  }

  const { error } = await serverSupabase.from("shipment_container_events").upsert(
    {
      shipment_container_id: shipmentContainerId,
      isf_etd: etdRaw || null,
      isf_eta: etaRaw || null,
      bol_number: bol || null,
    },
    { onConflict: "shipment_container_id" },
  );

  if (error) {
    console.error("Error saving shipment_container_events", error);
    return { ok: false, error: "Failed to save shipment events" };
  }

  return { ok: true };
}

export default async function ShipmentContainerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; containerId: string }>;
  searchParams: Promise<{ po_number?: string; error?: string; success?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return <div className="p-6 text-destructive text-sm">Not authorized to view this page.</div>;
  }

  const { id: shipmentId, containerId } = await params;
  const { po_number, error, success } = await searchParams;
  const containerUpdateSuccess = success === "container-updated";

  // Load open purchase orders for the PO dropdown
  const { data: openPos, error: poError } = await serverSupabase
    .from("purchase_orders")
    .select("po_number, status")
    .eq("status", "open")
    .order("po_number", { ascending: true });

  if (poError) {
    console.error("Error loading open purchase orders for container page", poError);
  }

  const poOptions = (openPos ?? []).map((po: any) => po.po_number as string);

  const data = await loadContainer(shipmentId, containerId);

  if (!data) {
    return <div className="p-6 text-destructive text-sm">Container not found.</div>;
  }

  const { shipment, container, lines, unitsPerMap, totalWeightKg, totalVolumeM3 } = data as any;

  let poLines: any[] = [];
  let currentPoNumber: string | null = null;

  if (po_number) {
    currentPoNumber = po_number;
    const { lines: loadedLines } = await loadPoLinesWithBalance(po_number);
    poLines = loadedLines;
  }

  // Pre-compute demand / shortage per product for PO lines
  // Demand: total Sales Order demand (open/processing)
  // Shortage: Demand - Quantity in stock
  const demandByProduct = new Map<string, number>();
  const shortageByProduct = new Map<string, number>();

  if (poLines.length > 0) {
    const poProductIds = Array.from(new Set(poLines.map((l: any) => (l.product_id as string) || "").filter(Boolean)));

    if (poProductIds.length > 0) {
      // 1) Ensure unitsPerMap has entries for these products (for stock calculation)
      const missingForUnits = poProductIds.filter((pid) => !unitsPerMap.has(pid));
      if (missingForUnits.length > 0) {
        const { data: extraDims, error: extraDimsError } = await serverSupabase
          .from("product_dimensions")
          .select("product_id, units_per")
          .in("product_id", missingForUnits);

        if (extraDimsError) {
          console.error("Error loading extra product_dimensions for shortage in container page", extraDimsError);
        }

        for (const d of extraDims || []) {
          const pid = (d as any).product_id as string;
          const u = Number((d as any).units_per) || 0;
          if (u > 0 && !unitsPerMap.has(pid)) unitsPerMap.set(pid, u);
        }
      }

      // 2) Quantity in stock: inventory_location * units_per
      const { data: locRows, error: locError } = await serverSupabase
        .from("inventory_location")
        .select("product_id, quantity_cases")
        .in("product_id", poProductIds);

      if (locError) {
        console.error("Error loading inventory_location for shortage in container page", locError);
      }

      const stockUnitsByProduct = new Map<string, number>();
      for (const row of locRows || []) {
        const pid = (row as any).product_id as string;
        const cases = Number((row as any).quantity_cases) || 0;
        const unitsPer = unitsPerMap.get(pid) || 0;
        if (!pid || cases <= 0 || unitsPer <= 0) continue;
        stockUnitsByProduct.set(pid, (stockUnitsByProduct.get(pid) || 0) + cases * unitsPer);
      }

      // 3) SO demand: sum quantity_units from sales_order_lines with open/processing orders
      const { data: soLinesRaw, error: soError } = await serverSupabase
        .from("sales_order_lines")
        .select(
          `product_id,
           quantity_units,
           sales_orders!inner(id, status)`,
        )
        .in("product_id", poProductIds)
        .in("sales_orders.status", ["open", "processing"]);

      if (soError) {
        console.error("Error loading sales_order_lines for demand in container page", soError);
      }

      const soUnitsByProduct = new Map<string, number>();
      for (const row of soLinesRaw || []) {
        const pid = (row as any).product_id as string;
        const so = (row as any).sales_orders as any;
        if (!pid || !so) continue;
        const qty = Number((row as any).quantity_units) || 0;
        if (qty <= 0) continue;
        soUnitsByProduct.set(pid, (soUnitsByProduct.get(pid) || 0) + qty);
      }

      // 4) Demand = total SO demand; Shortage = Demand - Quantity in stock
      for (const pid of poProductIds) {
        const stockUnits = stockUnitsByProduct.get(pid) || 0;
        const soUnits = soUnitsByProduct.get(pid) || 0;
        demandByProduct.set(pid, soUnits);
        shortageByProduct.set(pid, soUnits - stockUnits);
      }
    }
  }

  return (
    <div className="max-w-5xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg tracking-tight">Container</h1>
        <p className="text-muted-foreground text-sm">
          Shipment{" "}
          <Link href={`/shipments/${shipment.id}`} className="underline">
            {shipment.shipment_number}
          </Link>{" "}
          – Container {container.container_number || "(pending)"}
        </p>
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Container</div>
            <div className="text-[11px]">
              {container.container_number || "(pending)"} • {container.type || "type?"} • {container.status}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Seal</div>
            <div className="text-[11px]">{container.seal_number || "-"}</div>
          </div>
        </div>
      </div>

      {/* Contents / Shipment events */}
      <ContainerTabs
        contents={
          <>
            <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
              {/* Contents tab: show planned allocations */}
              {lines.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No products assigned to this container yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-2 pl-3">PO #</th>
                        <th className="px-2 py-1">SKU</th>
                        <th className="px-2 py-1">Product</th>
                        <th className="px-2 py-1 text-right">Qty (units)</th>
                        <th className="px-2 py-1 text-right">Qty (cases)</th>
                        <th className="px-2 py-1 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l: any) => {
                        const unitsPer = unitsPerMap.get(l.product_id as string) || 0;
                        const units = Number(l.quantity_units) || 0;
                        const cases = unitsPer > 0 ? units / unitsPer : null;

                        return (
                          <tr key={l.id} className="border-b last:border-none">
                            <td className="py-1 pr-2 pl-3 font-mono text-[11px]">{l.po_number}</td>
                            <td className="px-2 py-1 text-[11px]">{l.sku}</td>
                            <td className="px-2 py-1 text-[11px]">{l.description}</td>
                            <td className="px-2 py-1 text-right text-[11px]">{units}</td>
                            <td className="px-2 py-1 text-right text-[11px]">
                              {cases != null ? cases.toFixed(2) : "-"}
                            </td>
                            <td className="px-2 py-1 text-right text-[11px]">
                              <form
                                action={async (formData: FormData) => {
                                  "use server";

                                  const profile = await getCurrentUserProfile();

                                  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
                                    redirect("/unauthorized");
                                  }

                                  const shipmentIdFromForm = (formData.get("shipment_id") || "").toString().trim();
                                  const containerIdFromForm = (formData.get("shipment_container_id") || "")
                                    .toString()
                                    .trim();
                                  const shipmentItemId = (formData.get("shipment_item_id") || "").toString().trim();
                                  const poLineIdFromForm = (formData.get("purchase_order_line_id") || "")
                                    .toString()
                                    .trim();
                                  const qtyRaw = (formData.get("quantity_units") || "").toString().trim();

                                  if (
                                    !shipmentIdFromForm ||
                                    !containerIdFromForm ||
                                    !shipmentItemId ||
                                    !poLineIdFromForm ||
                                    !qtyRaw
                                  ) {
                                    redirect(`/shipments/${shipmentIdFromForm}/containers/${containerIdFromForm}`);
                                  }

                                  const qty = Number(qtyRaw);

                                  // Load current shipped for the PO line
                                  const { data: line, error: lineError } = await serverSupabase
                                    .from("purchase_order_lines")
                                    .select("id, quantity_shipped")
                                    .eq("id", poLineIdFromForm)
                                    .maybeSingle();

                                  if (lineError || !line) {
                                    console.error("Error loading PO line for delete", lineError);
                                    redirect(`/shipments/${shipmentIdFromForm}/containers/${containerIdFromForm}`);
                                  }

                                  const currentShipped = Number(line.quantity_shipped) || 0;
                                  const newShipped = Math.max(currentShipped - qty, 0);

                                  const { error: delError } = await serverSupabase
                                    .from("shipment_items")
                                    .delete()
                                    .eq("id", shipmentItemId);

                                  if (delError) {
                                    console.error("Error deleting shipment_item", delError);
                                    redirect(`/shipments/${shipmentIdFromForm}/containers/${containerIdFromForm}`);
                                  }

                                  const { error: updError } = await serverSupabase
                                    .from("purchase_order_lines")
                                    .update({ quantity_shipped: newShipped })
                                    .eq("id", poLineIdFromForm);

                                  if (updError) {
                                    console.error("Error updating quantity_shipped on delete", updError);
                                  }

                                  redirect(`/shipments/${shipmentIdFromForm}/containers/${containerIdFromForm}`);
                                }}
                                className="inline"
                              >
                                <input type="hidden" name="shipment_id" value={shipment.id as string} />
                                <input type="hidden" name="shipment_container_id" value={container.id as string} />
                                <input type="hidden" name="shipment_item_id" value={l.id as string} />
                                <input
                                  type="hidden"
                                  name="purchase_order_line_id"
                                  value={l.purchase_order_line_id as string}
                                />
                                <input type="hidden" name="quantity_units" value={units} />
                                <button
                                  type="submit"
                                  className="inline-flex items-center rounded-md border px-2 py-0.5 font-medium text-[10px] text-destructive hover:bg-destructive/10"
                                >
                                  Delete
                                </button>
                              </form>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Container limits (metric) */}
            <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
              <div className="font-medium text-[11px]">Container limits (metric)</div>
              <table className="w-full text-left text-[11px]">
                <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2 pl-3">&nbsp;</th>
                    <th className="px-2 py-1 text-right">Weight (kg)</th>
                    <th className="px-2 py-1 text-right">Volume (m³)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-1 pr-2 pl-3 text-[11px]">Used</td>
                    <td
                      className={
                        "px-2 py-1 text-right text-[11px]" +
                        (totalWeightKg > 20000 ? "font-semibold text-destructive" : "")
                      }
                    >
                      {totalWeightKg.toFixed(1)}
                    </td>
                    <td
                      className={
                        "px-2 py-1 text-right text-[11px]" +
                        (totalVolumeM3 > 68 ? "font-semibold text-destructive" : "")
                      }
                    >
                      {totalVolumeM3.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-2 pl-3 text-[11px]">Limit</td>
                    <td className="px-2 py-1 text-right text-[11px]">20000</td>
                    <td className="px-2 py-1 text-right text-[11px]">68.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Update container metadata */}
            <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
              <div className="font-medium text-[11px]">Update container</div>
              <form
                action={async (formData: FormData) => {
                  "use server";

                  const profile = await getCurrentUserProfile();

                  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
                    redirect("/unauthorized");
                  }

                  const containerIdFromForm = (formData.get("container_id") || "").toString().trim();
                  const containerNumber = (formData.get("container_number") || "").toString().trim();
                  const type = (formData.get("type") || "").toString().trim();
                  const seal = (formData.get("seal_number") || "").toString().trim();
                  const status = (formData.get("status") || "").toString().trim();

                  if (!containerIdFromForm) {
                    redirect(`/shipments/${shipmentId}/edit`);
                  }

                  const { error: updError } = await serverSupabase
                    .from("shipment_containers")
                    .update({
                      container_number: containerNumber || null,
                      type: type || null,
                      seal_number: seal || null,
                      status: status || "planned",
                    })
                    .eq("id", containerIdFromForm);

                  if (updError) {
                    console.error("Error updating shipment container", updError);
                    redirect(`/shipments/${shipmentId}/containers/${containerIdFromForm}`);
                  }

                  // On success, stay on the same page and surface a success flag via search params.
                  redirect(`/shipments/${shipmentId}/containers/${containerIdFromForm}?success=container-updated`);
                }}
                className="grid grid-cols-1 gap-3 sm:grid-cols-5"
              >
                <input type="hidden" name="container_id" value={container.id as string} />
                <div className="space-y-1">
                  <label htmlFor="container_number" className="font-medium text-[11px]">
                    Container #
                  </label>
                  <input
                    id="container_number"
                    name="container_number"
                    type="text"
                    defaultValue={container.container_number ?? ""}
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="type" className="font-medium text-[11px]">
                    Type
                  </label>
                  <input
                    id="type"
                    name="type"
                    type="text"
                    defaultValue={container.type ?? ""}
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="seal_number" className="font-medium text-[11px]">
                    Seal
                  </label>
                  <input
                    id="seal_number"
                    name="seal_number"
                    type="text"
                    defaultValue={container.seal_number ?? ""}
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="status" className="font-medium text-[11px]">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={container.status as string}
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="planned">Planned</option>
                    <option value="loaded">Loaded</option>
                    <option value="gate_out">Gate out</option>
                    <option value="on_water">On water</option>
                    <option value="arrived">Arrived</option>
                    <option value="unloaded">Unloaded</option>
                    <option value="received">Received</option>
                    <option value="returned">Returned</option>
                  </select>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-md border px-3 py-1.5 font-medium text-[11px] hover:bg-muted"
                  >
                    Save container
                  </button>
                  {containerUpdateSuccess && <p className="text-[11px] text-emerald-700">Container updated</p>}
                </div>
              </form>
            </div>

            {/* Add product from PO */}
            <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
              <div className="font-medium text-[11px]">Add product from PO</div>

              {/* PO selector */}
              <form method="GET" className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="space-y-1 sm:col-span-3">
                  <label htmlFor="po_number" className="font-medium text-[11px]">
                    Purchase order (for line picker)
                  </label>
                  <select
                    id="po_number"
                    name="po_number"
                    defaultValue={currentPoNumber ?? ""}
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Select open PO…</option>
                    {poOptions.map((num) => (
                      <option key={num} value={num}>
                        {num}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-md border px-3 py-1.5 font-medium text-[11px] hover:bg-muted"
                  >
                    Load PO lines
                  </button>
                </div>
              </form>

              {currentPoNumber && poLines.length > 0 && (
                <form
                  action={async (formData: FormData) => {
                    "use server";

                    const profile = await getCurrentUserProfile();

                    if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
                      redirect("/unauthorized");
                    }

                    const shipmentIdFromForm = (formData.get("shipment_id") || "").toString().trim();
                    const containerIdFromForm = (formData.get("shipment_container_id") || "").toString().trim();
                    const poNumberFromForm = (formData.get("po_number") || "").toString().trim();

                    // Find the first qty_* field with a positive number; that's the selected line
                    let poLineId = "";
                    let qtyRaw = "";
                    for (const [key, value] of formData.entries()) {
                      if (!key.startsWith("qty_")) continue;
                      const v = (value || "").toString().trim();
                      if (!v) continue;
                      const n = Number(v);
                      if (!Number.isFinite(n) || n <= 0) continue;
                      poLineId = key.replace("qty_", "");
                      qtyRaw = v;
                      break;
                    }

                    if (!shipmentIdFromForm || !containerIdFromForm || !poLineId || !qtyRaw) {
                      redirect(
                        `/shipments/${shipmentIdFromForm}/containers/${containerIdFromForm}?po_number=${poNumberFromForm}&error=missing-fields`,
                      );
                    }

                    const qty = Number(qtyRaw);
                    if (!Number.isFinite(qty) || qty <= 0) {
                      redirect(
                        `/shipments/${shipmentIdFromForm}/containers/${containerIdFromForm}?po_number=${poNumberFromForm}&error=bad-qty`,
                      );
                    }

                    const { data: line, error: lineError } = await serverSupabase
                      .from("purchase_order_lines")
                      .select("id, purchase_order_id, quantity_cases, quantity_shipped, quantity_received")
                      .eq("id", poLineId)
                      .maybeSingle();

                    if (lineError || !line) {
                      console.error("Error loading PO line for allocation", lineError);
                      redirect(
                        `/shipments/${shipmentIdFromForm}/containers/${containerIdFromForm}?po_number=${poNumberFromForm}&error=load-line`,
                      );
                    }

                    const currentShipped = Number(line.quantity_shipped) || 0;
                    const currentReceived = Number(line.quantity_received) || 0;
                    const orderedUnits = Number(line.quantity_cases) || 0; // treat as units for now

                    const maxUnitsFromOrder = orderedUnits;
                    const alreadyAllocatedUnits = currentShipped;
                    const alreadyReceivedUnits = currentReceived;

                    const totalIfAllocated = alreadyAllocatedUnits + qty;
                    const totalIncludingReceived = alreadyAllocatedUnits + alreadyReceivedUnits + qty;

                    if (maxUnitsFromOrder > 0 && totalIfAllocated > maxUnitsFromOrder) {
                      redirect(
                        `/shipments/${shipmentIdFromForm}/containers/${containerIdFromForm}?po_number=${poNumberFromForm}&error=over-order`,
                      );
                    }

                    if (maxUnitsFromOrder > 0 && totalIncludingReceived > maxUnitsFromOrder) {
                      redirect(
                        `/shipments/${shipmentIdFromForm}/containers/${containerIdFromForm}?po_number=${poNumberFromForm}&error=over-order-inc-received`,
                      );
                    }

                    const { error: insError } = await serverSupabase.from("shipment_items").insert({
                      shipment_container_id: containerIdFromForm,
                      purchase_order_line_id: poLineId,
                      quantity: qty,
                    });

                    if (insError) {
                      console.error("Error inserting shipment_item", insError);
                      redirect(
                        `/shipments/${shipmentIdFromForm}/containers/${containerIdFromForm}?po_number=${poNumberFromForm}&error=insert-item`,
                      );
                    }

                    const { error: updError } = await serverSupabase
                      .from("purchase_order_lines")
                      .update({ quantity_shipped: alreadyAllocatedUnits + qty })
                      .eq("id", poLineId);

                    if (updError) {
                      console.error("Error updating quantity_shipped", updError);
                    }

                    redirect(
                      `/shipments/${shipmentIdFromForm}/containers/${containerIdFromForm}?po_number=${poNumberFromForm}`,
                    );
                  }}
                >
                  <input type="hidden" name="shipment_id" value={shipment.id as string} />
                  <input type="hidden" name="shipment_container_id" value={container.id as string} />
                  <input type="hidden" name="po_number" value={currentPoNumber} />

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                        <tr>
                          <th className="py-1 pr-2 pl-3">SKU</th>
                          <th className="px-2 py-1">Description</th>
                          <th className="px-2 py-1 text-right">Ordered (units)</th>
                          <th className="px-2 py-1 text-right">Shipped (units)</th>
                          <th className="px-2 py-1 text-right">Received (units)</th>
                          <th className="px-2 py-1 text-right">Units per case</th>
                          <th className="px-2 py-1 text-right">Allocate (units)</th>
                          <th className="px-2 py-1 text-right">Demand</th>
                          <th className="px-2 py-1 text-right">Shortage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poLines.map((line: any) => {
                          const unitsPer = unitsPerMap.get(line.product_id as string) || 0;
                          const orderedCases = Number(line.quantity_cases) || 0;
                          const shippedUnits = Number(line.quantity_shipped) || 0;
                          const receivedUnits = Number(line.quantity_received) || 0;

                          return (
                            <tr key={line.id} className="border-b last:border-none">
                              <td className="py-1 pr-2 pl-3 font-mono text-[11px]">{line.sku}</td>
                              <td className="px-2 py-1 text-[11px]">{line.description}</td>
                              <td className="px-2 py-1 text-right text-[11px]">{orderedCases}</td>
                              <td className="px-2 py-1 text-right text-[11px]">{shippedUnits}</td>
                              <td className="px-2 py-1 text-right text-[11px]">{receivedUnits}</td>
                              <td className="px-2 py-1 text-right text-[11px]">{unitsPer}</td>
                              <td className="px-2 py-1 text-right text-[11px]">
                                <input
                                  type="number"
                                  min={0}
                                  name={`qty_${line.id}`}
                                  className="w-24 rounded-md border border-input bg-background px-2 py-0.5 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                              </td>
                              <td className="px-2 py-1 text-right text-[11px]">
                                <Link
                                  href={`/shipments/demand?sku=${encodeURIComponent(
                                    (line.sku as string) || "",
                                  )}&var=${encodeURIComponent((line.sku_var as string) || "")}`}
                                  className="underline"
                                >
                                  {demandByProduct.get(line.product_id as string) ?? 0}
                                </Link>
                              </td>
                              <td className="px-2 py-1 text-right text-[11px]">
                                {Math.max(shortageByProduct.get(line.product_id as string) ?? 0, 0)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2 flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
                    >
                      Add to container
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        }
        events={<ContainerShipmentEventsSection shipmentContainerId={container.id as string} />}
      />
    </div>
  );
}
