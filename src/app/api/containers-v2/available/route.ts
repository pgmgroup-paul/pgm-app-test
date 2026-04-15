import { NextResponse } from "next/server";

import { serverSupabase } from "@/lib/serverSupabase";

function extractKeywords(name: string | null): string {
  if (!name) return "";

  let cleaned = name.toLowerCase();

  // Remove numbers + simple pack indicators like "3pk", "2 pc", "4 pcs", "5 set"
  cleaned = cleaned.replace(/\b\d+\s*(pk|pc|pcs|set)?\b/g, "");

  const noiseWords = [
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
    .filter((w) => w && !noiseWords.includes(w));

  if (words.length === 0) return "";

  const lastWords = words.slice(-2);

  return lastWords
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function GET() {
  try {
    const supabase = serverSupabase;

    const { data: containers, error } = await supabase
      .from("containers_v2")
      .select("id, temp_code, status, created_at")
      .is("shipment_id", null)
      .neq("status", "Canceled")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading available containers_v2", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const ids = (containers || []).map((c) => c.id as string);
    if (!ids.length) {
      return NextResponse.json({ containers: [] });
    }

    // Load container items and related products for contents preview
    const { data: items } = await supabase
      .from("container_items_v2")
      .select("container_id, sku_id, purchase_order_line_id, quantity, units_per");

    console.log("Sample container items:", (items || []).slice(0, 5));

    const relevantItems = (items || []).filter((it) => ids.includes(it.container_id as string));

    const poLineIds = Array.from(
      new Set(relevantItems.map((it) => it.purchase_order_line_id as string | undefined).filter(Boolean)),
    ) as string[];

    console.log("PO Line IDs:", poLineIds.slice(0, 5));

    let poLineToOrderMap = new Map<string, string | null>();
    let orderToShipDateMap = new Map<string, string | null>();
    let orderToPoNumberMap = new Map<string, string | null>();

    if (poLineIds.length > 0) {
      const { data: poLines } = await supabase
        .from("purchase_order_lines")
        .select("id, purchase_order_id")
        .in("id", poLineIds);

      console.log("PO Lines fetched:", (poLines || []).slice(0, 5));

      const poIds = Array.from(
        new Set((poLines || []).map((p) => p.purchase_order_id as string | undefined).filter(Boolean)),
      ) as string[];

      if (poIds.length > 0) {
        const { data: purchaseOrders } = await supabase
          .from("purchase_orders")
          .select("id, ship_date, po_number")
          .in("id", poIds);

        for (const p of poLines || []) {
          poLineToOrderMap.set(p.id as string, (p.purchase_order_id as string | null) ?? null);
        }

        for (const o of purchaseOrders || []) {
          orderToShipDateMap.set(o.id as string, (o.ship_date as string | null) ?? null);
          orderToPoNumberMap.set(o.id as string, (o.po_number as string | null) ?? null);
        }
      }
    }

    const productIdSet = new Set<string>();
    for (const it of relevantItems) {
      if (it.sku_id) productIdSet.add(it.sku_id as string);
    }

    let productMap = new Map<string, { product_name: string | null; sku: string | null; sku_var: string | null }>();
    if (productIdSet.size > 0) {
      const { data: products, error: prodError } = await supabase
        .from("products")
        .select("id, sku, sku_var, product_name")
        .in("id", Array.from(productIdSet));

      if (prodError) {
        console.error("Error loading products for containers_v2 available", prodError);
      } else {
        for (const p of products || []) {
          productMap.set(p.id as string, {
            product_name: (p.product_name as string) || null,
            sku: (p.sku as string) || null,
            sku_var: (p.sku_var as string) || null,
          });
        }
      }
    }

    const contentsByContainer = new Map<string, string>();
    const shipDateByContainer = new Map<string, string | null>();
    const itemsDetailByContainer = new Map<string, any[]>();

    for (const c of containers || []) {
      const cId = c.id as string;
      const cItems = relevantItems.filter((it) => it.container_id === cId);
      const preview: string[] = [];
      let earliestDate: string | null = null;

      console.log("Container", cId, "items:", cItems.slice(0, 5));

      for (const it of cItems.slice(0, 4)) {
        const p = productMap.get(it.sku_id as string);
        if (p) {
          const keywords = extractKeywords(p.product_name);
          if (keywords) {
            preview.push(keywords);
          }
        }
      }

      const items_detail = cItems.map((it) => {
        const p = productMap.get(it.sku_id as string);
        const poId = poLineToOrderMap.get(it.purchase_order_line_id as string);
        const poNumber = poId ? orderToPoNumberMap.get(poId) : null;
        const qty = it.quantity != null ? Number(it.quantity) || 0 : 0;
        const unitsPer = it.units_per != null ? Number(it.units_per) || 0 : 0;

        return {
          sku: p?.sku || "",
          sku_var: p?.sku_var || "",
          product_name: p?.product_name || "",
          po_number: poNumber || "",
          pieces: qty * (unitsPer || 1),
        };
      });

      for (const it of cItems) {
        console.log("Checking item:", it.purchase_order_line_id);
        const poId = poLineToOrderMap.get(it.purchase_order_line_id as string);
        const shipDate = poId ? orderToShipDateMap.get(poId) : null;
        console.log("Mapped ship date:", shipDate);
        if (!shipDate) continue;
        if (!earliestDate || new Date(shipDate) < new Date(earliestDate)) {
          earliestDate = shipDate;
        }
      }

      contentsByContainer.set(cId, preview.join(", "));
      shipDateByContainer.set(cId, earliestDate);
      itemsDetailByContainer.set(cId, items_detail);
    }

    const enriched = (containers || []).map((c) => ({
      ...c,
      contents_preview: contentsByContainer.get(c.id as string) || "",
      ship_date: shipDateByContainer.get(c.id as string) || null,
      items_detail: itemsDetailByContainer.get(c.id as string) || [],
    }));

    return NextResponse.json({ containers: enriched });
  } catch (err: any) {
    console.error("Error in containers-v2 available endpoint", err);
    return NextResponse.json({ error: "Failed to load available containers" }, { status: 500 });
  }
}
