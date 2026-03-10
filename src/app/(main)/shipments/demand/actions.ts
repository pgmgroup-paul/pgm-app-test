"use server";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export interface DemandState {
  ok: boolean | null;
  error?: string;
  productName?: string;
  productId?: string;
  sku?: string;
  skuVar?: string | null;
  imageUrl?: string | null;
  quantityInStock?: number;
  quantityInSOs?: number;
  balance?: number;
  orders?: {
    so_number: string;
    customer_name: string | null;
    quantity: number;
    status: string | null;
    ship_date: string | null;
  }[];
}

export async function loadDemand(_prev: DemandState, formData: FormData): Promise<DemandState> {
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

  // 1) Resolve product in the simplest, strictest way first: exact SKU match.
  let productQuery = supabase.from("products").select("id, sku, sku_var, product_name, image").eq("sku", skuRaw);

  if (skuVarRaw) {
    productQuery = productQuery.eq("sku_var", skuVarRaw);
  }

  const { data: product, error: prodError } = await productQuery.maybeSingle();

  if (prodError || !product) {
    console.error("Error resolving product for demand", prodError, { skuRaw, skuVarRaw });
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
    console.error("Error loading inventory_location for demand", locError);
  }

  // Load units_per for this product
  const { data: dimsRows, error: dimsError } = await supabase
    .from("product_dimensions")
    .select("product_id, units_per")
    .eq("product_id", productId);

  if (dimsError) {
    console.error("Error loading product_dimensions for demand", dimsError);
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

  // 3) Quantity in SOs and list of orders
  // Step 1: load all sales_order_lines for this product
  const { data: soLinesRaw, error: soLinesError } = await supabase
    .from("sales_order_lines")
    .select("id, sales_order_id, quantity_units")
    .eq("product_id", productId);

  if (soLinesError) {
    console.error("Error loading sales_order_lines for demand", soLinesError);
  }

  let quantityInSOs = 0;
  const orders: DemandState["orders"] = [];

  console.log("DEMAND_DEBUG_LINES", { productId, soLinesRaw });

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
      console.error("Error loading sales_orders for demand", soError);
    }

    console.log("DEMAND_DEBUG_ORDERS", { soIds, soRows });

    const soMap = new Map<string, any>();
    for (const so of soRows || []) {
      soMap.set(so.id as string, so);
    }

    // Optional: load customers in a second step
    const customerMap = new Map<string, string | null>();
    for (const so of soRows || []) {
      customerMap.set(so.id as string, ((so as any).customer_name as string) || null);
    }

    for (const line of soLinesRaw || []) {
      const soId = (line as any).sales_order_id as string;
      const so = soMap.get(soId);
      if (!so) continue; // filtered out by status

      const qty = Number((line as any).quantity_units) || 0;
      if (qty <= 0) continue;

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

  const balance = quantityInStock - quantityInSOs;

  return {
    ok: true,
    productName: (product.product_name as string) || "",
    productId,
    sku: (product.sku as string) || skuRaw,
    skuVar: (product.sku_var as string) || null,
    imageUrl: (product.image as string) || null,
    quantityInStock,
    quantityInSOs,
    balance,
    orders,
  };
}
