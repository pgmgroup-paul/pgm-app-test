"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface AvailableContainerRow {
  id: string;
  container_number: string | null;
  temp_code: string | null;
  status: string | null;
}

interface ItemRow {
  sku: string | null;
  product_name: string | null;
  po_number: string | null;
  pieces: number | null;
}

type Props = {
  containers: AvailableContainerRow[];
};

export function AvailableContainersTable({ containers }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsByContainer, setItemsByContainer] = useState<
    Record<string, ItemRow[]>
  >({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  const toggleExpand = async (containerId: string) => {
    setExpandedId((prev) => (prev === containerId ? null : containerId));

    // If we already have items cached, don't refetch
    if (itemsByContainer[containerId]) return;

    if (!containerId) {
      console.error("Missing containerId for available items fetch", {
        containerId,
      });
      return;
    }

    console.log("Fetching items for available container:", containerId);

    try {
      setLoadingMap((prev) => ({ ...prev, [containerId]: true }));

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
        console.error("Error loading available container items", error);
        setItemsByContainer((prev) => ({ ...prev, [containerId]: [] }));
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
        [containerId]: mapped,
      }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [containerId]: false }));
    }
  };

  return (
    <table className="w-full text-sm border">
      <thead>
        <tr className="bg-gray-100">
          <th className="p-2 text-left">Container #</th>
          <th className="p-2 text-left">Status</th>
        </tr>
      </thead>
      <tbody>
        {containers.map((c) => {
          const displayName = c.container_number || c.temp_code || "(pending)";
          const isExpanded = expandedId === c.id;
          const itemRows = itemsByContainer[c.id] || [];
          const isLoading = loadingMap[c.id];

          return (
            <React.Fragment key={c.id}>
              <tr
                className="cursor-pointer border-t hover:bg-gray-50"
                onClick={() => toggleExpand(c.id)}
              >
                <td className="p-2">{displayName}</td>
                <td className="p-2">{c.status || "-"}</td>
              </tr>
              {isExpanded && (
                <tr>
                  <td colSpan={2} className="bg-gray-50 p-2">
                    {isLoading && (
                      <div className="text-xs text-gray-500">
                        Loading items...
                      </div>
                    )}
                    {!isLoading && itemRows.length === 0 && (
                      <div className="text-xs text-gray-500">No items</div>
                    )}
                    {!isLoading && itemRows.length > 0 && (
                      <table className="mt-1 w-full border-t text-xs">
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
              colSpan={2}
              className="p-2 text-sm italic text-gray-500"
            >
              No available containers
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
