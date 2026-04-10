import { serverSupabase } from "@/lib/serverSupabase";

export interface SkuDemand {
  sku_id: string; // product_id
  total_demand: number; // aggregated quantity (units) across open / not-fulfilled lines
}

/**
 * Aggregate demand per SKU (product) for Container Planning v2.
 *
 * Source: sales_orders + sales_order_lines
 *
 * Rules:
 * - Group by product_id (sku_id)
 * - Sum quantity_units from sales_order_lines
 * - Only include sales orders with status in ('open', 'confirmed')
 *
 * Returns pure data only: [{ sku_id, total_demand }] where total_demand is in UNITS.
 */
export async function getDemandPerSku(): Promise<SkuDemand[]> {
  const supabase = serverSupabase;

  // Load demand directly from sales orders / lines in units
  const { data, error } = await supabase
    .from("sales_order_lines")
    .select(
      `product_id,
       quantity_units,
       sales_orders!inner(status)`
    );

  if (error) {
    console.error("Error loading sales_order_lines for demand aggregation", error);
    return [];
  }

  const rows = (data || []) as any[];

  const VALID_STATUSES = new Set(["open", "confirmed"]);

  const demandMap = new Map<string, number>();

  for (const row of rows) {
    const so = (row as any).sales_orders as any;
    const status = (so?.status as string) || "";
    if (!VALID_STATUSES.has(status)) continue;

    const productId = (row.product_id as string) || "";
    if (!productId) continue;

    const qty = Number((row as any).quantity_units) || 0;
    if (!Number.isFinite(qty) || qty <= 0) continue;

    demandMap.set(productId, (demandMap.get(productId) || 0) + qty);
  }

  const result: SkuDemand[] = [];
  for (const [productId, total] of demandMap.entries()) {
    result.push({ sku_id: productId, total_demand: total });
  }

  return result;
}
