"use client";

import * as React from "react";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";

import type { WarehouseChartPoint } from "../page";

export const description = "Monthly outbound warehouse shipping volume";

type ChartPoint = WarehouseChartPoint;

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.slice(0, 7).split("-");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthIndex = Number(month) - 1;
  const monthName = monthIndex >= 0 && monthIndex < 12 ? monthNames[monthIndex] : monthKey;
  return `${monthName} ${year}`;
}

const chartConfig = {
  units: {
    label: "Units",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function ChartAreaInteractive({ chartData }: { chartData: ChartPoint[] }) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("6M");

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("3M");
    }
  }, [isMobile]);

  const filteredData = chartData.filter((item) => {
    // item.month is stored as YYYY-MM-01; normalize to YYYY-MM for comparisons
    const itemMonth = item.month.slice(0, 7); // YYYY-MM

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonthIndex = today.getMonth(); // 0-based

    let monthsBack = 6;
    if (timeRange === "3M") {
      monthsBack = 3;
    } else if (timeRange === "1M") {
      monthsBack = 1;
    }

    // Compute range start year/month in UTC-safe arithmetic
    const startMonthIndex = currentMonthIndex - (monthsBack - 1);
    const startYear = currentYear + Math.floor(startMonthIndex / 12);
    const normalizedStartMonthIndex = ((startMonthIndex % 12) + 12) % 12;

    const currentMonthStr = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, "0")}`; // YYYY-MM
    const rangeStartStr = `${startYear}-${String(normalizedStartMonthIndex + 1).padStart(2, "0")}`; // YYYY-MM

    return itemMonth >= rangeStartStr && itemMonth <= currentMonthStr;
  });

  // Temporary debug: verify final chart data shape
  console.log("Final warehouse chartData", chartData);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Units Shipped by Month</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">Monthly outbound warehouse shipping volume</span>
          <span className="@[540px]/card:hidden">Monthly outbound warehouse shipping volume</span>
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
              <SelectValue placeholder="Last 6 months" />
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
              <linearGradient id="fillUnits" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-units)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-units)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => formatMonthLabel(String(value))}
            />
            <ChartTooltip
              cursor={false}
              defaultIndex={isMobile ? -1 : 0}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatMonthLabel(String(value))}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="units"
              type="natural"
              fill="url(#fillUnits)"
              stroke="var(--color-units)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
