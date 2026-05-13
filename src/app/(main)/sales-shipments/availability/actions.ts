"use server";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export interface AvailabilityState {
  ok: boolean | null;
  error?: string;
  productName?: string;
  productId?: string;
  sku?: string;
  skuVar?: string | null;
  imageUrl?: string | null;
  quantityInStock?: number;
  quantityInSOs?: number;
  incomingUnits?: number;
  balance?: number;
  availableInclIncoming?: number;
  orders?: {
    so_number: string;
    customer_name: string | null;
    quantity: number;
    status: string | null;
    ship_date: string | null;
  }[];
}

export async function loadAvailability(
  _prev: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { ok: false, error: "Not authorized" };
  }

  const skuRaw = (formData.get("sku") || "").toString().trim();
  const skuVarRaw = (formData.get("sku_var") || "").toString().trim();

  if (!skuRaw) {
    return { ok: false, error: "Please enter a SKU" };
  }

  const supabase = serverSupabase;

  // 1) Resolve product using SKU + optional variant.
  // If variant is provided: exact match on (sku, sku_var).
  // If variant is blank: match base product where sku matches and sku_var is NULL or empty.
  let productQuery = supabase.from("products").select("id, sku, sku_var, product_name, image").eq("sku", skuRaw);

  if (skuVarRaw) {
    productQuery = productQuery.eq("sku_var", skuVarRaw);
  } else {
    // Prefer the base product (no variant) when variant is blank.
    // This avoids accidentally matching "2pack", "4pack", etc.
    productQuery = productQuery.or("sku_var.is.null,sku_var.eq.");
  }

  const { data: product, error: prodError } = await productQuery.maybeSingle();

  if (prodError || !product) {
    console.error("Error resolving product for availability", prodError, { skuRaw, skuVarRaw });
    return {
      ok: false,
      error: `Product not found for that SKU / variant (received SKU='${skuRaw}' variant='${skuVarRaw || ""}')`,
    };
  }

  const productId = product.id as string;

  // 2) Quantity in stock - use inventory_location * units_per (same source as warehouse inventory module)
  const { data: locRows, error: locError } = await supabase
    .from("inventory_location")
    .select("product_id, quantity_cases")
    .eq("product_id", productId);

  if (locError) {
    console.error("Error loading inventory_location for availability", locError);
  }

  // Load units_per for this product
  const { data: dimsRows, error: dimsError } = await supabase
    .from("product_dimensions")
    .select("product_id, kind, units_per")
    .eq("product_id", productId)
    .eq("kind", "package");

  if (dimsError) {
    console.error("Error loading product_dimensions for availability", dimsError);
  }

  let unitsPer = 0;
  for (const d of dimsRows || []) {
    const u = Number((d as any).units_per) || 0;
    if (u > 0 && unitsPer === 0) unitsPer = u;
  }

  let quantityInStock = 0;
  for (const row of locRows || []) {
    const cases = Number((row as any).quantity_cases) || 0;
    if (cases <= 0 || unitsPer <= 0) continue;
    quantityInStock += cases * unitsPer;
  }

  // 3) Incoming from containers_v2/container_items_v2 (no partials, no movements)
  let incomingUnits = 0;

  const { data: inboundItems, error: inboundItemsError } = await supabase
    .from("container_items_v2")
    .select("container_id, sku_id, quantity, units_per")
    .eq("sku_id", productId);

  if (inboundItemsError) {
    console.error("Error loading container_items_v2 for availability incoming", inboundItemsError);
  }

  const containerIds = Array.from(
    new Set((inboundItems || []).map((it: any) => (it.container_id as string) || "").filter(Boolean)),
  );

  let activeContainerIdSet = new Set<string>();

  if (containerIds.length > 0) {
    const { data: containers, error: containersError } = await supabase
      .from("containers_v2")
      .select("id, status")
      .in("id", containerIds)
      .not("status", "in", "(Canceled,Unloaded)");

    if (containersError) {
      console.error("Error loading containers_v2 for availability incoming", containersError);
    } else {
      for (const c of containers || []) {
        const status = ((c as any).status || "").toString();
        if (status !== "Canceled" && status !== "Unloaded") {
          activeContainerIdSet.add((c as any).id as string);
        }
      }
    }
  }

  for (const row of inboundItems || []) {
    const r = row as any;
    const cid = (r.container_id as string) || "";
    if (!cid || !activeContainerIdSet.has(cid)) continue;
    const qty = Number(r.quantity) || 0;
    const u = Number(r.units_per) || 0;
    if (qty <= 0 || u <= 0) continue;
    incomingUnits += qty * u;
  }

  // 4) Quantity in SOs and list of orders (committed)
  // Step 1: load all sales_order_lines for this product
  const { data: soLinesRaw, error: soLinesError } = await supabase
    .from("sales_order_lines")
    .select("id, sales_order_id, quantity_units")
    .eq("product_id", productId);

  if (soLinesError) {
    console.error("Error loading sales_order_lines for availability", soLinesError);
  }

  let quantityInSOs = 0;
  const orders: AvailabilityState["orders"] = [];

  console.log("AVAILABILITY_DEBUG_LINES", { productId, soLinesRaw });

  const soIds = Array.from(
    new Set((soLinesRaw || []).map((r: any) => (r.sales_order_id as string) || "").filter(Boolean)),
  );

  if (soIds.length > 0) {
    // Step 2: load orders + customers for those ids
    const { data: soRows, error: soError } = await supabase
      .from("sales_orders")
      .select("id, order_number, customer_name, status, created_at")
      .in("id", soIds)
      .in("status", ["open", "processing"]);

    if (soError) {
      console.error("Error loading sales_orders for availability", soError);
    }

    console.log("AVAILABILITY_DEBUG_ORDERS", { soIds, soRows });

    const soMap = new Map<string, any>();
    for (const so of soRows || []) {
      soMap.set(so.id as string, so);
    }

    const customerMap = new Map<string, string | null>();
    for (const so of soRows || []) {
      customerMap.set(so.id as string, ((so as any).customer_name as string) || null);
    }

    // Aggregate quantity per sales order (one row per SO in the UI)
    const qtyBySo = new Map<string, number>();

    for (const line of soLinesRaw || []) {
      const soId = (line as any).sales_order_id as string;
      const so = soMap.get(soId);
      if (!so) continue; // filtered out by status

      const qty = Number((line as any).quantity_units) || 0;
      if (qty <= 0) continue;

      qtyBySo.set(soId, (qtyBySo.get(soId) || 0) + qty);
    }

    for (const [soId, qty] of qtyBySo.entries()) {
      const so = soMap.get(soId);
      if (!so) continue;

      quantityInSOs += qty;

      orders.push({
        so_number: (so.order_number as string) || "",
        customer_name: customerMap.get(soId) ?? null,
        quantity: qty,
        status: (so.status as string) || null,
        ship_date: (so.created_at as string) || null,
      });
    }
  }

  // Sort orders by (pseudo) ship_date ASC (using created_at)
  orders.sort((a, b) => {
    const aTime = a.ship_date ? new Date(a.ship_date).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.ship_date ? new Date(b.ship_date).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  const balance = quantityInStock - quantityInSOs; // Available now
  const availableInclIncoming = quantityInStock + incomingUnits - quantityInSOs;

  return {
    ok: true,
    productName: (product.product_name as string) || "",
    productId,
    sku: (product.sku as string) || skuRaw,
    skuVar: (product.sku_var as string) || null,
    imageUrl: (product.image as string) || null,
    quantityInStock,
    quantityInSOs,
    incomingUnits,
    balance,
    availableInclIncoming,
    orders,
  };
}
