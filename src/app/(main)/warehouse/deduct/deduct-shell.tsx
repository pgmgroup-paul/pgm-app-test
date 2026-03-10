"use client";

import { useActionState, useState } from "react";

import { type DeductMoveState, handleDeductMove } from "./deduct-move";
import { handleUndoDeduct, type UndoDeductState } from "./deduct-undo";
import { type DeductLocationState, loadDeductLocations } from "./locations-load";

const initialState: DeductLocationState = { ok: null };

export function DeductShell() {
  const [state, formAction] = useActionState<DeductLocationState, FormData>(loadDeductLocations, initialState);

  const [moveState, moveAction] = useActionState<DeductMoveState, FormData>(handleDeductMove, { ok: null });

  const [undoState, undoAction] = useActionState<UndoDeductState, FormData>(handleUndoDeduct, { ok: null });

  const [reason, setReason] = useState("dispose_damaged");

  return (
    <div className="space-y-4">
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
          Check SKU & load locations
        </button>

        {state.ok === false && state.error && <p className="mt-2 text-destructive text-xs">{state.error}</p>}

        {state.ok === true && state.productName && (
          <p className="mt-2 text-emerald-700 text-xs">
            Product: <span className="font-semibold">{state.productName}</span>
          </p>
        )}
      </form>

      {state.ok === true && state.rows && state.rows.length > 0 && (
        <form action={moveAction} className="space-y-2 rounded-md border px-3 py-2 text-xs">
          <p className="mb-1 font-medium">Locations for this product</p>

          {/* keep track of which product is being deducted */}
          <input type="hidden" name="product_id" value={state.productId || ""} />

          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b text-[11px] text-muted-foreground">
                <tr>
                  <th className="w-6 py-1 pr-2" />
                  <th className="py-1 pr-2">Warehouse</th>
                  <th className="py-1 pr-2">Location</th>
                  <th className="py-1 pr-2 text-right">Cases</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row) => (
                  <tr key={row.location_id} className="border-b last:border-none">
                    <td className="py-1 pr-2 text-right align-top">
                      <input type="radio" name="deduct_location_id" value={row.location_id} className="h-3 w-3" />
                    </td>
                    <td className="py-1 pr-2 text-[11px]">{row.warehouse_name}</td>
                    <td className="py-1 pr-2 font-mono text-[11px]">{row.location_code}</td>
                    <td className="py-1 pr-2 text-right text-[11px]">{row.quantity_cases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 rounded-md border px-3 py-2 text-xs">
            <p className="font-medium">Deduct from inventory</p>

            <div className="space-y-1 text-xs">
              <label htmlFor="deduct_reason" className="font-medium">
                Reason
              </label>
              <select
                id="deduct_reason"
                name="deduct_reason"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="order">Order</option>
                <option value="transfer_dropship">Transfer to dropship</option>
                <option value="dispose_damaged">Dispose damaged</option>
                <option value="special_instruction">Special instruction</option>
              </select>
              <p className="text-[10px] text-muted-foreground">
                {reason === "order"
                  ? "Select a shipment below to associate this deduction."
                  : reason === "transfer_dropship"
                    ? "Deduct from inventory and also log a transfer into the dropship area."
                    : reason === "special_instruction"
                      ? "Provide a note describing this special instruction."
                      : "Record this as damaged inventory disposal."}
              </p>
            </div>

            {reason === "order" && state.shipments && state.shipments.length > 0 && (
              <div className="space-y-1 border-t pt-2 text-xs">
                <p className="font-medium">Shipments (processing) for this product</p>
                <div className="max-h-40 overflow-auto rounded-md border">
                  <table className="w-full text-left text-[11px]">
                    <thead className="border-b text-[11px] text-muted-foreground">
                      <tr>
                        <th className="w-6 py-1 pr-2" />
                        <th className="py-1 pr-2">Shipment</th>
                        <th className="py-1 pr-2 text-right">Qty ordered (cases)</th>
                        <th className="py-1 pr-2 text-right">Qty remaining (cases)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.shipments.map((s) => (
                        <tr key={s.id} className="border-b last:border-none">
                          <td className="py-1 pr-2 text-right align-top">
                            <input type="radio" name="deduct_shipment_id" value={s.id} className="h-3 w-3" />
                          </td>
                          <td className="py-1 pr-2 font-mono text-[11px]">
                            {s.order_number}-{s.shipment_sequence}
                          </td>
                          <td className="py-1 pr-2 text-right text-[11px]">{Math.ceil(s.qty_ordered_cases)}</td>
                          <td className="py-1 pr-2 text-right text-[11px]">{Math.ceil(s.qty_remaining_cases)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {reason === "special_instruction" && (
              <div className="space-y-1 text-xs">
                <label htmlFor="deduct_note" className="font-medium">
                  Instruction / note
                </label>
                <textarea
                  id="deduct_note"
                  name="deduct_note"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            )}

            {reason === "order" && (!state.shipments || state.shipments.length === 0) && (
              <p className="text-[10px] text-muted-foreground">
                No processing shipments found for this product. You can still deduct, but it will not be linked to a
                shipment.
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 text-xs">
                <label htmlFor="deduct_quantity" className="font-medium">
                  Quantity to remove
                </label>
                <input
                  id="deduct_quantity"
                  name="deduct_quantity"
                  type="number"
                  min={0}
                  step={1}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1 text-xs">
                <label htmlFor="deduct_unit" className="font-medium">
                  Unit
                </label>
                <select
                  id="deduct_unit"
                  name="deduct_unit"
                  defaultValue="cases"
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="cases">Cases</option>
                  <option value="pallets">Pallets</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
            >
              Save deduct
            </button>

            {moveState.ok === false && moveState.error && <p className="text-destructive text-xs">{moveState.error}</p>}

            {moveState.ok === true && moveState.message && (
              <div className="space-y-1 text-xs">
                <p className="text-emerald-700">{moveState.message}</p>

                {moveState.movementId && (
                  <div className="inline-flex items-center gap-2 pt-1">
                    <input type="hidden" name="movement_id" value={moveState.movementId} />
                    <button
                      type="submit"
                      formAction={undoAction}
                      className="inline-flex items-center rounded-md border border-input border-dashed px-2 py-1 font-medium text-[10px] text-muted-foreground hover:bg-muted/40"
                    >
                      Undo last deduct
                    </button>
                    {undoState.ok === false && undoState.error && (
                      <span className="text-[10px] text-destructive">{undoState.error}</span>
                    )}
                    {undoState.ok === true && undoState.message && (
                      <span className="text-[10px] text-emerald-700">{undoState.message}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </form>
      )}

      {state.ok === true && (!state.rows || state.rows.length === 0) && (
        <p className="text-muted-foreground text-xs">This product has no inventory in any warehouse locations.</p>
      )}
    </div>
  );
}
