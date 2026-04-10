import { NextResponse } from "next/server";

import { getPurchaseOrderLines } from "@/lib/containerPlanning/data";
import { getDemandPerSku } from "@/lib/containerPlanning/demand";
import { getStockPerSku } from "@/lib/containerPlanning/stock";
import { serverSupabase } from "@/lib/serverSupabase";

export async function GET() {
  try {
    const [poLines, demandBySku, stockBySku, allocatedItems] = await Promise.all([
      getPurchaseOrderLines(),
      getDemandPerSku(),
      getStockPerSku(),
      serverSupabase.from("container_items_v2").select("purchase_order_line_id, quantity"),
    ]);

    const demandMap = new Map<string, number>(
      (demandBySku as any[]).map((d: any) => [d.sku_id as string, Number(d.total_demand) || 0]),
    );

    const allocationMap = new Map<string, number>();
    for (const row of ((allocatedItems?.data as any[]) || [])) {
      const lineId = row.purchase_order_line_id as string | undefined;
      if (!lineId) continue;
      const qty = row.quantity != null ? Number(row.quantity) || 0 : 0;
      if (!Number.isFinite(qty) || qty <= 0) continue;
      allocationMap.set(lineId, (allocationMap.get(lineId) || 0) + qty);
    }

    const stockMap = new Map<string, number>(
      (stockBySku as any[]).map((s: any) => [s.sku_id as string, Number(s.total_stock) || 0]),
    );

    // Build SKU set from PO lines
    const skuIdSet = new Set<string>();
    for (const l of poLines as any[]) {
      if (l.sku_id) {
        skuIdSet.add(l.sku_id as string);
      }
    }

    // Load product metadata for all SKUs present in PO lines
    let productsMap: Record<string, { name: string | null; sku: string | null; variant: string | null }> = {};
    let dimensionRows: any[] = [];
    if (skuIdSet.size > 0) {
      const [{ data: productRows, error: productError }, { data: dimRows, error: dimError }] = await Promise.all([
        serverSupabase
          .from("products")
          .select("id, product_name, sku, sku_var")
          .in("id", Array.from(skuIdSet)),
        serverSupabase
          .from("product_dimensions")
          .select("product_id, kind, length, width, height, weight, units_per")
          .in("product_id", Array.from(skuIdSet)),
      ]);

      if (productError) {
        console.error("Error loading products for container planning debug", productError);
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
        console.error("Error loading product_dimensions for container planning debug", dimError);
      } else {
        dimensionRows = dimRows || [];
      }
    }

    // Build dimension maps per SKU
    const packageMap = new Map<string, any>();
    const cartonMap = new Map<string, any>();
    for (const d of dimensionRows || []) {
      const pid = d.product_id as string | undefined;
      if (!pid) continue;
      if (d.kind === "package") {
        packageMap.set(pid, d);
      } else if (d.kind === "carton") {
        cartonMap.set(pid, d);
      }
    }

    // Load basic PO metadata for all PO lines
    const poLineIdSet = new Set<string>();
    for (const l of poLines as any[]) {
      const lineId = (l.purchase_order_line_id as string) || (l.id as string) || "";
      if (lineId) poLineIdSet.add(lineId);
    }

    let purchaseOrdersMap: Record<string, { po_number: string | null; ship_date: string | null; status: string | null }> = {};
    if (poLineIdSet.size > 0) {
      const { data: poLineRows, error: poLineError } = await serverSupabase
        .from("purchase_order_lines")
        .select("id, purchase_orders!inner(po_number, ship_date, status)")
        .in("id", Array.from(poLineIdSet));

      if (poLineError) {
        console.error("Error loading purchase orders for container planning debug", poLineError);
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
    }

    // Build available_items directly from PO lines
    const availableItems = (poLines as any[])
      .map((l) => {
        const lineId = (l.purchase_order_line_id as string) || (l.id as string) || "";
        const skuId = (l.sku_id as string) || (l.product_id as string) || "";
        const poMeta = purchaseOrdersMap[lineId];
        if (!poMeta || poMeta.status !== "open") return null;

        const cartonsFloor = Number(l.cartons_floor) || 0;
        if (cartonsFloor <= 0) return null;

        const allocatedCartons = allocationMap.get(lineId) ?? 0;
        const remainingCartons = Math.max(cartonsFloor - allocatedCartons, 0);
        if (remainingCartons <= 0) return null;

        const unitsPer = l.units_per != null ? Number(l.units_per) : null;

        const pkg = packageMap.get(skuId);
        const carton = cartonMap.get(skuId);
        const missingUnitsPer = !pkg || pkg.units_per == null;
        const missingCartonDims =
          !carton ||
          carton.length == null ||
          carton.width == null ||
          carton.height == null ||
          carton.weight == null;
        const hasDataIssue = missingUnitsPer || missingCartonDims;

        const demandUnits = demandMap.get(skuId) ?? 0;
        const demandCartons = unitsPer ? Math.ceil(demandUnits / unitsPer) : 0;

        const stockCases = stockMap.get(skuId) ?? 0;
        const stockUnits = unitsPer ? stockCases * unitsPer : 0;
        const shortageUnits = Math.max(demandUnits - stockUnits, 0);
        const shortageCartons = unitsPer ? Math.ceil(shortageUnits / unitsPer) : 0;

        const length = Number(l.length) || 0;
        const width = Number(l.width) || 0;
        const height = Number(l.height) || 0;
        // assume dimensions are in inches; convert cubic inches → cubic meters
        const volumeM3 =
          length > 0 && width > 0 && height > 0
            ? (length * width * height) / 61023.744
            : 0;

        return {
          purchase_order_line_id: lineId,
          sku_id: skuId,
          product: productsMap[skuId] ?? null,
          po_number: poMeta.po_number,
          ship_date: poMeta.ship_date,
          cartons_total: remainingCartons,
          cartons_remaining: remainingCartons,
          units_per: unitsPer,
          demand_cartons: demandCartons,
          shortage_cartons: shortageCartons,
          has_data_issue: hasDataIssue,
          missing_units_per: missingUnitsPer,
          missing_carton_dims: missingCartonDims,
          carton_weight_kg: Number(l.weight) || 0,
          carton_volume_m3: volumeM3,
        } as const;
      })
      .filter(Boolean);

    return NextResponse.json({
      available_items: availableItems,
    });
  } catch (err) {
    console.error("Error in container planning debug endpoint", err);
    return NextResponse.json({ error: "Failed to generate container plan" }, { status: 500 });
  }
}
