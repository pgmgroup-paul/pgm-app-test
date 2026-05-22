"use client";
"use no memo";

import * as React from "react";

import type { z } from "zod";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDataTableInstance } from "@/hooks/use-data-table-instance";

import { DataTable as DataTableNew } from "../../../../../components/data-table/data-table";
import { DataTablePagination } from "../../../../../components/data-table/data-table-pagination";
import {
  incomingContainerColumns,
  incomingItemColumns,
  type IncomingContainer,
  type IncomingItem,
} from "./columns";
import { incomingContainerSchema, incomingItemSchema } from "./schema";

export function DataTable({
  containers,
  items,
}: {
  containers: z.infer<typeof incomingContainerSchema>[];
  items: z.infer<typeof incomingItemSchema>[];
}) {
  const containerTable = useDataTableInstance<IncomingContainer, unknown>({
    data: containers,
    columns: incomingContainerColumns,
    getRowId: (row) => row.id,
  });

  const itemTable = useDataTableInstance<IncomingItem, unknown>({
    data: items,
    columns: incomingItemColumns,
    getRowId: (row) => row.id,
  });

  return (
    <Tabs defaultValue="containers" className="w-full flex-col justify-start gap-6">
      <div className="flex items-center justify-between">
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <Select defaultValue="containers">
          <SelectTrigger className="flex @4xl/main:hidden w-fit" size="sm" id="view-selector">
            <SelectValue placeholder="Select a view" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="containers">Incoming Containers</SelectItem>
            <SelectItem value="items">Incoming Items</SelectItem>
          </SelectContent>
        </Select>
        <TabsList className="@4xl/main:flex hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1">
          <TabsTrigger value="containers">Incoming Containers</TabsTrigger>
          <TabsTrigger value="items">Incoming Items</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="containers" className="relative flex flex-col gap-4 overflow-auto">
        <div className="overflow-hidden rounded-lg border">
          <DataTableNew table={containerTable} columns={incomingContainerColumns} />
        </div>
        <DataTablePagination table={containerTable} />
      </TabsContent>

      <TabsContent value="items" className="relative flex flex-col gap-4 overflow-auto">
        <div className="overflow-hidden rounded-lg border">
          <DataTableNew table={itemTable} columns={incomingItemColumns} />
        </div>
        <DataTablePagination table={itemTable} />
      </TabsContent>
    </Tabs>
  );
}
