"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import { FuzzyProductSearch } from "../../sales-shipments/FuzzyProductSearch";
import { type DimensionsState, loadDimensions } from "./dimensions-load";
import { type SaveDimensionsState, saveDimensions } from "./dimensions-save";

interface DimensionsShellProps {
  initialSku?: string;
  initialVariant?: string;
  from?: string;
}

export function DimensionsShell({ initialSku, initialVariant, from }: DimensionsShellProps) {
  const [loadState, loadAction] = useActionState<DimensionsState, FormData>(loadDimensions, {
    ok: null,
  });

  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);

  // If we arrive with ?sku=&variant= in the URL, auto-load that product once
  useEffect(() => {
    if (!initialSku || hasAutoLoaded || loadState.ok !== null) return;

    startTransition(() => {
      const fd = new FormData();
      fd.append("sku", initialSku);
      if (initialVariant) {
        fd.append("sku_var", initialVariant);
      }
      loadAction(fd);
      setHasAutoLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSku, initialVariant, hasAutoLoaded, loadState.ok, loadAction]);

  const [saveState, saveAction] = useActionState<SaveDimensionsState, FormData>(saveDimensions, {
    ok: null,
  });

  const cartonsPerLayerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (from !== "pallet-config" && from !== "check-pallet") return;
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;
    if (!cartonsPerLayerRef.current) return;

    // Scroll into view and focus once dims are loaded
    if (loadState.ok === true && loadState.productId) {
      cartonsPerLayerRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      cartonsPerLayerRef.current.focus();
    }
  }, [from, loadState.ok, loadState.productId]);

  return (
    <div className="space-y-4">
      {/* SKU lookup */}
      <form action={loadAction} className="space-y-3 rounded-md border px-3 py-3 text-sm">
        <FuzzyProductSearch />
        <div className="space-y-1 text-sm">
          <label htmlFor="sku" className="font-medium">
            SKU
          </label>
          <input
            id="sku"
            name="sku"
            type="text"
            required
            defaultValue={initialSku ?? ""}
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
            defaultValue={initialVariant ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-xs hover:bg-primary/90"
        >
          Load dims
        </button>

        {loadState.ok === false && loadState.error && (
          <p className="mt-2 text-destructive text-xs">{loadState.error}</p>
        )}

        {loadState.ok === true && loadState.productName && (
          <p className="mt-2 text-emerald-700 text-xs">
            Product: <span className="font-semibold">{loadState.productName}</span>{" "}
            {loadState.sku && (
              <span className="text-[11px] text-muted-foreground">
                SKU: <span className="font-mono">{loadState.sku}</span>
                {loadState.skuVar && <span> / {loadState.skuVar}</span>}
              </span>
            )}
          </p>
        )}
      </form>

      {/* Dimensions form */}
      {loadState.ok === true && loadState.productId && (
        <form action={saveAction} className="space-y-4 rounded-md border px-3 py-3 text-xs">
          <input type="hidden" name="product_id" value={loadState.productId || ""} />

          {/* Case dimensions */}
          <div className="space-y-2">
            <p className="font-medium">Case dimensions</p>
            <p className="text-[10px] text-muted-foreground">
              All dimensions are in inches (in) and weight in pounds (lb).
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="case_length" className="font-medium">
                  Length
                </label>
                <input
                  id="case_length"
                  name="case_length"
                  type="number"
                  step="any"
                  defaultValue={loadState.caseDims?.length ?? ""}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="case_width" className="font-medium">
                  Width
                </label>
                <input
                  id="case_width"
                  name="case_width"
                  type="number"
                  step="any"
                  defaultValue={loadState.caseDims?.width ?? ""}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="case_height" className="font-medium">
                  Height
                </label>
                <input
                  id="case_height"
                  name="case_height"
                  type="number"
                  step="any"
                  defaultValue={loadState.caseDims?.height ?? ""}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="case_weight" className="font-medium">
                  Weight
                </label>
                <input
                  id="case_weight"
                  name="case_weight"
                  type="number"
                  step="any"
                  defaultValue={loadState.caseDims?.weight ?? ""}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="case_units_per" className="font-medium">
                  Units per case
                </label>
                <input
                  id="case_units_per"
                  name="case_units_per"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={loadState.caseDims?.units_per ?? ""}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Pallet dimensions */}
          <div className="space-y-2">
            <p className="font-medium">Pallet dimensions</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="pallet_length" className="font-medium">
                  Length
                </label>
                <input
                  id="pallet_length"
                  name="pallet_length"
                  type="number"
                  step="any"
                  defaultValue={loadState.palletDims?.length ?? ""}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="pallet_width" className="font-medium">
                  Width
                </label>
                <input
                  id="pallet_width"
                  name="pallet_width"
                  type="number"
                  step="any"
                  defaultValue={loadState.palletDims?.width ?? ""}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="pallet_height" className="font-medium">
                  Height
                </label>
                <input
                  id="pallet_height"
                  name="pallet_height"
                  type="number"
                  step="any"
                  defaultValue={loadState.palletDims?.height ?? ""}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="pallet_weight" className="font-medium">
                  Weight (calculated)
                </label>
                <input
                  id="pallet_weight"
                  name="pallet_weight"
                  type="number"
                  readOnly
                  value={(loadState.palletDims?.cartons_per_pallet || 0) * (loadState.caseDims?.weight || 0) + 50}
                  className="w-full rounded-md border border-input bg-muted px-2 py-1 text-xs shadow-sm outline-none"
                />
                <p className="text-[10px] text-muted-foreground">
                  Cartons per pallet × case weight + 50 lb for pallet.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="pallet_cartons_per_layer" className="font-medium">
                  Cartons per layer
                </label>
                <input
                  ref={cartonsPerLayerRef}
                  id="pallet_cartons_per_layer"
                  name="pallet_cartons_per_layer"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={loadState.palletDims?.cartons_per_layer ?? ""}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="pallet_number_of_layers" className="font-medium">
                  Number of layers
                </label>
                <input
                  id="pallet_number_of_layers"
                  name="pallet_number_of_layers"
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={loadState.palletDims?.number_of_layers ?? ""}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium">Cartons per pallet (calculated)</label>
                <input
                  type="number"
                  readOnly
                  value={(loadState.palletDims?.cartons_per_layer || 0) * (loadState.palletDims?.number_of_layers || 0)}
                  className="w-full rounded-md border border-input bg-muted px-2 py-1 text-xs shadow-sm outline-none"
                />
                <p className="text-[10px] text-muted-foreground">
                  Used by Add/Deduct pages to convert pallets to cases.
                </p>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
          >
            Save dimensions
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
