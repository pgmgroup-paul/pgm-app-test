"use client";
"use no memo";

import * as React from "react";

import type { z } from "zod";

import { Label } from "@/components/ui/label";
import { useDataTableInstance } from "@/hooks/use-data-table-instance";

import { DataTable as DataTableNew } from "../../../../../components/data-table/data-table";
import { DataTablePagination } from "../../../../../components/data-table/data-table-pagination";
import { ordersReadyColumns } from "./columns";
import type { orderReadySchema } from "./schema";

export function DataTable({ data }: { data: z.infer<typeof orderReadySchema>[] }) {
  const table = useDataTableInstance<z.infer<typeof orderReadySchema>, unknown>({
    data,
    columns: ordersReadyColumns,
    enableRowSelection: false,
    getRowId: (row) => row.id,
  });

  return (
    <div className="w-full flex flex-col justify-start gap-4">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Orders Ready
        </Label>
      </div>
      <div className="relative flex flex-col gap-4 overflow-auto">
        <div className="overflow-hidden rounded-lg border">
          <DataTableNew table={table} columns={ordersReadyColumns} />
        </div>
        <DataTablePagination table={table} />
      </div>
    </div>
  );
}
