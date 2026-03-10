"use client";

import { useActionState, useState } from "react";

import { type DropshipSaveState, saveDropshipTransfer } from "./save-transfer";
import { type DropshipSourcesState, loadDropshipSources } from "./sources-load";

const initialState: DropshipSourcesState = { ok: null };

export function DropshipTransferShell() {
  const [state, formAction] = useActionState<DropshipSourcesState, FormData>(loadDropshipSources, initialState);

  const [saveState, saveAction] = useActionState<DropshipSaveState, FormData>(saveDropshipTransfer, { ok: null });

  const [sourceType, setSourceType] = useState<"container" | "order_leftover" | "inventory">("container");

  return (
    <div className="space-y-4">
      {/* SKU lookup */}
      <form action={formAction} className="space-y-3 rounded-md border px-3 py-3 text-sm">
        <div className="space-y-1 text-sm">
          <label htmlFor="sku" className="font-medium">
            SKU
          </label>
          <input
            id="sku"
            name="sku"
            type="text"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1 text-sm">
          <label htmlFor="sku_var" className="font-medium">
            Variant (optional)
          </label>
          <input
            id="sku_var"
            name="sku_var"
            type="text"
            placeholder="e.g. GREEN, 10oz, Large"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-xs hover:bg-primary/90"
        >
          Check SKU &amp; load sources
        </button>

        {state.ok === false && state.error && <p className="mt-2 text-destructive text-xs">{state.error}</p>}

        {state.ok === true && state.productName && (
          <p className="mt-2 text-emerald-700 text-xs">
            Product: <span className="font-semibold">{state.productName}</span>
          </p>
        )}
      </form>

      {/* Sources + save block */}
      {state.ok === true && state.productId && (
        <form action={saveAction} className="space-y-3 rounded-md border px-3 py-3 text-xs">
          {/* keep track of which product is being logged */}
          <input type="hidden" name="product_id" value={state.productId} />
          <input type="hidden" name="sku" value={state.sku || ""} />
          <input type="hidden" name="sku_var" value={state.skuVar || ""} />

          <p className="font-medium">Sources for this product</p>

          <div className="space-y-1 text-xs">
            <label htmlFor="source_type" className="font-medium">
              Source type
            </label>
            <select
              id="source_type"
              name="source_type"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as any)}
            >
              <option value="container">Container</option>
              <option value="order_leftover">Order leftover</option>
              <option value="inventory">Inventory</option>
            </select>
            <p className="text-[10px] text-muted-foreground">
              {sourceType === "container" && "Log transfer from a received container into the dropship area."}
              {sourceType === "order_leftover" &&
                "Log leftover units from a processing shipment into the dropship area."}
              {sourceType === "inventory" &&
                "Log a manual transfer from existing warehouse inventory into the dropship area."}
            </p>
          </div>

          {sourceType === "container" && state.containers && state.containers.length > 0 && (
            <div className="space-y-1 border-t pt-2 text-xs">
              <p className="font-medium">Containers (status = received)</p>
              <div className="max-h-40 overflow-auto rounded-md border">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b text-[11px] text-muted-foreground">
                    <tr>
                      <th className="w-6 py-1 pr-2" />
                      <th className="py-1 pr-2">Container</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.containers.map((c) => (
                      <tr key={c.id} className="border-b last:border-none">
                        <td className="py-1 pr-2 text-right align-top">
                          <input type="radio" name="source_container_id" value={c.id} className="h-3 w-3" />
                        </td>
                        <td className="py-1 pr-2 font-mono text-[11px]">{c.container_number}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {sourceType === "order_leftover" && state.shipments && state.shipments.length > 0 && (
            <div className="space-y-1 border-t pt-2 text-xs">
              <p className="font-medium">Shipments (processing) for this product</p>
              <div className="max-h-40 overflow-auto rounded-md border">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b text-[11px] text-muted-foreground">
                    <tr>
                      <th className="w-6 py-1 pr-2" />
                      <th className="py-1 pr-2">Shipment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.shipments.map((s) => (
                      <tr key={s.id} className="border-b last:border-none">
                        <td className="py-1 pr-2 text-right align-top">
                          <input type="radio" name="source_shipment_id" value={s.id} className="h-3 w-3" />
                        </td>
                        <td className="py-1 pr-2 font-mono text-[11px]">
                          {s.order_number}-{s.shipment_sequence}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {sourceType === "container" && (!state.containers || state.containers.length === 0) && (
            <p className="text-[10px] text-muted-foreground">No received containers found containing this product.</p>
          )}

          {sourceType === "order_leftover" && (!state.shipments || state.shipments.length === 0) && (
            <p className="text-[10px] text-muted-foreground">No processing shipments found containing this product.</p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1 text-xs">
              <label htmlFor="quantity" className="font-medium">
                Quantity
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min={0}
                step={1}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1 text-xs">
              <label htmlFor="unit" className="font-medium">
                Unit
              </label>
              <select
                id="unit"
                name="unit"
                defaultValue="pieces"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="pieces">Pieces</option>
                {sourceType === "container" && <option value="cases">Cases</option>}
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
          >
            Save dropship transfer
          </button>

          {saveState.ok === false && saveState.error && <p className="text-destructive text-xs">{saveState.error}</p>}

          {saveState.ok === true && saveState.message && (
            <p className="text-emerald-700 text-xs">{saveState.message}</p>
          )}
        </form>
      )}
    </div>
  );
}
