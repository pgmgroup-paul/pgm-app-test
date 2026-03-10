"use server";

import { serverSupabase } from "@/lib/serverSupabase";

export interface MovementRow {
  id: string;
  created_at: string;
  movement_type: string;
  quantity_cases: number;
  from_location_code: string | null;
  to_location_code: string | null;
  warehouse_from: string | null;
  warehouse_to: string | null;
  reason: string | null;
  source_type: string | null;
  source_ref: string | null;
  order_number: string | null;
}

export interface MovementsState {
  ok: boolean | null;
  error?: string;
  productName?: string;
  sku?: string;
  skuVar?: string;
  rows?: MovementRow[];
}

export async function loadMovementsBySku(_prev: MovementsState, formData: FormData): Promise<MovementsState> {
  const sku = (formData.get("sku") || "").toString().trim();
  const skuVar = (formData.get("sku_var") || "").toString().trim();

  if (!sku) {
    return { ok: false, error: "SKU is required" };
  }

  const supabase = serverSupabase;

  // Resolve product by sku / sku_var (same logic as Deduct/Search), case-insensitive
  let productQuery = supabase.from("products").select("id, sku, sku_var, product_name").ilike("sku", sku);

  if (skuVar) {
    productQuery = productQuery.ilike("sku_var", skuVar);
  } else {
    productQuery = productQuery.is("sku_var", null);
  }

  const { data: product, error: prodError } = await productQuery.maybeSingle();

  if (prodError || !product) {
    console.error("Error looking up product for movements", prodError);
    return { ok: false, error: "Product not found for that SKU / variant (case-insensitive lookup)" };
  }

  // Load recent movements for this product
  const { data: moves, error: movErr } = await supabase
    .from("inventory_movements")
    .select(
      `id,
       created_at,
       movement_type,
       quantity_cases,
       reason,
       source_type,
       source_ref,
       order_number,
       from_location:from_location_id ( code, warehouses ( name ) ),
       to_location:to_location_id ( code, warehouses ( name ) )`,
    )
    .eq("product_id", product.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (movErr) {
    console.error("Error loading movements for product", movErr);
    return { ok: false, error: "Error loading movements for this product" };
  }

  const rows: MovementRow[] = (moves || []).map((m: any) => ({
    id: m.id as string,
    created_at: m.created_at as string,
    movement_type: m.movement_type as string,
    quantity_cases: Number(m.quantity_cases) || 0,
    from_location_code: (m.from_location?.code as string) || null,
    to_location_code: (m.to_location?.code as string) || null,
    warehouse_from: (m.from_location?.warehouses?.name as string) || null,
    warehouse_to: (m.to_location?.warehouses?.name as string) || null,
    reason: (m.reason as string) || null,
    source_type: (m.source_type as string) || null,
    source_ref: (m.source_ref as string) || null,
    order_number: (m.order_number as string) || null,
  }));

  return {
    ok: true,
    productName: (product.product_name as string) || sku,
    sku,
    skuVar,
    rows,
  };
}
