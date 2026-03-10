import { serverSupabase } from "@/lib/serverSupabase";

export interface SalesDemandOptions {
  /** Inclusive start of requested ship date window (YYYY-MM-DD). Optional. */
  startDate?: string;
  /** Inclusive end of requested ship date window (YYYY-MM-DD). Optional. */
  endDate?: string;
}

export interface ProductDemand {
  product_id: string;
  demand_units: number;
}

/**
 * Compute open-sales demand per product in units over an optional requested_ship_date window.
 *
 * This is intentionally minimal for phase 1 container planning:
 * - Only considers sales_orders.status = 'open'.
 * - Does NOT subtract stock, holds, or already-shipped quantities yet.
 * - Demand is summed in units; callers can convert to cases using product_dimensions.units_per.
 */
export async function getOpenSalesDemandByProduct(opts: SalesDemandOptions = {}): Promise<ProductDemand[]> {
  const { startDate, endDate } = opts;

  // 1) Find open sales orders in the requested date window (if provided)
  let soQuery = serverSupabase.from("sales_orders").select("id, requested_ship_date").eq("status", "open");

  if (startDate) {
    soQuery = soQuery.gte("requested_ship_date", startDate);
  }
  if (endDate) {
    soQuery = soQuery.lte("requested_ship_date", endDate);
  }

  const { data: orders, error: soError } = await soQuery;

  if (soError) {
    console.error("Error loading open sales orders for demand", soError);
    return [];
  }

  const soIds = (orders || []).map((o) => o.id as string);
  if (soIds.length === 0) return [];

  // 2) Load lines for those orders and aggregate in memory
  const { data: lines, error: linesError } = await serverSupabase
    .from("sales_order_lines")
    .select("product_id, quantity_units")
    .in("sales_order_id", soIds);

  if (linesError) {
    console.error("Error loading sales order lines for demand", linesError);
    return [];
  }

  const demandMap = new Map<string, number>();

  for (const line of lines || []) {
    const pid = line.product_id as string;
    const qty = Number(line.quantity_units) || 0;
    if (qty <= 0 || !pid) continue;
    demandMap.set(pid, (demandMap.get(pid) || 0) + qty);
  }

  const result: ProductDemand[] = [];
  for (const [product_id, demand_units] of demandMap.entries()) {
    result.push({ product_id, demand_units });
  }

  // Sort by product_id for stability
  result.sort((a, b) => a.product_id.localeCompare(b.product_id));

  return result;
}
