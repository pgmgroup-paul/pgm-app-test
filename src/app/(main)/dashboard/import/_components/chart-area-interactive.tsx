"use client";

import * as React from "react";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/lib/supabaseClient";

export const description = "Distinct SKUs physically received into the warehouse by month";

type ChartPoint = {
  month: string; // YYYY-MM-01
  distinct_skus: number;
};

const chartConfig = {
  distinct_skus: {
    label: "Distinct SKUs",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function ChartAreaInteractive() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("6M");
  const [chartData, setChartData] = React.useState<ChartPoint[]>([]);

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("6M");
    }
  }, [isMobile]);

  React.useEffect(() => {
    const load = async () => {
      try {
        // Step 1: load receipt lines (root source)
        const { data: lines, error: linesError } = await supabase
          .from("container_receipt_lines")
          .select("sku, quantity_received_units, container_receipt_id");

        if (linesError) {
          console.error("Error loading container receipt lines for SKU chart", linesError);
          setChartData([]);
          return;
        }

        // Collect receipt ids from lines with valid qty + sku
        const receiptIds = new Set<string>();
        for (const row of (lines || []) as any[]) {
          const qty = row.quantity_received_units != null ? Number(row.quantity_received_units) || 0 : 0;
          if (!Number.isFinite(qty) || qty <= 0) continue;
          const rawSku = (row.sku as string | null) || "";
          if (!rawSku.trim()) continue;

          const receiptId = (row.container_receipt_id as string | null) || null;
          if (!receiptId) continue;
          receiptIds.add(receiptId);
        }

        if (receiptIds.size === 0) {
          console.log("SKU chart: no qualifying receipt lines found");
          setChartData([]);
          return;
        }

        // Step 2: load receipts for those ids
        const { data: receipts, error: receiptsError } = await supabase
          .from("container_receipts")
          .select("id, received_at, container_id")
          .in("id", Array.from(receiptIds));

        if (receiptsError) {
          console.error("Error loading container receipts for SKU chart", receiptsError);
          setChartData([]);
          return;
        }

        const receiptMeta = new Map<string, { received_at: string | null; container_id: string | null }>();
        const containerIds = new Set<string>();

        for (const row of (receipts || []) as any[]) {
          const id = (row.id as string) || "";
          if (!id) continue;
          const received_at = (row.received_at as string | null) || null;
          const container_id = (row.container_id as string | null) || null;
          receiptMeta.set(id, { received_at, container_id });
          if (container_id) {
            containerIds.add(container_id);
          }
        }

        // Step 3: load containers for those container_ids
        let containerMeta = new Map<string, { unloaded_at: string | null }>();
        if (containerIds.size > 0) {
          const { data: containers, error: containersError } = await supabase
            .from("containers_v2")
            .select("id, unloaded_at")
            .in("id", Array.from(containerIds));

          if (containersError) {
            console.error("Error loading containers for SKU chart", containersError);
            setChartData([]);
            return;
          }

          containerMeta = new Map<string, { unloaded_at: string | null }>();
          for (const row of (containers || []) as any[]) {
            const id = (row.id as string) || "";
            if (!id) continue;
            const unloaded_at = (row.unloaded_at as string | null) || null;
            containerMeta.set(id, { unloaded_at });
          }
        }

        // Step 4: aggregate distinct SKUs per month based on coalesce(unloaded_at, received_at)
        const skuByMonth = new Map<string, Set<string>>();

        for (const row of (lines || []) as any[]) {
          const qty = row.quantity_received_units != null ? Number(row.quantity_received_units) || 0 : 0;
          if (!Number.isFinite(qty) || qty <= 0) continue;

          const rawSku = (row.sku as string | null) || "";
          const normSku = rawSku.trim().toUpperCase();
          if (!normSku) continue;

          const receiptId = (row.container_receipt_id as string | null) || null;
          if (!receiptId) continue;

          const receipt = receiptMeta.get(receiptId);
          if (!receipt) continue;

          const container = receipt.container_id ? containerMeta.get(receipt.container_id) : null;

          const operationalDate = (container?.unloaded_at as string | null) || receipt.received_at;
          if (!operationalDate) continue;

          const d = new Date(operationalDate);
          if (Number.isNaN(d.getTime())) continue;

          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

          let set = skuByMonth.get(monthKey);
          if (!set) {
            set = new Set<string>();
            skuByMonth.set(monthKey, set);
          }

          set.add(normSku);
        }

        const points: ChartPoint[] = Array.from(skuByMonth.entries())
          .map(([month, skuSet]) => ({ month, distinct_skus: skuSet.size }))
          .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));

        console.log("SKU chart raw lines", lines);
        console.log("SKU chart raw receipts", receipts);
        console.log("SKU chart raw containers", Array.from(containerMeta.entries()));
        console.log("SKU chart points", points);

        setChartData(points);
      } catch (err) {
        console.error("Unexpected error loading data for SKU chart", err);
        setChartData([]);
      }
    };

    load();
  }, []);

  const filteredData = chartData.filter((item) => {
    const monthDate = new Date(item.month);
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    let monthsBack = 6;
    if (timeRange === "3M") {
      monthsBack = 3;
    } else if (timeRange === "1M") {
      monthsBack = 1;
    }

    const rangeStart = new Date(currentMonthStart);
    rangeStart.setMonth(rangeStart.getMonth() - (monthsBack - 1));

    return monthDate >= rangeStart && monthDate <= currentMonthStart;
  });

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Distinct SKUs Received</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">Unique SKUs physically received into warehouse by month</span>
          <span className="@[540px]/card:hidden">Unique SKUs physically received into warehouse by month</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="@[767px]/card:flex hidden *:data-[slot=toggle-group-item]:px-4!"
          >
            <ToggleGroupItem value="6M">Last 6 months</ToggleGroupItem>
            <ToggleGroupItem value="3M">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="1M">This month</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex @[767px]/card:hidden w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="6M" className="rounded-lg">
                Last 6 months
              </SelectItem>
              <SelectItem value="3M" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="1M" className="rounded-lg">
                This month
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-62 w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillDistinctSkus" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-distinct_skus)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-distinct_skus)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                });
              }}
            />
            <ChartTooltip
              cursor={false}
              defaultIndex={isMobile ? -1 : 0}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    });
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="distinct_skus"
              type="natural"
              fill="url(#fillDistinctSkus)"
              stroke="var(--color-distinct_skus)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
