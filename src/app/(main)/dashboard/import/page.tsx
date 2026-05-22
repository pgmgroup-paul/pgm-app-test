import { getPurchaseOrderLines } from "@/lib/containerPlanning/data";
import { serverSupabase } from "@/lib/serverSupabase";

import { ChartAreaInteractive } from "./_components/chart-area-interactive";
import { DataTable } from "./_components/data-table";
import { SectionCards } from "./_components/section-cards";

export default async function Page() {
  let containers: { id: string; container: string; eta: string; status: string }[] = [];
  let containersInTransitCount = 0;
  let skusIncomingCount = 0;
  let skuMissingCartonDimsCount = 0;
  let latestOceanFreightAmount = 0;
  let latestOceanFreightMeta: { paymentDate: string | null; forwarder: string | null } | null = null;
  let items: {
    id: string;
    sku: string;
    sku_var: string | null;
    product_name: string;
    qty_pieces: number;
    eta: string;
    container: string;
    status: string;
  }[] = [];

  try {
    const { data, error } = await serverSupabase
      .from("inbound_containers_list")
      .select("container_id, container_number, eta, shipment_status, items_detail")
      .eq("shipment_status", "In Transit")
      .order("eta", { ascending: true });

    if (error) {
      console.error("Error loading inbound containers/items for import dashboard", error);
    } else if (data) {
      const rows = data as any[];

      containersInTransitCount = rows.length;

      containers = rows
        .slice(0, 10)
        .map((row) => {
          const containerId = (row as any).container_id as string;
          const containerNumber = ((row as any).container_number as string | null) || containerId;
          const eta = ((row as any).eta as string | null) || "";
          const status = ((row as any).shipment_status as string | null) || "";

          return {
            id: containerId,
            container: containerNumber,
            eta,
            status,
          };
        });

      const flattenedItems: typeof items = [];
      const skuSet = new Set<string>();

      for (const row of rows) {
        const containerId = (row as any).container_id as string;
        const containerNumber = ((row as any).container_number as string | null) || containerId;
        const eta = ((row as any).eta as string | null) || "";
        const status = ((row as any).shipment_status as string | null) || "";
        const itemsDetail =
          typeof (row as any).items_detail === "string"
            ? JSON.parse((row as any).items_detail)
            : (row as any).items_detail || [];

        for (const [index, item] of (itemsDetail as any[]).entries()) {
          const rawSku = (item.sku as string) || "";
          const normalizedSku = rawSku.trim().toUpperCase();

          flattenedItems.push({
            id: `${containerId}-${rawSku}-${index}`,
            sku: rawSku,
            sku_var: null,
            product_name: (item.product_name as string) || "",
            qty_pieces: Number((item.units as number) || 0),
            eta,
            container: containerNumber,
            status,
          });

          if (normalizedSku) {
            skuSet.add(normalizedSku);
          }

          if (flattenedItems.length >= 15) {
            break;
          }
        }

        if (flattenedItems.length >= 15) {
          break;
        }
      }

      items = flattenedItems;
      skusIncomingCount = skuSet.size;
    }
  } catch (err) {
    console.error("Unexpected error loading inbound containers/items for import dashboard", err);
  }

  // Compute SKU Missing Carton Dimensions KPI using the same logic as /container-planning
  try {
    const poLines = await getPurchaseOrderLines();

    if (poLines.length > 0) {
      // Build SKU set from PO lines
      const skuIdSet = new Set<string>();
      const poLineIdSet = new Set<string>();

      for (const l of poLines as any[]) {
        if (l.sku_id) {
          skuIdSet.add(l.sku_id as string);
        }
        if (l.purchase_order_line_id) {
          poLineIdSet.add(l.purchase_order_line_id as string);
        }
      }

      // Load product metadata + product_dimensions for all SKUs present in PO lines
      let productsMap: Record<string, { name: string | null; sku: string | null; variant: string | null }> = {};
      let dimensionRows: any[] = [];

      if (skuIdSet.size > 0) {
        const [productsResult, dimensionsResult] = await Promise.all([
          serverSupabase
            .from("products")
            .select("id, product_name, sku, sku_var")
            .in("id", Array.from(skuIdSet)),
          serverSupabase
            .from("product_dimensions")
            .select("product_id, kind, length, width, height, weight, units_per")
            .in("product_id", Array.from(skuIdSet)),
        ] as const);

        const { data: productRows, error: productError } = productsResult;
        const { data: dimRows, error: dimError } = dimensionsResult;

        if (productError) {
          console.error("Error loading products for missing carton dimensions KPI", productError);
        } else {
          for (const row of productRows || []) {
            const r: any = row;
            productsMap[r.id as string] = {
              name: (r.product_name as string) || null,
              sku: (r.sku as string) || null,
              variant: (r.sku_var as string) || null,
            };
          }
        }

        if (dimError) {
          console.error("Error loading product_dimensions for missing carton dimensions KPI", dimError);
        } else {
          dimensionRows = dimRows || [];
        }
      }

      // Build dimension maps per SKU (reuse /container-planning carton logic)
      const cartonMap = new Map<string, any>();
      for (const d of dimensionRows || []) {
        const pid = d.product_id as string | undefined;
        if (!pid) continue;
        if (d.kind === "carton") {
          cartonMap.set(pid, d);
        }
      }

      // Load basic PO metadata and existing container allocations
      let purchaseOrdersMap: Record<string, { po_number: string | null; ship_date: string | null; status: string | null }> = {};
      const allocationMap = new Map<string, number>();

      const [allocatedItemsResult, poLineMetaResult] = await Promise.all([
        serverSupabase.from("container_items_v2").select("purchase_order_line_id, quantity"),
        poLineIdSet.size > 0
          ? serverSupabase
              .from("purchase_order_lines")
              .select("id, purchase_orders!inner(po_number, ship_date, status)")
              .in("id", Array.from(poLineIdSet))
          : Promise.resolve({ data: [] as any[], error: null }),
      ] as const);

      const { data: allocatedItemsData, error: allocatedItemsError } = allocatedItemsResult;
      const { data: poLineRows, error: poLineError } = poLineMetaResult as {
        data: any[] | null;
        error: any;
      };

      if (allocatedItemsError) {
        console.error("Error loading allocated container items for missing carton dimensions KPI", allocatedItemsError);
      } else {
        for (const row of (allocatedItemsData as any[]) || []) {
          const lineId = row.purchase_order_line_id as string | undefined;
          if (!lineId) continue;
          const qty = row.quantity != null ? Number(row.quantity) || 0 : 0;
          if (!Number.isFinite(qty) || qty <= 0) continue;
          allocationMap.set(lineId, (allocationMap.get(lineId) || 0) + qty);
        }
      }

      if (poLineError) {
        console.error("Error loading purchase orders for missing carton dimensions KPI", poLineError);
      } else {
        for (const row of poLineRows || []) {
          const r: any = row;
          const poLineId = (r.id as string) || "";
          const po = r.purchase_orders as any;
          const poNumber = (po?.po_number as string) || null;
          const shipDate = (po?.ship_date as string) || null;
          const status = (po?.status as string) || null;
          if (poLineId) {
            purchaseOrdersMap[poLineId] = { po_number: poNumber, ship_date: shipDate, status };
          }
        }
      }

      // Walk PO lines using the same availability filters as /container-planning
      const missingSkuSet = new Set<string>();

      for (const l of poLines as any[]) {
        const lineId = (l.purchase_order_line_id as string) || "";
        const skuId = (l.sku_id as string) || "";
        if (!lineId || !skuId) continue;

        const poMeta = purchaseOrdersMap[lineId];
        if (!poMeta || poMeta.status !== "open") continue;

        const cartonsFloor = Number(l.cartons_floor) || 0;
        if (cartonsFloor <= 0) continue;

        const allocatedCartons = allocationMap.get(lineId) ?? 0;
        const remainingCartons = Math.max(cartonsFloor - allocatedCartons, 0);
        if (remainingCartons <= 0) continue;

        const carton = cartonMap.get(skuId);
        const missingCartonDims =
          !carton ||
          carton.length == null ||
          carton.width == null ||
          carton.height == null ||
          carton.weight == null;

        if (!missingCartonDims) continue;

        const rawSku = ((productsMap[skuId]?.sku as string | undefined) || skuId || "").trim().toUpperCase();
        if (rawSku) {
          missingSkuSet.add(rawSku);
        }
      }

      skuMissingCartonDimsCount = missingSkuSet.size;
    }
  } catch (err) {
    console.error("Unexpected error loading SKU Missing Carton Dimensions KPI", err);
  }

  // Compute Latest Ocean Freight KPI from forwarder_payments (same source as /container-payments)
  try {
    const { data, error } = await serverSupabase
      .from("forwarder_payments")
      .select("payment_date, total_amount, forwarder")
      .order("payment_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error loading latest ocean freight payment for KPI", error);
    } else if (data) {
      const row: any = data;
      const amount = row.total_amount != null ? Number(row.total_amount) || 0 : 0;
      latestOceanFreightAmount = Number.isFinite(amount) ? amount : 0;
      latestOceanFreightMeta = {
        paymentDate: (row.payment_date as string) || null,
        forwarder: (row.forwarder as string) || null,
      };
    }
  } catch (err) {
    console.error("Unexpected error loading Latest Ocean Freight KPI", err);
  }

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <SectionCards
        containersInTransitCount={containersInTransitCount}
        skusIncomingCount={skusIncomingCount}
        skuMissingCartonDimsCount={skuMissingCartonDimsCount}
        latestOceanFreightAmount={latestOceanFreightAmount}
        latestOceanFreightMeta={latestOceanFreightMeta}
      />
      <ChartAreaInteractive />
      <DataTable containers={containers} items={items} />
    </div>
  );
}
