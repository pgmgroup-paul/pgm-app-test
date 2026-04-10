import { serverSupabase } from "@/lib/serverSupabase";

export interface SkuStock {
  sku_id: string; // product_id
  total_stock: number; // aggregated raw quantity from inventory_location
}

/**
 * Aggregate stock per SKU (product) for Container Planning v2.
 *
 * Source: inventory_location
 *
 * Rules:
 * - Group by product_id (sku_id)
 * - Sum the stored quantity field (currently quantity_cases)
 *
 * NOTE: This returns the raw stored quantity from inventory_location.
 * It does NOT convert cases → units; callers must decide whether the
 * value represents cases or units and convert if needed.
 */
export async function getStockPerSku(): Promise<SkuStock[]> {
  const supabase = serverSupabase;

  // Load all inventory_location rows (product_id + quantity)
  const { data, error } = await supabase
    .from("inventory_location")
    .select("product_id, quantity_cases");

  if (error) {
    console.error("Error loading inventory_location for stock aggregation", error);
    return [];
  }

  const rows = (data || []) as any[];

  const stockMap = new Map<string, number>();

  for (const row of rows) {
    const productId = (row.product_id as string) || "";
    if (!productId) continue;

    const qty = row.quantity_cases != null ? Number(row.quantity_cases) || 0 : 0;
    if (!Number.isFinite(qty) || qty === 0) continue;

    stockMap.set(productId, (stockMap.get(productId) || 0) + qty);
  }

  const result: SkuStock[] = [];
  for (const [productId, total] of stockMap.entries()) {
    result.push({ sku_id: productId, total_stock: total });
  }

  return result;
}
