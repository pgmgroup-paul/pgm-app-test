import type { ColumnDef } from "@tanstack/react-table";
import type { OrderReady } from "./schema";

import { DataTableColumnHeader } from "../../../../../components/data-table/data-table-column-header";

export const ordersReadyColumns: ColumnDef<OrderReady, unknown>[] = [
  {
    accessorKey: "shipment",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Shipment" />,
    cell: ({ row }) => <span className="font-mono text-xs sm:text-sm">{row.original.shipment}</span>,
  },
  {
    accessorKey: "order",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
    cell: ({ row }) => <span className="font-mono text-xs sm:text-sm">{row.original.order}</span>,
  },
  {
    accessorKey: "customer",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
    cell: ({ row }) => <span className="text-xs sm:text-sm">{row.original.customer}</span>,
  },
  {
    accessorKey: "ship_date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ship date" />,
    cell: ({ row }) => (
      <span className="text-xs sm:text-sm">{row.original.ship_date}</span>
    ),
  },
];
