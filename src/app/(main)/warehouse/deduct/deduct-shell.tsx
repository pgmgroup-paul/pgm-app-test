"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { type DeductMoveState, handleDeductMove } from "./deduct-move";
import { handleUndoDeduct, type UndoDeductState } from "./deduct-undo";
import { type DeductLocationState, loadDeductLocations } from "./locations-load";
import { resolveProductById } from "./resolve-product";

const initialState: DeductLocationState = { ok: null };

export function DeductShell({
  productId,
  shipmentId,
  locationCode,
  reason: initialReason,
  isFromOrder,
}: {
  productId?: string;
  shipmentId?: string;
  locationCode?: string;
  reason?: string;
  isFromOrder?: boolean;
}) {
  const _isFromOrder = !!isFromOrder;
  const [state, formAction] = useActionState<DeductLocationState, FormData>(loadDeductLocations, initialState);

  const [moveState, moveAction] = useActionState<DeductMoveState, FormData>(handleDeductMove, { ok: null });

  const [undoState, undoAction] = useActionState<UndoDeductState, FormData>(handleUndoDeduct, { ok: null });

  // Local reason state (optional initial value from props)
  const [reason, setReason] = useState(initialReason || "dispose_damaged");

  // Local selections for auto-prefill + radios
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(undefined);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | undefined>(undefined);

  // Controlled inputs for SKU / variant and ref for quantity
  const [skuValue, setSkuValue] = useState("");
  const [skuVarValue, setSkuVarValue] = useState("");
  const quantityInputRef = useRef<HTMLInputElement | null>(null);

  const autoInitRef = useRef(false);
  const autoScrollRef = useRef(false);

  // If productId is present, resolve SKU and auto-run the existing load locations logic
  useEffect(() => {
    if (autoInitRef.current) return;
    if (!productId) return;

    autoInitRef.current = true;

    (async () => {
      const res = await resolveProductById(productId);
      if (!res.ok || !res.sku) {
        return;
      }

      setSkuValue(res.sku);
      setSkuVarValue(res.skuVar || "");

      const fd = new FormData();
      fd.append("sku", res.sku);
      if (res.skuVar) {
        fd.append("sku_var", res.skuVar);
      }

      // Run the existing loadLocations action inside a transition, as if the form had been submitted
      startTransition(() => {
        formAction(fd);
      });

      // If deep-linked with reason, prefer "order" as requested
      if (initialReason === "order") {
        setReason("order");
      }
    })();
  }, [productId, initialReason, formAction]);

  // After locations & shipments load, auto-select location/shipment
  useEffect(() => {
    if (state.ok !== true) return;

    // Select location based on locationCode
    if (!selectedLocationId && locationCode && state.rows && state.rows.length > 0) {
      const match = state.rows.find((r) => r.location_code === locationCode);
      if (match) {
        setSelectedLocationId(match.location_id);
      }
    }

    // Select shipment based on shipmentId when reason is order
    if (reason === "order" && shipmentId && !selectedShipmentId && state.shipments && state.shipments.length > 0) {
      const matchShipment = state.shipments.find((s) => s.id === shipmentId);
      if (matchShipment) {
        setSelectedShipmentId(matchShipment.id);
      }
    }
  }, [state, locationCode, shipmentId, selectedLocationId, selectedShipmentId, reason]);

  // On mobile deep-links, scroll quantity into view and focus once everything is ready
  useEffect(() => {
    if (autoScrollRef.current) return;
    if (typeof window === "undefined") return;

    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    if (state.ok !== true) return;
    if (!skuValue) return;
    if (!selectedLocationId) return;
    if (reason === "order" && !selectedShipmentId) return;
    if (!quantityInputRef.current) return;

    autoScrollRef.current = true;

    quantityInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    quantityInputRef.current.focus();
  }, [state.ok, skuValue, selectedLocationId, selectedShipmentId, reason]);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3 rounded-md border px-3 py-3 text-sm">
        <input type="hidden" name="shipment_id" value={shipmentId || ""} />
        <div className="space-y-1 text-sm">
          <label htmlFor="sku" className="font-medium">
            SKU
          </label>
          <input
            id="sku"
            name="sku"
            type="text"
            required
            value={skuValue}
            onChange={(e) => setSkuValue(e.target.value)}
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
            value={skuVarValue}
            onChange={(e) => setSkuVarValue(e.target.value)}
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

          {/* Desktop table */}
          <div className="hidden max-h-64 overflow-auto md:block">
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
                      <input
                        type="radio"
                        name="deduct_location_id"
                        value={row.location_id}
                        className="h-3 w-3"
                        checked={selectedLocationId === row.location_id}
                        onChange={() => setSelectedLocationId(row.location_id)}
                      />
                    </td>
                    <td className="py-1 pr-2 text-[11px]">{row.warehouse_name}</td>
                    <td className="py-1 pr-2 font-mono text-[11px]">{row.location_code}</td>
                    <td className="py-1 pr-2 text-right text-[11px]">{row.quantity_cases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked list */}
          <div className="space-y-1 md:hidden">
            {state.rows.map((row) => {
              const isSelected = selectedLocationId === row.location_id;

              return (
                <button
                  key={row.location_id}
                  type="button"
                  onClick={() => setSelectedLocationId(row.location_id)}
                  className={`flex w-full items-center justify-between rounded-md border px-2 py-2 text-[11px] shadow-sm transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "bg-white"
                  }`}
                >
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    {row.location_code}
                    {isSelected && <span className="text-emerald-600">✓</span>}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{row.quantity_cases} cases</span>
                </button>
              );
            })}
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
                        <th className="py-1 pr-2 text-right">Cases remaining to pick</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.shipments.map((s) => (
                        <tr key={s.id} className="border-b last:border-none">
                          <td className="py-1 pr-2 text-right align-top">
                            <input
                              type="radio"
                              name="deduct_shipment_id"
                              value={s.id}
                              className="h-3 w-3"
                              checked={selectedShipmentId === s.id}
                              onChange={() => setSelectedShipmentId(s.id)}
                            />
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
                  ref={quantityInputRef}
                  id="deduct_quantity"
                  name="deduct_quantity"
                  type="number"
                  min={0}
                  step={1}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1 text-xs">
                <label className="font-medium">Unit</label>
                <div className="w-full rounded-md border border-input bg-muted px-2 py-1 text-xs shadow-sm">
                  Cases
                </div>
                <input type="hidden" id="deduct_unit" name="deduct_unit" value="cases" />
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
