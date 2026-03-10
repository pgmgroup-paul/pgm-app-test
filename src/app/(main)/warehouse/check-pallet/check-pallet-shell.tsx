"use client";

import { useActionState } from "react";

import { type CheckPalletState, loadPalletConfig } from "./check-pallet-load";

export function CheckPalletShell() {
  const [state, action] = useActionState<CheckPalletState, FormData>(loadPalletConfig, {
    ok: null,
  });

  return (
    <div className="space-y-4">
      {/* SKU lookup */}
      <form action={action} className="space-y-3 rounded-md border px-3 py-3 text-sm">
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
          Load pallet
        </button>

        {state.ok === false && state.error && <p className="mt-2 text-destructive text-xs">{state.error}</p>}

        {state.ok === true && state.productName && (
          <p className="mt-2 text-emerald-700 text-xs">
            Product: <span className="font-semibold">{state.productName}</span>{" "}
            {state.sku && (
              <span className="text-[11px] text-muted-foreground">
                SKU: <span className="font-mono">{state.sku}</span>
                {state.skuVar && <span> / {state.skuVar}</span>}
              </span>
            )}
          </p>
        )}
      </form>

      {/* Pallet configuration summary */}
      {state.ok === true && state.productId && (
        <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
          <p className="font-medium">Pallet configuration</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Cartons per layer</div>
              <div className="text-[11px]">{state.cartonsPerLayer != null ? state.cartonsPerLayer : "-"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Number of layers</div>
              <div className="text-[11px]">{state.numberOfLayers != null ? state.numberOfLayers : "-"}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Cartons per pallet</div>
              <div className="text-[11px]">{state.cartonsPerPallet != null ? state.cartonsPerPallet : "-"}</div>
            </div>
          </div>

          <p className="mt-1 text-[10px] text-muted-foreground">
            Cartons per pallet is taken from the pallet configuration if present, otherwise it is calculated as cartons
            per layer × number of layers.
          </p>
        </div>
      )}
    </div>
  );
}
