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

      {/* Contents cards */}
      {contentsState.ok === true && contentsState.containerCode && (
        <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
          <p className="font-medium">
            Contents received for container <span className="font-mono">{contentsState.containerCode}</span>
          </p>

          {contentsState.rows && contentsState.rows.length > 0 ? (
            <div className="space-y-2">
              {contentsState.rows.map((row) => {
                const discrepancy = row.discrepancy ?? null;
                const isUnder = discrepancy !== null && discrepancy < 0;
                const formattedDiscrepancy =
                  discrepancy === null || discrepancy === 0
                    ? 0
                    : discrepancy > 0
                      ? `+${discrepancy}`
                      : `${discrepancy}`;
                const receivedUnits = row.received_units ?? 0;
                const loosePieces = row.loose_pieces_received ?? 0;
                const totalReceived = receivedUnits + loosePieces;
                const matchesExpected = totalReceived === row.expected_units;

                return (
                  <div key={row.product_id} className="rounded-lg border bg-white p-3 text-[11px] shadow-sm">
                    <div className="font-mono font-semibold text-sm">{row.sku}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{row.product_name}</div>
                    <div className="mt-2 space-y-1">
                      <div>Expected: {row.expected_units} units</div>
                      <div>Received: {row.received_units ?? "-"} units</div>
                      <div>Loose: {row.loose_pieces_received ?? "-"}</div>
                      <div className={matchesExpected ? "font-medium text-emerald-700" : ""}>
                        Total received: {totalReceived} units
                        {matchesExpected && <span className="ml-1">✓</span>}
                      </div>
                      <div className={isUnder ? "font-medium text-destructive" : ""}>
                        Discrepancy: {formattedDiscrepancy}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              No inventory movements have been recorded for this container yet.
            </p>
          )}

          <div className="sticky right-0 bottom-0 left-0 mt-4 flex flex-col gap-2 bg-background/80 pt-2 pb-1">
            <form action={handleReceive} className="w-full">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
              >
                Mark container as unloaded
              </button>
            </form>

            <form action={handleUndo} className="w-full">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-md border border-input border-dashed px-3 py-2 font-medium text-[11px] text-muted-foreground hover:bg-muted/40"
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
