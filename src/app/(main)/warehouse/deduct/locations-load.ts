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
  const { data: shipmentsRaw, error: shipmentsError } = await supabase
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

  // Load quantity ordered per sales order for this product
  if (shipments.length > 0) {
    const soIds = Array.from(new Set(shipments.map((s) => s.sales_order_id)));

    const { data: soLines, error: soLinesError } = await supabase
      .from("sales_order_lines")
      .select("sales_order_id, quantity_units")
      .eq("product_id", product.id as string)
      .in("sales_order_id", soIds);

    if (soLinesError) {
      console.error("Error loading sales_order_lines for deduct shipments", soLinesError);
    }

    const qtyBySo = new Map<string, number>();
    for (const row of soLines || []) {
      const soId = (row as any).sales_order_id as string;
      const qty = Number((row as any).quantity_units) || 0;
      if (!soId || qty <= 0) continue;
      qtyBySo.set(soId, (qtyBySo.get(soId) || 0) + qty);
    }

    for (const s of shipments) {
      s.qty_ordered_units = qtyBySo.get(s.sales_order_id) || 0;
    }

    // Load deducted quantities per order via inventory_movements.order_number
    const orderNumbers = Array.from(new Set(shipments.map((s) => s.order_number).filter(Boolean)));

    if (orderNumbers.length > 0) {
      const { data: moves, error: movesError } = await supabase
        .from("inventory_movements")
        .select("order_number, product_id, quantity_units, movement_type")
        .eq("product_id", product.id as string)
        .in("order_number", orderNumbers)
        .eq("movement_type", "deduct");

      if (movesError) {
        console.error("Error loading inventory_movements for deduct shipments", movesError);
      }

      const deductedByOrder = new Map<string, number>();
      for (const m of moves || []) {
        const ord = (m as any).order_number as string;
        const qty = Number((m as any).quantity_units) || 0;
        if (!ord || qty <= 0) continue;
        deductedByOrder.set(ord, (deductedByOrder.get(ord) || 0) + qty);
      }

      for (const s of shipments) {
        const ordered = s.qty_ordered_units || 0;
        const deducted = deductedByOrder.get(s.order_number) || 0;
        const remaining = ordered - deducted;
        s.qty_remaining_units = remaining > 0 ? remaining : 0;
      }
    }

    // Convert units to cases for display
    if (unitsPerCase > 0) {
      for (const s of shipments) {
        s.qty_ordered_cases = s.qty_ordered_units / unitsPerCase;
        s.qty_remaining_cases = s.qty_remaining_units / unitsPerCase;
      }
    } else {
      // Fallback: if we don't know units_per_case, treat units as cases
      for (const s of shipments) {
        s.qty_ordered_cases = s.qty_ordered_units;
        s.qty_remaining_cases = s.qty_remaining_units;
      }
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
