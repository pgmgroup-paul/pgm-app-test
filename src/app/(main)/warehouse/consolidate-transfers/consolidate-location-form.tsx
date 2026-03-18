"use client";

import { useActionState, useEffect, useRef, useState } from "react";

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

  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [sourceLocationValue, setSourceLocationValue] = useState("");
  const [destLocationValue, setDestLocationValue] = useState("");
  const [moveQuantityValue, setMoveQuantityValue] = useState("");

  const formRef = useRef<HTMLFormElement | null>(null);

  const destLocationRef = useRef<HTMLInputElement | null>(null);
  const moveQuantityRef = useRef<HTMLInputElement | null>(null);
  const autoScrollDestRef = useRef(false);

  const submitLocation = () => {
    if (!formRef.current) return;
    formRef.current.requestSubmit();
  };

  // After SKU selection on mobile, scroll destination location into view and focus once
  useEffect(() => {
    if (autoScrollDestRef.current) return;
    if (typeof window === "undefined") return;

    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    if (!selectedProductId) return;
    if (!destLocationRef.current) return;

    autoScrollDestRef.current = true;

    destLocationRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    destLocationRef.current.focus();
  }, [selectedProductId]);

  return (
    <div className="max-w-xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Consolidate</h1>
        <p className="text-muted-foreground text-sm">Move product from one location to another.</p>
      </div>

      <form ref={formRef} action={formAction} className="space-y-3 rounded-md border px-3 py-3 text-sm">
        {/* Source warehouse is handled internally via default; no user input required */}
        <input type="hidden" name="source_warehouse" value={warehouses?.[0]?.name ?? ""} />

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
            value={sourceLocationValue}
            onChange={(e) => setSourceLocationValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitLocation();
              }
            }}
          />
          <p className="text-[11px] text-muted-foreground">Shows all SKUs currently stored at this location.</p>
        </div>

        {state.ok === false && state.error && <p className="mt-2 text-destructive text-xs">{state.error}</p>}

        {state.ok === true && state.message && <p className="mt-2 text-emerald-700 text-xs">{state.message}</p>}
      </form>

      {state.ok === true && state.rows && state.rows.length > 0 && (
        <form
          action={moveAction}
          className="space-y-2 rounded-md border px-3 py-2 pb-16 text-xs md:pb-2"
          onSubmit={(e) => {
            setMoveError(null);

            const formEl = e.currentTarget;
            const fd = new FormData(formEl);

            const quantityRaw = (fd.get("move_quantity") || "").toString().trim();
            const quantity = Number(quantityRaw);

            if (!Number.isFinite(quantity) || quantity <= 0) {
              // Let backend handle non-positive / invalid numbers
              return;
            }

            if (!selectedProductId) {
              // Let backend handle missing selection
              return;
            }

            const row = state.rows?.find((r) => r.product_id === selectedProductId);
            const available = row ? Number(row.quantity_cases) || 0 : 0;

            if (quantity > available) {
              e.preventDefault();
              setMoveError("Cannot move more than available cases");
            }
          }}
        >
          <p className="mb-1 font-medium">
            Location contents
            {state.sourceLocation && (
              <span className="font-normal text-muted-foreground"> on {state.sourceLocation}</span>
            )}
          </p>

          {/* carry source context from load action into move action */}
          <input type="hidden" name="source_warehouse" value={state.sourceWarehouse || ""} />
          <input type="hidden" name="source_location" value={state.sourceLocation || ""} />
          <input type="hidden" name="source_product_id" value={selectedProductId || ""} />
          {/* Desktop table */}
          <div className="hidden max-h-64 overflow-auto md:block">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b text-[11px] text-muted-foreground">
                <tr>
                  <th className="w-6 py-1 pr-2" />
                  <th className="py-1 pr-2">SKU</th>
                  <th className="py-1 pr-2">Variant</th>
                  <th className="py-1 pr-2">Product</th>
                  <th className="py-1 pr-2 text-right font-semibold text-foreground">Available</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row) => {
                  const isSelected = selectedProductId === row.product_id;

                  return (
                    <tr
                      key={row.product_id}
                      className={`cursor-pointer border-b last:border-none ${isSelected ? "bg-primary/5" : ""}`}
                      onClick={() => setSelectedProductId(row.product_id)}
                    >
                      <td className="py-1 pr-2 align-top">
                        {isSelected && <span className="text-emerald-600">✓</span>}
                      </td>
                      <td className="py-1 pr-2 font-mono text-[11px]">{row.sku}</td>
                      <td className="py-1 pr-2 text-[11px]">{row.sku_var}</td>
                      <td className="py-1 pr-2 text-[11px]">{row.product_name}</td>
                      <td className="py-1 pr-2 text-right font-semibold text-[11px] text-foreground">
                        {row.quantity_cases}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-2 space-y-2 md:hidden">
            {state.rows.map((row) => {
              const isSelected = selectedProductId === row.product_id;

              return (
                <button
                  key={row.product_id}
                  type="button"
                  onClick={() => setSelectedProductId(row.product_id)}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-[11px] shadow-sm transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "bg-white"
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="font-mono text-[11px]">{row.sku}</div>
                    <div className="text-[11px] text-muted-foreground">{row.product_name}</div>
                    <div className="font-semibold text-[11px] text-foreground">
                      Available: {row.quantity_cases} cases
                    </div>
                  </div>
                  {isSelected && <span className="text-emerald-600 text-xs">✓</span>}
                </button>
              );
            })}
          </div>

          <div className="mt-2 space-y-2 border-t pt-2">
            <p className="font-medium">Move selected SKU</p>

            {/* Destination warehouse is handled internally via default; no user input required */}
            <input type="hidden" name="dest_warehouse" value={warehouses?.[0]?.name ?? ""} />

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1 text-xs">
                <label htmlFor="dest_location" className="font-medium">
                  Destination location
                </label>
                <input
                  ref={destLocationRef}
                  id="dest_location"
                  name="dest_location"
                  type="text"
                  placeholder="e.g. B5, C20"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={destLocationValue}
                  onChange={(e) => setDestLocationValue(e.target.value)}
                  onBlur={() => {
                    if (typeof window === "undefined") return;
                    if (window.innerWidth >= 768) return;
                    if (moveQuantityRef.current) {
                      moveQuantityRef.current.focus();
                    }
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  Location will be auto-created at the destination warehouse if it does not exist.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1 text-xs">
                <label htmlFor="move_quantity" className="font-medium">
                  Quantity to move
                </label>
                <input
                  ref={moveQuantityRef}
                  id="move_quantity"
                  name="move_quantity"
                  type="number"
                  min={0}
                  step={1}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={moveQuantityValue}
                  onChange={(e) => setMoveQuantityValue(e.target.value)}
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
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="pallets">Pallets</option>
                  <option value="cases">Cases</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="fixed right-0 bottom-0 left-0 z-10 inline-flex w-full items-center justify-center bg-primary px-4 py-3 font-semibold text-[13px] text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 md:static md:w-auto md:rounded-md md:px-3 md:py-2 md:font-medium md:text-[12px]"
              disabled={!selectedProductId || !destLocationValue.trim() || !moveQuantityValue.trim()}
            >
              Move inventory
            </button>

            {moveError && <p className="text-destructive text-xs">{moveError}</p>}

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
