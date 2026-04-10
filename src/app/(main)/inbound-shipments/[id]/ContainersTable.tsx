"use client";

import React, { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export type ShipmentContainerRow = {
  id: string;
  container_id: string;
  container_name: string;
  items_preview?: string[] | null;
  ship_date?: string | null;
  display_status?: string | null;
};

type Props = {
  containers: ShipmentContainerRow[];
  shipmentId: string;
  canEditContainers: boolean;
  removeAction: (formData: FormData) => void;
};

interface ItemRow {
  sku: string | null;
  product_name: string | null;
  po_number: string | null;
  pieces: number | null;
}

export function ContainersTable({ containers, shipmentId, canEditContainers, removeAction }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsByContainer, setItemsByContainer] = useState<
    Record<string, ItemRow[]>
  >({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  const toggleExpand = async (containerRowId: string, containerId: string) => {
    setExpandedId((prev) => (prev === containerRowId ? null : containerRowId));

    // If we already have items cached, don't refetch
    if (itemsByContainer[containerRowId]) return;

    if (!containerId) {
      console.error("Missing containerId for items fetch", { containerRowId, containerId });
      return;
    }

    console.log("Fetching items for container:", containerId);

    try {
      setLoadingMap((prev) => ({ ...prev, [containerRowId]: true }));

      const { data, error } = await supabase
        .from("container_items_v2")
        .select(
          `
          quantity,
          units_per,
          product:products ( sku, product_name ),
          purchase_order_line:purchase_order_lines (
            purchase_order:purchase_orders ( po_number )
          )
        `,
        )
        .eq("container_id", containerId);

      if (error) {
        console.error("Error loading container items", error);
        setItemsByContainer((prev) => ({ ...prev, [containerRowId]: [] }));
        return;
      }

      const mapped: ItemRow[] = (data || []).map((item: any) => ({
        sku: item.product?.sku ?? null,
        product_name: item.product?.product_name ?? null,
        po_number:
          item.purchase_order_line?.purchase_order?.po_number ?? null,
        pieces:
          item.quantity != null && item.units_per != null
            ? item.quantity * item.units_per
            : null,
      }));

      setItemsByContainer((prev) => ({
        ...prev,
        [containerRowId]: mapped,
      }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [containerRowId]: false }));
    }
  };

  return (
    <table className="w-full text-sm border">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-2 text-left">Container</th>
          <th className="p-2 text-left">Contents</th>
          <th className="p-2 text-left">Ship Date</th>
          <th className="p-2 text-left">Status</th>
          <th className="p-2 text-left">Action</th>
        </tr>
      </thead>
      <tbody>
        {containers.map((c) => {
          const items = (c.items_preview ?? []) as string[];
          const contents = items.join(", ");
          const shipDate = c.ship_date ?? "-";

          const isExpanded = expandedId === c.id;
          const itemRows = itemsByContainer[c.id] || [];
          const isLoading = loadingMap[c.id];

          return (
            <React.Fragment key={c.id}>
              <tr
                className="cursor-pointer border-t hover:bg-gray-50"
                onClick={() => toggleExpand(c.id, c.id)}
              >
                <td className="p-2">
                  <Link
                    href={`/inbound-containers/${c.id}`}
                    className="underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.container_name}
                  </Link>
                </td>
                <td className="p-2">{contents}</td>
                <td className="p-2">{shipDate}</td>
                <td className="p-2">{c.display_status}</td>
                <td className="p-2">
                  <form action={removeAction} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="hidden"
                      name="shipment_id"
                      value={shipmentId}
                    />
                    <input
                      type="hidden"
                      name="container_id"
                      value={c.id}
                    />
                    <button
                      type="submit"
                      className="rounded border px-2 py-1 text-xs"
                      disabled={!canEditContainers}
                    >
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
              {isExpanded && (
                <tr>
                  <td colSpan={5} className="bg-gray-50 p-2">
                    {isLoading && (
                      <div className="text-xs text-gray-500">
                        Loading items...
                      </div>
                    )}
                    {!isLoading && itemRows.length === 0 && (
                      <div className="text-xs text-gray-500">
                        No items
                      </div>
                    )}
                    {!isLoading && itemRows.length > 0 && (
                      <table className="w-full text-xs border-t mt-1">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="p-1 text-left">SKU</th>
                            <th className="p-1 text-left">PO</th>
                            <th className="p-1 text-right">Pieces</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemRows.map((item, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="p-1">
                                <div className="font-medium">
                                  {item.sku || "(unknown)"}
                                </div>
                                {item.product_name && (
                                  <div className="text-[11px] text-slate-500">
                                    {item.product_name}
                                  </div>
                                )}
                              </td>
                              <td className="p-1">
                                {item.po_number || "-"}
                              </td>
                              <td className="p-1 text-right">
                                {item.pieces ?? "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
        {containers.length === 0 && (
          <tr>
            <td
              colSpan={5}
              className="p-2 text-sm text-gray-500 italic"
            >
              No containers
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
