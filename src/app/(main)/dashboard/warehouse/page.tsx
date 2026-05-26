import { serverSupabase } from "@/lib/serverSupabase";

import { ChartAreaInteractive } from "./_components/chart-area-interactive";
import { DataTable } from "./_components/data-table";
import { SectionCards } from "./_components/section-cards";

export type WarehouseChartPoint = {
  month: string; // YYYY-MM-01
  units: number;
};

async function loadReadyOrders(limit: number = 12) {
  const { data, error } = await serverSupabase
    .from("so_shipments")
    .select(
      `id,
       shipment_sequence,
       status,
       sales_orders!inner(order_number, customer_name, requested_ship_date)`
    )
    .eq("status", "ready")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error loading ready shipments for warehouse dashboard", error);
    return [];
  }

  const rows = (data || []) as any[];

  return rows.map((row) => {
    const so = (row as any).sales_orders as any;
    const orderNumber = (so?.order_number as string) || (row.sales_order_id as string) || "";
    const shipmentSequence = Number(row.shipment_sequence) || 0;
    const customerName = (so?.customer_name as string) || "";
    const shipDate = (so?.requested_ship_date as string | null) || null;
    const shipDateLabel = shipDate
      ? new Date(shipDate + "T00:00:00Z").toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
      : "-";

    return {
      id: (row.id as string) || `${orderNumber}-${shipmentSequence || ""}` || orderNumber,
      shipment: shipmentSequence ? `${orderNumber}-${shipmentSequence}` : orderNumber,
      order: orderNumber,
      customer: customerName || "-",
      ship_date: shipDateLabel,
    };
  });
}

async function loadShippedUnitsByMonth(): Promise<WarehouseChartPoint[]> {
  try {
    // Load shipped shipments (status = 'shipped', shipped_at not null)
    const { data: shipments, error: shipmentsError } = await serverSupabase
      .from("so_shipments")
      .select("id, status, shipped_at")
      .eq("status", "shipped")
      .not("shipped_at", "is", null);

    if (shipmentsError) {
      console.error("Error loading shipped shipments for warehouse chart (server)", shipmentsError);
      return [];
    }

    const shipped = (shipments || []) as any[];
    if (shipped.length === 0) {
      return [];
    }

    const shipmentIdSet = new Set<string>();
    const shipmentDates = new Map<string, string>();

    for (const s of shipped) {
      const id = (s.id as string) || "";
      if (!id) continue;
      const rawDate = (s.shipped_at as string | null) || null;
      if (!rawDate) continue;
      shipmentIdSet.add(id);
      shipmentDates.set(id, rawDate);
    }

    if (shipmentIdSet.size === 0) {
      return [];
    }

    const shipmentIds = Array.from(shipmentIdSet);

    // Load shipment lines for those shipments and aggregate quantity_shipped_units
    const { data: lines, error: linesError } = await serverSupabase
      .from("so_shipment_lines")
      .select("so_shipment_id, quantity_shipped_units")
      .in("so_shipment_id", shipmentIds)
      .gt("quantity_shipped_units", 0);

    if (linesError) {
      console.error("Error loading shipped units for warehouse chart (server)", linesError);
      return [];
    }

    const totalsByMonth = new Map<string, number>();

    for (const row of (lines || []) as any[]) {
      const sid = (row.so_shipment_id as string | null) || null;
      if (!sid || !shipmentDates.has(sid)) continue;

      const qty = row.quantity_shipped_units != null ? Number(row.quantity_shipped_units) || 0 : 0;
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const rawDate = shipmentDates.get(sid) as string;
      const d = new Date(rawDate);
      if (Number.isNaN(d.getTime())) continue;

      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

      totalsByMonth.set(monthKey, (totalsByMonth.get(monthKey) || 0) + qty);
    }

    const points: WarehouseChartPoint[] = Array.from(totalsByMonth.entries())
      .map(([month, units]) => ({ month, units }))
      .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));

    return points;
  } catch (err) {
    console.error("Unexpected error loading shipped units for warehouse chart (server)", err);
    return [];
  }
}

export default async function Page() {
  const [data, openContainersToReceiveCount, ordersInQueueCount, ordersReadyCount, yesterdaysMovementsCount, chartData] =
    await Promise.all([
      loadReadyOrders(12),
      (async () => {
        const { count, error } = await serverSupabase
          .from("containers_v2")
          .select("id", { count: "exact", head: true })
          .eq("status", "Delivered");

        if (error) {
          console.error("Error loading Delivered containers count for warehouse KPI", error);
          return 0;
        }

        return count ?? 0;
      })(),
      (async () => {
        const { count, error } = await serverSupabase
          .from("so_shipments")
          .select("id", { count: "exact", head: true })
          .eq("status", "processing");

        if (error) {
          console.error("Error loading processing shipments count for warehouse KPI", error);
          return 0;
        }

        return count ?? 0;
      })(),
      (async () => {
        const { count, error } = await serverSupabase
          .from("so_shipments")
          .select("id", { count: "exact", head: true })
          .eq("status", "ready");

        if (error) {
          console.error("Error loading ready shipments count for warehouse KPI", error);
          return 0;
        }

        return count ?? 0;
      })(),
      (async () => {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Los_Angeles",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const parts = formatter.formatToParts(now);
        const year = Number(parts.find((p) => p.type === "year")?.value);
        const month = Number(parts.find((p) => p.type === "month")?.value);
        const day = Number(parts.find((p) => p.type === "day")?.value);

        const todayStart = new Date(
          `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00-07:00`,
        );
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);

        const { count, error } = await serverSupabase
          .from("inventory_movements")
          .select("id", { count: "exact", head: true })
          .gte("created_at", yesterdayStart.toISOString())
          .lt("created_at", todayStart.toISOString());

        if (error) {
          console.error("Error loading yesterday's movements count for warehouse KPI", error);
          return 0;
        }

        return count ?? 0;
      })(),
      loadShippedUnitsByMonth(),
    ]);

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <SectionCards
        openContainersToReceiveCount={openContainersToReceiveCount}
        ordersInQueueCount={ordersInQueueCount}
        ordersReadyCount={ordersReadyCount}
        yesterdaysMovementsCount={yesterdaysMovementsCount}
      />
      <ChartAreaInteractive chartData={chartData} />
      <DataTable data={data} />
    </div>
  );
}
