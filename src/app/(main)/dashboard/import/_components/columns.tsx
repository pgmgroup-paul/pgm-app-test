import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "../../../../../components/data-table/data-table-column-header";
import type { z } from "zod";
import type { incomingContainerSchema, incomingItemSchema } from "./schema";

export type IncomingContainer = z.infer<typeof incomingContainerSchema>;
export type IncomingItem = z.infer<typeof incomingItemSchema>;

export const incomingContainerColumns: ColumnDef<IncomingContainer>[] = [
  {
    accessorKey: "container",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Container" />,
    cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.container}</span>,
    enableSorting: true,
  },
  {
    accessorKey: "eta",
    header: ({ column }) => <DataTableColumnHeader column={column} title="ETA" />,
    cell: ({ row }) => {
      const eta = row.original.eta;
      const date = eta ? new Date(eta) : null;
      const label = date
        ? date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })
        : "-";
      return <span className="text-[11px]">{label}</span>;
    },
    enableSorting: true,
  },
];

export const incomingItemColumns: ColumnDef<IncomingItem>[] = [
  {
    accessorKey: "sku",
    header: ({ column }) => <DataTableColumnHeader column={column} title="SKU" />,
    cell: ({ row }) => {
      const { sku, sku_var } = row.original;
      const label = sku_var ? `${sku} ${sku_var}` : sku;
      return <span className="font-mono text-[11px]">{label}</span>;
    },
    enableSorting: true,
  },
  {
    accessorKey: "product_name",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Product Name" />,
    cell: ({ row }) => <span className="text-[11px]">{row.original.product_name}</span>,
    enableSorting: true,
  },
  {
    accessorKey: "qty_pieces",
    header: ({ column }) => (
      <DataTableColumnHeader className="text-center" column={column} title="Qty (Pieces)" />
    ),
    cell: ({ row }) => (
      <span className="text-[11px] tabular-nums text-center block">
        {row.original.qty_pieces.toLocaleString()}
      </span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "eta",
    header: ({ column }) => <DataTableColumnHeader column={column} title="ETA" />,
    cell: ({ row }) => {
      const eta = row.original.eta;
      const date = eta ? new Date(eta) : null;
      const label = date
        ? date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })
        : "-";
      return <span className="text-[11px]">{label}</span>;
    },
    enableSorting: true,
  },
  {
    accessorKey: "container",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Container" />,
    cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.container}</span>,
    enableSorting: true,
  },
];
