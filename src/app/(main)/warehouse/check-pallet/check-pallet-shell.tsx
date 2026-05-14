"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { FuzzyProductSearch } from "../../sales-shipments/FuzzyProductSearch";
import { type CheckPalletState, loadPalletConfig } from "./check-pallet-load";

export function CheckPalletShell() {
  const [state, action] = useActionState<CheckPalletState, FormData>(loadPalletConfig, {
    ok: null,
  });

  const [skuValue, setSkuValue] = useState("");
  const [skuVarValue, setSkuVarValue] = useState("");

  const formRef = useRef<HTMLFormElement | null>(null);
  const skuInputRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;
    if (!skuInputRef.current) return;
    skuInputRef.current.focus();
  }, []);

  // After a result, scroll into view on mobile and reset flow on success
  useEffect(() => {
    if (state.ok === null) return;
    if (typeof window === "undefined") return;
    const isMobile = window.innerWidth < 768;

    if (isMobile && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (state.ok === true) {
      setSkuValue("");
      setSkuVarValue("");
      if (skuInputRef.current) {
        skuInputRef.current.focus();
      }
    }
  }, [state.ok]);

  return (
    <div className="space-y-4">
      {/* SKU lookup */}
      <form ref={formRef} action={action} className="space-y-3 rounded-md border px-3 py-3 text-sm">
        <FuzzyProductSearch />
        <div className="space-y-1 text-sm">
          <label htmlFor="sku" className="font-medium">
            SKU
          </label>
          <input
            ref={skuInputRef}
            id="sku"
            name="sku"
            type="text"
            required
            placeholder="Scan or enter SKU"
            value={skuValue}
            onChange={(e) => setSkuValue(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-3 text-base shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (formRef.current) {
                  formRef.current.requestSubmit();
                }
              }
            }}
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
          Load pallet
        </button>

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

      <div ref={resultRef} className="space-y-2">
        {state.ok === false && state.error && (
          <div className="space-y-2 text-xs">
            <p className="text-destructive">✗ {state.error}</p>

            {state.error === "No pallet configuration found for this product" && state.sku && (
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-xs hover:bg-primary/90"
                onClick={() => {
                  window.location.href = `/warehouse/dimensions?sku=${encodeURIComponent(state.sku ?? "")}&from=check-pallet`;
                }}
              >
                Enter pallet configuration
              </button>
            )}
          </div>
        )}

        {state.ok === true && state.productId && (
          <div className="space-y-3 rounded-md border px-3 py-3 text-xs">
            <p className="font-medium">Pallet configuration</p>

            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">SKU</span>
                <span className="font-mono font-semibold text-foreground">
                  {state.sku}
                  {state.skuVar && <span> / {state.skuVar}</span>}
                </span>
              </div>
              {state.productName && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Product</span>
                  <span className="font-semibold text-foreground">{state.productName}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cartons per layer</span>
                <span className="font-semibold text-foreground">
                  {state.cartonsPerLayer != null ? state.cartonsPerLayer : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Layers</span>
                <span className="font-semibold text-foreground">
                  {state.numberOfLayers != null ? state.numberOfLayers : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cartons per pallet</span>
                <span className="font-semibold text-foreground">
                  {state.cartonsPerPallet != null ? state.cartonsPerPallet : "-"}
                </span>
              </div>
            </div>

            <p className="mt-1 text-[10px] text-muted-foreground">
              Cartons per pallet is taken from the pallet configuration if present, otherwise it is calculated as
              cartons per layer × number of layers.
            </p>
          </div>
        )}

        {state.ok === true && !state.error && state.productId && (
          <p className="text-[11px] text-emerald-700">✓ Pallet configuration is valid</p>
        )}
      </div>
    </div>
  );
}
