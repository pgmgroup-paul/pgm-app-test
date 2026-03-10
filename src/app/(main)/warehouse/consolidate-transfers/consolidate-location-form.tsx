"use client";

import { useActionState } from "react";

import { loadLocationContents } from "./consolidate-location-load";
import { type ConsolidateMoveState, handleConsolidateMove } from "./consolidate-move";

interface Props {
  warehouses: { id: string; name: string }[];
}

interface LocationState {
  ok: boolean | null;
  error?: string;
  message?: string;
  sourceWarehouse?: string;
  sourceLocation?: string;
  rows?: {
    product_id: string;
    sku: string;
    sku_var: string | null;
    product_name: string;
    quantity_cases: number;
  }[];
}

const initialState: LocationState = { ok: null };

export function ConsolidateLocationForm({ warehouses }: Props) {
  const [state, formAction] = useActionState<LocationState, FormData>(loadLocationContents, initialState);

  const [moveState, moveAction] = useActionState<ConsolidateMoveState, FormData>(handleConsolidateMove, { ok: null });

  return (
    <div className="max-w-xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Consolidate</h1>
        <p className="text-muted-foreground text-sm">Move product from one location to another.</p>
      </div>

      <form action={formAction} className="space-y-3 rounded-md border px-3 py-3 text-sm">
        <div className="space-y-1 text-sm">
          <label htmlFor="source_warehouse" className="font-medium">
            Source warehouse
          </label>
          <select
            id="source_warehouse"
            name="source_warehouse"
            required
            defaultValue={warehouses?.[0]?.name ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {warehouses?.map((w) => (
              <option key={w.id} value={w.name}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 text-sm">
          <label htmlFor="source_location" className="font-medium">
            Source location (A1–D50)
          </label>
          <input
            id="source_location"
            name="source_location"
            type="text"
            required
            placeholder="e.g. A1, B12"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-[11px] text-muted-foreground">Shows all SKUs currently stored at this location.</p>
        </div>

        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-xs hover:bg-primary/90"
        >
          Load location contents
        </button>

        {state.ok === false && state.error && <p className="mt-2 text-destructive text-xs">{state.error}</p>}

        {state.ok === true && state.message && <p className="mt-2 text-emerald-700 text-xs">{state.message}</p>}
      </form>

      {state.ok === true && state.rows && state.rows.length > 0 && (
        <form action={moveAction} className="space-y-2 rounded-md border px-3 py-2 text-xs">
          <p className="mb-1 font-medium">
            Location contents
            {state.sourceLocation && (
              <span className="font-normal text-muted-foreground"> on {state.sourceLocation}</span>
            )}
          </p>

          {/* carry source context from load action into move action */}
          <input type="hidden" name="source_warehouse" value={state.sourceWarehouse || ""} />
          <input type="hidden" name="source_location" value={state.sourceLocation || ""} />
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b text-[11px] text-muted-foreground">
                <tr>
                  <th className="w-6 py-1 pr-2" />
                  <th className="py-1 pr-2">SKU</th>
                  <th className="py-1 pr-2">Variant</th>
                  <th className="py-1 pr-2">Product</th>
                  <th className="py-1 pr-2 text-right">Cases</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row) => (
                  <tr key={row.product_id} className="border-b last:border-none">
                    <td className="py-1 pr-2 align-top">
                      <input type="radio" name="source_product_id" value={row.product_id} className="h-3 w-3" />
                    </td>
                    <td className="py-1 pr-2 font-mono text-[11px]">{row.sku}</td>
                    <td className="py-1 pr-2 text-[11px]">{row.sku_var}</td>
                    <td className="py-1 pr-2 text-[11px]">{row.product_name}</td>
                    <td className="py-1 pr-2 text-right text-[11px]">{row.quantity_cases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 space-y-2 border-t pt-2">
            <p className="font-medium">Move selected SKU</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 text-xs">
                <label htmlFor="dest_warehouse" className="font-medium">
                  Destination warehouse
                </label>
                <select
                  id="dest_warehouse"
                  name="dest_warehouse"
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  defaultValue={warehouses?.[0]?.name ?? ""}
                >
                  {warehouses?.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 text-xs">
                <label htmlFor="dest_location" className="font-medium">
                  Destination location
                </label>
                <input
                  id="dest_location"
                  name="dest_location"
                  type="text"
                  placeholder="e.g. B5, C20"
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-[10px] text-muted-foreground">
                  Location will be auto-created at the destination warehouse if it does not exist.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 text-xs">
                <label htmlFor="move_quantity" className="font-medium">
                  Quantity to move
                </label>
                <input
                  id="move_quantity"
                  name="move_quantity"
                  type="number"
                  min={0}
                  step={1}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1 text-xs">
                <label htmlFor="move_unit" className="font-medium">
                  Unit
                </label>
                <select
                  id="move_unit"
                  name="move_unit"
                  defaultValue="pallets"
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="pallets">Pallets</option>
                  <option value="cases">Cases</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
            >
              Save consolidate movement
            </button>

            {moveState.ok === false && moveState.error && <p className="text-destructive text-xs">{moveState.error}</p>}

            {moveState.ok === true && moveState.message && (
              <p className="text-emerald-700 text-xs">{moveState.message}</p>
            )}
          </div>
        </form>
      )}

      {state.ok === true && (!state.rows || state.rows.length === 0) && (
        <p className="text-muted-foreground text-xs">No inventory found at this location.</p>
      )}
    </div>
  );
}
