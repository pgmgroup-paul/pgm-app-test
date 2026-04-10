"use server";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export interface DeductLocationState {
  ok: boolean | null;
  error?: string;
  productName?: string;
  productId?: string;
  shipments?: {
    id: string;
    sales_order_id: string;
    order_number: string;
    shipment_sequence: number;
    status: string;
    qty_ordered_units: number;
    qty_remaining_units: number;
    qty_ordered_cases: number;
    qty_remaining_cases: number;
  }[];
  rows?: {
    location_id: string;
    warehouse_name: string;
    location_code: string;
    quantity_cases: number;
  }[];
}

export async function loadDeductLocations(
  _prev: DeductLocationState,
  formData: FormData,
): Promise<DeductLocationState> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }

  const sku = (formData.get("sku") || "").toString().trim();
  const skuVar = (formData.get("sku_var") || "").toString().trim();
  const shipmentIdFromForm = (formData.get("shipment_id") || "").toString().trim();

  if (!sku) {
    return { ok: false, error: "SKU is required" };
  }

  const supabase = serverSupabase;

  // 1) Resolve product by sku / sku_var (case-insensitive)
  const _normalizedSku = sku.toLowerCase();
  const _normalizedVar = skuVar.toLowerCase();

  let productQuery = supabase.from("products").select("id, sku, sku_var, product_name").ilike("sku", sku);

  if (skuVar) {
    productQuery = productQuery.ilike("sku_var", skuVar);
  } else {
    productQuery = productQuery.is("sku_var", null);
  }

  const { data: product, error: productError } = await productQuery.maybeSingle();

  if (productError || !product) {
    console.error("Error finding product for deduct", productError);
    return { ok: false, error: "Product not found for that SKU / variant (case-insensitive lookup)" };
  }

  // 2) Load all locations for this product
  const { data: rows, error: locError } = await supabase
    .from("inventory_location")
    .select(
      `location_id,
       quantity_cases,
       locations ( code, warehouses ( name ) )`,
    )
    .eq("product_id", product.id);

  if (locError) {
    console.error("Error loading locations for deduct", locError);
    return { ok: false, error: "Error loading locations" };
  }

  const normalized = (rows || []).map((r: any) => ({
    location_id: r.location_id as string,
    warehouse_name: (r.locations?.warehouses?.name as string) || "",
    location_code: (r.locations?.code as string) || "",
    quantity_cases: Number(r.quantity_cases) || 0,
  }));

  // Load units_per (units per case) for this product from the 'package' row
  let unitsPerCase = 0;
  const { data: dim, error: dimError } = await supabase
    .from("product_dimensions")
    .select("units_per, kind")
    .eq("product_id", product.id as string)
    .eq("kind", "package")
    .maybeSingle();

  if (dimError) {
    console.error("Error loading product_dimensions for deduct", dimError);
  } else if (dim && typeof (dim as any).units_per !== "undefined") {
    const u = Number((dim as any).units_per) || 0;
    if (u > 0) unitsPerCase = u;
  }

  // Load shipments in processing status that include this product
  let shipmentsQuery = supabase
    .from("so_shipments")
    .select(
      `id,
       sales_order_id,
       shipment_sequence,
       status,
       so_shipment_lines!inner(product_id),
       sales_orders!inner(order_number)`,
    )
    .eq("status", "processing")
    .eq("so_shipment_lines.product_id", product.id);

  if (shipmentIdFromForm) {
    shipmentsQuery = shipmentsQuery.eq("id", shipmentIdFromForm);
  }

  const { data: shipmentsRaw, error: shipmentsError } = await shipmentsQuery;

  if (shipmentsError) {
    console.error("Error loading shipments for deduct", shipmentsError);
  }

  const shipments = (shipmentsRaw || []).map((s: any) => ({
    id: s.id as string,
    sales_order_id: s.sales_order_id as string,
    order_number: (s.sales_orders?.order_number as string) || "",
    shipment_sequence: Number(s.shipment_sequence) || 0,
    status: s.status as string,
    qty_ordered_units: 0,
    qty_remaining_units: 0,
    qty_ordered_cases: 0,
    qty_remaining_cases: 0,
  }));

  // Load ordered & picked cases per shipment for this product (matches orders-to-process logic)
  if (shipments.length > 0) {
    const shipmentIds = shipments.map((s) => s.id);

    // 1) ordered_cases from so_shipment_lines for this shipment+product
    const { data: soLines, error: soLinesError } = await supabase
      .from("so_shipment_lines")
      .select("so_shipment_id, quantity_shipped_units")
      .eq("product_id", product.id as string)
      .in("so_shipment_id", shipmentIds);

    if (soLinesError) {
      console.error("Error loading so_shipment_lines for deduct shipments", soLinesError);
    }

    const orderedCasesByShipment = new Map<string, number>();
    for (const row of soLines || []) {
      const sid = (row as any).so_shipment_id as string;
      const qtyUnits = Number((row as any).quantity_shipped_units) || 0;
      if (!sid || qtyUnits <= 0) continue;
      const orderedCases = unitsPerCase > 0 ? qtyUnits / unitsPerCase : qtyUnits;
      orderedCasesByShipment.set(sid, (orderedCasesByShipment.get(sid) || 0) + orderedCases);
    }

    // 2) picked_cases from inventory_movements for this shipment+product with reason=order
    const orderNumbers = Array.from(new Set(shipments.map((s) => s.order_number).filter(Boolean)));
    const shipmentIdsForMoves = shipments.map((s) => s.id);

    const { data: moves, error: movesError } = await supabase
      .from("inventory_movements")
      .select("order_number, product_id, quantity_cases, movement_type, reason, shipment_id")
      .eq("product_id", product.id as string)
      .in("order_number", orderNumbers)
      .eq("movement_type", "deduct")
      .eq("reason", "order")
      .in("shipment_id", [null, ...shipmentIdsForMoves]);

    if (movesError) {
      console.error("Error loading inventory_movements for deduct shipments", movesError);
    }

    const pickedCasesByShipment = new Map<string, number>();
    const pickedCasesByOrderLegacy = new Map<string, number>();

    for (const m of moves || []) {
      const ord = (m as any).order_number as string;
      const qtyCases = Number((m as any).quantity_cases) || 0;
      const sid = (m as any).shipment_id as string | null;
      if (!ord || qtyCases <= 0) continue;

      if (sid) {
        pickedCasesByShipment.set(sid, (pickedCasesByShipment.get(sid) || 0) + qtyCases);
      } else {
        pickedCasesByOrderLegacy.set(ord, (pickedCasesByOrderLegacy.get(ord) || 0) + qtyCases);
      }
    }

    // 3) final cases_remaining = ordered_cases - picked_cases
    // picked_cases = SUM(shipment_id = X) + SUM(shipment_id IS NULL AND order_number = so_order_number)
    for (const s of shipments) {
      const orderedCases = orderedCasesByShipment.get(s.id) || 0;
      const pickedByShipment = pickedCasesByShipment.get(s.id) || 0;
      const pickedLegacy = pickedCasesByOrderLegacy.get(s.order_number) || 0;
      const pickedCases = pickedByShipment + pickedLegacy;
      const remainingCases = Math.max(orderedCases - pickedCases, 0);

      s.qty_ordered_units = unitsPerCase > 0 ? orderedCases * unitsPerCase : orderedCases;
      s.qty_remaining_units = unitsPerCase > 0 ? remainingCases * unitsPerCase : remainingCases;
      s.qty_ordered_cases = orderedCases;
      s.qty_remaining_cases = remainingCases;

      console.log("[deduct] cases_remaining_to_pick", {
        shipment_id: s.id,
        product_id: product.id as string,
        ordered_cases: orderedCases,
        picked_cases: pickedCases,
        cases_remaining: remainingCases,
      });
    }
  }

  return {
    ok: true,
    productName: (product.product_name as string) || sku,
    productId: product.id as string,
    shipments,
    rows: normalized,
  };
}
