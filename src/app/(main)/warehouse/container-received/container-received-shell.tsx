"use client";

import { useActionState, useEffect, useState } from "react";

import { type ContainerReceiveState, markContainerReceived, undoContainerReceived } from "./container-receive";
import {
  type ContainerContentsState,
  loadContainerContents,
  loadReceivingContainers,
  type ReceivingContainersState,
} from "./containers-load";

export function ContainerReceivedShell() {
  const [containersState, setContainersState] = useState<ReceivingContainersState>({
    ok: null,
  });
  const [selectedContainerId, setSelectedContainerId] = useState<string>("");

  const [contentsState, contentsAction] = useActionState<ContainerContentsState, FormData>(loadContainerContents, {
    ok: null,
  });

  const [receiveState, receiveAction] = useActionState<ContainerReceiveState, FormData>(markContainerReceived, {
    ok: null,
  });

  const [undoState, undoAction] = useActionState<ContainerReceiveState, FormData>(undoContainerReceived, { ok: null });

  // Load receiving containers on mount
  useEffect(() => {
    (async () => {
      const res = await loadReceivingContainers();
      setContainersState(res);
    })();
  }, []);

  const handleSelectContainer = (id: string) => {
    setSelectedContainerId(id);
  };

  const handleLoadContents = (formData: FormData) => {
    if (!selectedContainerId) return;
    formData.append("container_id", selectedContainerId);
    contentsAction(formData);
  };

  const handleReceive = (formData: FormData) => {
    if (!selectedContainerId) return;
    formData.append("container_id", selectedContainerId);
    receiveAction(formData);
  };

  const handleUndo = (formData: FormData) => {
    if (!selectedContainerId) return;
    formData.append("container_id", selectedContainerId);
    undoAction(formData);
  };

  return (
    <div className="space-y-4">
      {/* Container selector */}
      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <p className="font-medium">Containers in receiving</p>

        {containersState.ok === false && containersState.error && (
          <p className="text-[11px] text-destructive">{containersState.error}</p>
        )}

        {containersState.ok === true && (!containersState.containers || containersState.containers.length === 0) && (
          <p className="text-[11px] text-muted-foreground">There are no containers currently in receiving status.</p>
        )}

        {containersState.containers && containersState.containers.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden max-h-48 overflow-auto rounded-md border md:block">
              <table className="w-full text-left text-[11px]">
                <thead className="border-b text-[11px] text-muted-foreground">
                  <tr>
                    <th className="w-6 py-1 pr-2" />
                    <th className="py-1 pr-2">Code</th>
                    <th className="py-1 pr-2">ETA</th>
                  </tr>
                </thead>
                <tbody>
                  {containersState.containers.map((c) => (
                    <tr key={c.id} className="border-b last:border-none">
                      <td className="py-1 pr-2 text-right align-top">
                        <input
                          type="radio"
                          name="container_id_select"
                          value={c.id}
                          className="h-3 w-3"
                          checked={selectedContainerId === c.id}
                          onChange={() => handleSelectContainer(c.id)}
                        />
                      </td>
                      <td className="py-1 pr-2 font-mono text-[11px]">{c.code}</td>
                      <td className="py-1 pr-2 text-[10px] text-muted-foreground">
                        {c.eta ? new Date(c.eta).toLocaleDateString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {containersState.containers.map((c) => (
                <a
                  key={c.id}
                  href={`/warehouse/receiving/${c.id}/pallet-config`}
                  className="block rounded-lg border bg-white p-3 shadow-sm"
                >
                  <div className="font-mono font-semibold text-sm">{c.code}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    ETA: {c.eta ? new Date(c.eta).toLocaleDateString() : "-"}
                  </div>
                  <div className="mt-1 text-[11px]">Status: Received</div>
                </a>
              ))}
            </div>
          </>
        )}

        <form action={handleLoadContents} className="pt-2">
          <button
            type="submit"
            disabled={!selectedContainerId}
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Load contents
          </button>
        </form>
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
                    const isUnder = discrepancy !== null && discrepancy < 0;
                    const formattedDiscrepancy =
                      discrepancy === null || discrepancy === 0
                        ? "-"
                        : discrepancy > 0
                          ? `+${discrepancy}`
                          : `${discrepancy}`;
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
                          className={`py-1 pr-2 text-right text-[11px]${isUnder ? "font-semibold text-destructive" : ""}`}
                        >
                          {formattedDiscrepancy}
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
                disabled={!selectedContainerId}
                className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark container as unloaded
              </button>
            </form>

            <form action={handleUndo}>
              <button
                type="submit"
                disabled={!selectedContainerId}
                className="inline-flex items-center rounded-md border border-input border-dashed px-3 py-1.5 font-medium text-[11px] text-muted-foreground hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
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
