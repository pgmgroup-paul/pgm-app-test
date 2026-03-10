"use client";

import { startTransition, use, useActionState, useEffect } from "react";

import {
  type ContainerReceiveState,
  markContainerReceived,
  undoContainerReceived,
} from "@/app/(main)/warehouse/container-received/container-receive";
import {
  type ContainerContentsState,
  loadContainerContents,
} from "@/app/(main)/warehouse/container-received/containers-load";

export default function WarehouseReceivingContentsPage({ params }: { params: Promise<{ containerId: string }> }) {
  const { containerId } = use(params);

  // We cannot call getCurrentUserProfile directly on the client; rely on route-level auth.
  // This page is intended to be linked from authenticated warehouse flows.

  const [contentsState, contentsAction] = useActionState<ContainerContentsState, FormData>(loadContainerContents, {
    ok: null,
  });

  // Automatically load contents on mount for this container
  useEffect(() => {
    startTransition(() => {
      const fd = new FormData();
      fd.append("container_id", containerId);
      contentsAction(fd);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, contentsAction]);

  const [receiveState, receiveAction] = useActionState<ContainerReceiveState, FormData>(markContainerReceived, {
    ok: null,
  });

  const [undoState, undoAction] = useActionState<ContainerReceiveState, FormData>(undoContainerReceived, { ok: null });

  const handleReceive = (formData: FormData) => {
    formData.append("container_id", containerId);
    receiveAction(formData);
  };

  const handleUndo = (formData: FormData) => {
    formData.append("container_id", containerId);
    undoAction(formData);
  };

  return (
    <div className="max-w-5xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Container contents</h1>
        <p className="text-muted-foreground text-sm">
          Review what has been received for this container and mark it as unloaded.
        </p>
      </div>

      {/* Contents table */}
      {contentsState.ok === true && contentsState.containerCode && (
        <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
          <p className="font-medium">
            Contents received for container <span className="font-mono">{contentsState.containerCode}</span>
          </p>

          {contentsState.rows && contentsState.rows.length > 0 ? (
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="border-b text-[11px] text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-2">SKU</th>
                    <th className="py-1 pr-2">Variant</th>
                    <th className="py-1 pr-2">Product</th>
                    <th className="py-1 pr-2 text-right">Quantity expected (pieces)</th>
                    <th className="py-1 pr-2 text-right">Quantity received (pieces)</th>
                    <th className="py-1 pr-2 text-right">Qty received (cases)</th>
                    <th className="py-1 pr-2 text-right">Loose pieces received</th>
                    <th className="py-1 pr-2 text-right">Discrepancy</th>
                  </tr>
                </thead>
                <tbody>
                  {contentsState.rows.map((row) => {
                    const discrepancy = row.discrepancy ?? null;
                    return (
                      <tr key={row.product_id} className="border-b last:border-none">
                        <td className="py-1 pr-2 font-mono text-[11px]">{row.sku}</td>
                        <td className="py-1 pr-2 text-[11px]">{row.sku_var}</td>
                        <td className="py-1 pr-2 text-[11px]">{row.product_name}</td>
                        <td className="py-1 pr-2 text-right text-[11px]">{row.expected_units}</td>
                        <td className="py-1 pr-2 text-right text-[11px]">{row.received_units ?? "-"}</td>
                        <td className="py-1 pr-2 text-right text-[11px]">{row.received_cases}</td>
                        <td className="py-1 pr-2 text-right text-[11px]">{row.loose_pieces_received ?? "-"}</td>
                        <td
                          className={
                            "py-1 pr-2 text-right text-[11px]" +
                            (discrepancy !== null && discrepancy !== 0 ? "font-semibold text-destructive" : "")
                          }
                        >
                          {discrepancy === null || discrepancy === 0 ? "-" : discrepancy}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No inventory movements have been recorded for this container yet.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <form action={handleReceive}>
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
              >
                Mark container as unloaded
              </button>
            </form>

            <form action={handleUndo}>
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-input border-dashed px-3 py-1.5 font-medium text-[11px] text-muted-foreground hover:bg-muted/40"
              >
                Undo receive
              </button>
            </form>

            {receiveState.ok === false && receiveState.error && (
              <span className="text-[11px] text-destructive">{receiveState.error}</span>
            )}

            {receiveState.ok === true && receiveState.message && (
              <span className="text-[11px] text-emerald-700">{receiveState.message}</span>
            )}

            {undoState.ok === false && undoState.error && (
              <span className="text-[11px] text-destructive">{undoState.error}</span>
            )}

            {undoState.ok === true && undoState.message && (
              <span className="text-[11px] text-emerald-700">{undoState.message}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
