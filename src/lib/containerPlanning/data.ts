import { serverSupabase } from "@/lib/serverSupabase";

interface PurchaseOrderLineWithCarton {
  purchase_order_line_id: string;
  sku_id: string; // product_id
  quantity: number; // from purchase_order_lines.quantity_cases (treated as quantity here)
  ship_date: string | null;
  length: number | null; // carton length (same unit as stored in product_dimensions)
  width: number | null;
  height: number | null;
  weight: number | null;
  units_per: number | null; // units per carton from product_dimensions
  cartons_floor: number | null;
  cartons_ceil: number | null;
  is_exact: boolean;
}

/**
 * Load purchase order lines and carton-level product dimensions for container planning.
 *
 * - Reads only from existing tables; does not mutate anything.
 * - Does NOT filter out invalid or incomplete rows; callers are responsible for filtering.
 *
 * `poIds` (optional): restrict to these purchase order ids. If omitted, loads all lines.
 */
export async function getPurchaseOrderLines(poIds?: string[]): Promise<PurchaseOrderLineWithCarton[]> {
  const supabase = serverSupabase;

  // 1) Load PO lines (optionally filtered by purchase_order_id) with their parent PO ship_date
  let lineQuery = supabase
    .from("purchase_order_lines")
    .select(
      `id,
       product_id,
       quantity_cases,
       purchase_order_id,
       purchase_orders!inner(ship_date)`
    );

  if (poIds && poIds.length > 0) {
    lineQuery = lineQuery.in("purchase_order_id", poIds);
  }

  const { data: lineRows, error: lineError } = await lineQuery;

  if (lineError) {
    console.error("Error loading purchase_order_lines for container planning", lineError);
    return [];
  }

  const lines = (lineRows || []) as any[];

  if (lines.length === 0) {
    return [];
  }

  // 2) Load carton dimensions for the involved products
  const productIds = Array.from(
    new Set(
      lines
        .map((l) => (l.product_id as string) || "")
        .filter((id): id is string => Boolean(id))
    )
  );

  const { data: dimRows, error: dimError } = await supabase
    .from("product_dimensions")
    .select("product_id, kind, length, width, height, weight, units_per")
    .in("kind", ["carton", "package"])
    .in("product_id", productIds);

  if (dimError) {
    console.error("Error loading product_dimensions for container planning", dimError);
  }

  const dimMap = new Map<
    string,
    { length: number | null; width: number | null; height: number | null; weight: number | null; units_per: number | null }
  >();

  for (const d of dimRows || []) {
    const row = d as any;
    const pid = (row.product_id as string) || "";
    if (!pid) continue;

    const kind = (row.kind as string) || "";
    const existing = dimMap.get(pid) || {
      length: null as number | null,
      width: null as number | null,
      height: null as number | null,
      weight: null as number | null,
      units_per: null as number | null,
    };

    if (kind === "carton") {
      existing.length = row.length != null ? Number(row.length) : existing.length;
      existing.width = row.width != null ? Number(row.width) : existing.width;
      existing.height = row.height != null ? Number(row.height) : existing.height;
      existing.weight = row.weight != null ? Number(row.weight) : existing.weight;
    }

    if (kind === "package") {
      existing.units_per = row.units_per != null ? Number(row.units_per) : existing.units_per;
    }

    dimMap.set(pid, existing);
  }

  // 3) Merge lines with dimensions and compute carton readiness + carton count
  const results: PurchaseOrderLineWithCarton[] = [];

  for (const l of lines) {
    const poLineId = (l.id as string) || "";
    const productId = (l.product_id as string) || "";
    const qtyRaw = l.quantity_cases;
    const quantity = qtyRaw != null ? Number(qtyRaw) || 0 : 0;

    const po = (l.purchase_orders as any) || null;
    const shipDate = (po?.ship_date as string) || null;

    const dims = dimMap.get(productId) || {
      length: null,
      width: null,
      height: null,
      weight: null,
      units_per: null,
    };

    const unitsPer = dims.units_per != null ? Number(dims.units_per) : null;

    let cartons_floor: number | null = null;
    let cartons_ceil: number | null = null;
    let is_exact = false;

    if (unitsPer != null && unitsPer > 0 && Number.isFinite(quantity) && Number.isFinite(unitsPer)) {
      cartons_floor = Math.floor(quantity / unitsPer);
      cartons_ceil = Math.ceil(quantity / unitsPer);
      is_exact = quantity % unitsPer === 0;
    }

    results.push({
      purchase_order_line_id: poLineId,
      sku_id: productId,
      quantity,
      ship_date: shipDate,
      length: dims.length,
      width: dims.width,
      height: dims.height,
      weight: dims.weight,
      units_per: unitsPer,
      cartons_floor,
      cartons_ceil,
      is_exact,
    });
  }

  return results;
}
