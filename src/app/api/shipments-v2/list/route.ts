import { NextResponse } from "next/server";

import { serverSupabase } from "@/lib/serverSupabase";

export async function GET(req: Request) {
  try {
    const supabase = serverSupabase;
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") || "active";

    let query = supabase
      .from("shipments_v2")
      .select("id, shipment_number, bol_number, status, created_at")
      .order("created_at", { ascending: false });

    if (statusFilter === "active") {
      query = query.neq("status", "Delivered").neq("status", "Canceled");
    } else if (statusFilter === "all") {
      // no status filter
    } else {
      // specific status value
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading shipments_v2 list", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const shipmentIds = (data || []).map((s) => s.id as string);

    let countMap = new Map<string, number>();
    let links: any[] = [];

    if (shipmentIds.length > 0) {
      const { data: linkRows } = await supabase
        .from("shipment_containers_v2")
        .select("shipment_id, container_id")
        .in("shipment_id", shipmentIds);

      links = linkRows || [];

      for (const l of links) {
        const sid = l.shipment_id as string;
        countMap.set(sid, (countMap.get(sid) || 0) + 1);
      }
    }

    // Compute shipment-level ship dates
    let shipDateMap = new Map<string, string | null>();

    if (links.length > 0) {
      const containerIds = Array.from(
        new Set(links.map((l) => l.container_id as string | undefined).filter(Boolean)),
      ) as string[];

      if (containerIds.length > 0) {
        const { data: items } = await supabase
          .from("container_items_v2")
          .select("container_id, purchase_order_line_id")
          .in("container_id", containerIds);

        const poLineIds = Array.from(
          new Set((items || []).map((i) => i.purchase_order_line_id as string | undefined).filter(Boolean)),
        ) as string[];

        let poLineToOrderMap = new Map<string, string | null>();
        let orderToShipDateMap = new Map<string, string | null>();

        if (poLineIds.length > 0) {
          const { data: poLines } = await supabase
            .from("purchase_order_lines")
            .select("id, purchase_order_id")
            .in("id", poLineIds);

          const poIds = Array.from(
            new Set((poLines || []).map((p) => p.purchase_order_id as string | undefined).filter(Boolean)),
          ) as string[];

          if (poIds.length > 0) {
            const { data: purchaseOrders } = await supabase
              .from("purchase_orders")
              .select("id, ship_date")
              .in("id", poIds);

            for (const p of poLines || []) {
              poLineToOrderMap.set(p.id as string, (p.purchase_order_id as string | null) ?? null);
            }

            for (const o of purchaseOrders || []) {
              orderToShipDateMap.set(o.id as string, (o.ship_date as string | null) ?? null);
            }
          }
        }

        // Group items by container
        const itemsByContainer = new Map<string, any[]>();
        for (const it of items || []) {
          const cid = it.container_id as string | undefined;
          if (!cid) continue;
          if (!itemsByContainer.has(cid)) {
            itemsByContainer.set(cid, []);
          }
          itemsByContainer.get(cid)!.push(it);
        }

        // Compute container-level earliest ship date
        const containerShipDateMap = new Map<string, string | null>();
        for (const cid of containerIds) {
          const cItems = itemsByContainer.get(cid) || [];
          let earliest: string | null = null;
          for (const it of cItems) {
            const poId = poLineToOrderMap.get(it.purchase_order_line_id as string);
            const shipDate = poId ? orderToShipDateMap.get(poId) : null;
            if (!shipDate) continue;
            if (!earliest || new Date(shipDate) < new Date(earliest)) {
              earliest = shipDate;
            }
          }
          containerShipDateMap.set(cid, earliest);
        }

        // Group containers by shipment
        const shipmentToContainers = new Map<string, string[]>();
        for (const l of links) {
          const sid = l.shipment_id as string;
          const cid = l.container_id as string;
          if (!shipmentToContainers.has(sid)) {
            shipmentToContainers.set(sid, []);
          }
          shipmentToContainers.get(sid)!.push(cid);
        }

        // Compute shipment-level earliest ship date
        for (const sid of shipmentIds) {
          const cids = shipmentToContainers.get(sid) || [];
          let earliest: string | null = null;
          for (const cid of cids) {
            const d = containerShipDateMap.get(cid);
            if (!d) continue;
            if (!earliest || new Date(d) < new Date(earliest)) {
              earliest = d;
            }
          }
          shipDateMap.set(sid, earliest);
        }
      }
    }

    const result = (data || []).map((s) => ({
      ...s,
      container_count: countMap.get(s.id as string) || 0,
      ship_date: shipDateMap.get(s.id as string) || null,
    }));

    // Fetch distinct statuses for filtering options (unfiltered, full set)
    const { data: statusRows } = await supabase
      .from("shipments_v2")
      .select("status");

    const statusSet = new Set<string>();
    for (const row of statusRows || []) {
      if (row.status) {
        statusSet.add(row.status as string);
      }
    }
    const statuses = Array.from(statusSet);

    return NextResponse.json({ shipments: result, statuses });
  } catch (err: any) {
    console.error("Error in shipments-v2 list endpoint", err);
    return NextResponse.json({ error: "Failed to load shipments" }, { status: 500 });
  }
}
