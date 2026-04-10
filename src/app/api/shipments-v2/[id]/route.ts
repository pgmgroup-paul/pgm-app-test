import { serverSupabase } from "@/lib/serverSupabase";

export async function GET(req: Request) {
  const supabase = serverSupabase;
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/");
  const shipmentId = pathParts[pathParts.length - 1];
  console.log("Shipment ID:", shipmentId);

  // 1. Load shipment
  const { data: shipment, error: shipmentError } = await supabase
    .from("shipments_v2")
    .select("*")
    .eq("id", shipmentId)
    .single();

  if (shipmentError) {
    console.error("Error loading shipment", shipmentError);
    return new Response(JSON.stringify({ error: shipmentError.message }), {
      status: 500,
    });
  }

  // 2. Load container links
  const { data: links } = await supabase
    .from("shipment_containers_v2")
    .select("container_id")
    .eq("shipment_id", shipmentId);

  const containerIds = (links || []).map((l) => l.container_id as string);

  if (containerIds.length === 0) {
    return Response.json({
      shipment,
      containers: [],
    });
  }

  // 3. Load containers
  const { data: containers, error: containersError } = await supabase
    .from("containers_v2")
    .select("id, temp_code, container_number, status")
    .in("id", containerIds);

  if (containersError) {
    console.error("Error loading containers for shipment", containersError);
    return new Response(JSON.stringify({ error: containersError.message }), {
      status: 500,
    });
  }

  // 4. Load container items (safe .in)
  let items: any[] = [];
  if (containerIds.length > 0) {
    const res = await supabase
      .from("container_items_v2")
      .select("container_id, sku_id, purchase_order_line_id, quantity, units_per")
      .in("container_id", containerIds);
    if (res.error) {
      console.error("Error loading container_items_v2:", res.error);
    }
    items = res.data || [];
  }

  // 5. Load products (safe .in)
  const skuIds = Array.from(new Set(items.map((i) => i.sku_id))).filter(Boolean) as string[];
  let productMap = new Map<string, any>();
  let products: any[] = [];
  if (skuIds.length > 0) {
    const res = await supabase
      .from("products")
      .select("id, sku, sku_var, product_name")
      .in("id", skuIds);
    if (res.error) {
      console.error("Error loading products:", res.error);
    }
    products = res.data || [];
  }
  for (const p of products || []) {
    productMap.set(p.id as string, p);
  }

  // 6. Load PO data (for ship date + PO number)
  const poLineIds = Array.from(new Set(items.map((i) => i.purchase_order_line_id))).filter(Boolean) as string[];

  let poLineToOrder = new Map<string, string | null>();
  let orderMap = new Map<string, any>();

  let poLines: any[] = [];
  if (poLineIds.length > 0) {
    const res = await supabase
      .from("purchase_order_lines")
      .select("id, purchase_order_id")
      .in("id", poLineIds);
    if (res.error) {
      console.error("Error loading purchase_order_lines:", res.error);
    }
    poLines = res.data || [];
  }

  const poIds = Array.from(new Set(poLines.map((p) => p.purchase_order_id))).filter(Boolean) as string[];

  let purchaseOrders: any[] = [];
  if (poIds.length > 0) {
    const res = await supabase
      .from("purchase_orders")
      .select("id, po_number, ship_date")
      .in("id", poIds);
    if (res.error) {
      console.error("Error loading purchase_orders:", res.error);
    }
    purchaseOrders = res.data || [];
  }

  for (const p of poLines || []) {
    poLineToOrder.set(p.id as string, (p.purchase_order_id as string | null) ?? null);
  }

  for (const o of purchaseOrders || []) {
    orderMap.set(o.id as string, o);
  }

  // 7. Group items by container
  const itemsByContainer = new Map<string, any[]>();
  for (const i of items || []) {
    const cid = i.container_id as string | undefined;
    if (!cid) continue;
    if (!itemsByContainer.has(cid)) {
      itemsByContainer.set(cid, []);
    }
    itemsByContainer.get(cid)!.push(i);
  }

  // 8. Helper to extract keywords from product name
  function extractKeywords(name?: string | null): string {
    if (!name) return "";
    let cleaned = name.toLowerCase();
    cleaned = cleaned.replace(/\b\d+\s*(pk|pc|pcs|set)?\b/g, "");
    const noise = [
      "large",
      "small",
      "medium",
      "multi",
      "function",
      "capacity",
      "set",
      "piece",
      "pack",
      "with",
      "and",
      "for",
      "the",
    ];
    const words = cleaned
      .split(/[\s,()-]+/)
      .filter((w) => w && !noise.includes(w));
    return words
      .slice(-2)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // 9. Build enriched containers
  const enrichedContainers = (containers || []).map((c) => {
    const cItems = itemsByContainer.get(c.id) || [];
    const preview: string[] = [];
    let earliest: string | null = null;
    const items_detail: any[] = [];

    for (const item of cItems) {
      const product = productMap.get(item.sku_id as string);
      const poId = poLineToOrder.get(item.purchase_order_line_id as string);
      const order = poId ? orderMap.get(poId) : null;

      // contents preview
      if (preview.length < 4 && product?.product_name) {
        const kw = extractKeywords(product.product_name as string);
        if (kw) preview.push(kw);
      }

      // ship date
      const shipDate = order?.ship_date as string | null | undefined;
      if (shipDate && (!earliest || new Date(shipDate) < new Date(earliest))) {
        earliest = shipDate;
      }

      // items detail
      const qty = item.quantity != null ? Number(item.quantity) || 0 : 0;
      const unitsPer = item.units_per != null ? Number(item.units_per) || 0 : 0;

      items_detail.push({
        sku: (product?.sku as string) || "",
        sku_var: (product?.sku_var as string) || "",
        product_name: (product?.product_name as string) || "",
        po_number: (order?.po_number as string) || "",
        pieces: qty * (unitsPer || 1),
      });
    }

    return {
      ...c,
      contents_preview: preview.join(", "),
      ship_date: earliest,
      items_detail,
    };
  });

  return Response.json({
    shipment,
    containers: enrichedContainers,
  });
}
