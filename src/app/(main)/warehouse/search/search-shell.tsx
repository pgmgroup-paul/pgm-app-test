"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { FuzzyProductSearch } from "../../sales-shipments/FuzzyProductSearch";
import { loadSearchByLocation, type SearchLocationState } from "./search-location-load";
import { loadSearchBySku, type SearchSkuState } from "./search-sku-load";

export function WarehouseSearchShell() {
  const [activeTab, setActiveTab] = useState<"sku" | "location">("sku");

  const [skuState, skuAction] = useActionState<SearchSkuState, FormData>(loadSearchBySku, { ok: null });

  const skuFormRef = useRef<HTMLFormElement | null>(null);
  const skuInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;
    if (activeTab !== "sku") return;
    if (!skuInputRef.current) return;

    skuInputRef.current.focus();
  }, [activeTab]);

  const [locState, locAction] = useActionState<SearchLocationState, FormData>(loadSearchByLocation, { ok: null });

  const sortedSkuRows = skuState.rows
    ? [...skuState.rows].sort((a, b) => (b.quantity_cases || 0) - (a.quantity_cases || 0))
    : undefined;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="inline-flex rounded-md border bg-muted p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("sku")}
          className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
            activeTab === "sku" ? "bg-background text-foreground" : "text-muted-foreground"
          }`}
        >
          Search by SKU
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("location")}
          className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
            activeTab === "location" ? "bg-background text-foreground" : "text-muted-foreground"
          }`}
        >
          Location contents
        </button>
      </div>

      {/* SKU tab */}
      {activeTab === "sku" && (
        <div className="space-y-3">
          <form ref={skuFormRef} action={skuAction} className="space-y-3 rounded-md border px-3 py-3 text-sm">
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
                placeholder="Search SKU or product name"
                className="w-full rounded-md border border-input bg-background px-3 py-3 text-base shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    // Submit via native form submission
                    if (skuFormRef.current) {
                      skuFormRef.current.requestSubmit();
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
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-xs hover:bg-primary/90"
            >
              Check SKU & load locations
            </button>

            {skuState.ok === false && skuState.error && (
              <p className="mt-2 text-destructive text-xs">{skuState.error}</p>
            )}

            {skuState.ok === true && skuState.productName && (
              <p className="mt-2 text-emerald-700 text-xs">
                Product: <span className="font-semibold">{skuState.productName}</span>{" "}
                {skuState.sku && (
                  <span className="text-[11px] text-muted-foreground">
                    SKU: <span className="font-mono">{skuState.sku}</span>
                    {skuState.skuVar && <span> / {skuState.skuVar}</span>}
                  </span>
                )}
              </p>
            )}
          </form>

          {skuState.ok === true && sortedSkuRows && sortedSkuRows.length > 0 && (
            <div className="rounded-md border px-3 py-2 text-xs">
              <p className="mb-1 font-medium">Locations for this product</p>

              {/* Desktop table */}
              <div className="hidden max-h-64 overflow-auto md:block">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b text-[11px] text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2">Location</th>
                      <th className="py-1 pr-2 text-right">Cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSkuRows?.map((row) => (
                      <tr
                        key={row.location_id}
                        className="cursor-pointer border-b last:border-none hover:bg-muted/40"
                        onClick={() => {
                          if (!skuState.productId) return;
                          window.location.href = `/warehouse/deduct?product_id=${encodeURIComponent(skuState.productId)}&location=${encodeURIComponent(row.location_code)}&reason=search`;
                        }}
                      >
                        <td className="py-1 pr-2 font-mono text-[11px]">{row.location_code}</td>
                        <td className="py-1 pr-2 text-right text-[11px]">{row.quantity_cases}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                <div className="w-full rounded-md border bg-white px-3 py-2 text-[11px] shadow-sm">
                  <div className="font-mono text-[11px]">
                    {skuState.sku}
                    {skuState.skuVar && <span> / {skuState.skuVar}</span>}
                  </div>
                  {skuState.productName && (
                    <div className="text-[11px] text-muted-foreground">{skuState.productName}</div>
                  )}

                  <div className="mt-1 space-y-0.5">
                    {sortedSkuRows?.map((row) => (
                      <button
                        key={row.location_id}
                        type="button"
                        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left hover:bg-muted/60"
                        onClick={() => {
                          if (!skuState.productId) return;
                          window.location.href = `/warehouse/deduct?product_id=${encodeURIComponent(skuState.productId)}&location=${encodeURIComponent(row.location_code)}&reason=search`;
                        }}
                      >
                        <span className="font-mono text-[11px]">{row.location_code}</span>
                        <span className="font-semibold text-foreground">{row.quantity_cases} cases</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {skuState.ok === true && (!skuState.rows || skuState.rows.length === 0) && (
            <p className="text-muted-foreground text-xs">This product has no inventory in any warehouse locations.</p>
          )}
        </div>
      )}

      {/* Location tab */}
      {activeTab === "location" && (
        <div className="space-y-3">
          <form action={locAction} className="space-y-3 rounded-md border px-3 py-3 text-sm">
            <div className="space-y-1 text-sm">
              <label htmlFor="location_code" className="font-medium">
                Location code
              </label>
              <input
                id="location_code"
                name="location_code"
                type="text"
                placeholder="e.g. A2-03-01"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-[10px] text-muted-foreground">
                Codes are normalized (spaces removed, uppercase) before searching.
              </p>
            </div>

            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-xs hover:bg-primary/90"
            >
              Load location contents
            </button>

            {locState.ok === false && locState.error && (
              <p className="mt-2 text-destructive text-xs">{locState.error}</p>
            )}

            {locState.ok === true && locState.normalizedCode && (
              <p className="mt-2 text-emerald-700 text-xs">
                Location: <span className="font-mono">{locState.normalizedCode}</span>
              </p>
            )}
          </form>

          {locState.ok === true && locState.rows && locState.rows.length > 0 && (
            <div className="rounded-md border px-3 py-2 text-xs">
              <p className="mb-1 font-medium">Contents at this location</p>

              {/* Desktop table */}
              <div className="hidden max-h-64 overflow-auto md:block">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b text-[11px] text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2">SKU</th>
                      <th className="py-1 pr-2">Product</th>
                      <th className="py-1 pr-2 text-right">Cases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locState.rows.map((row, idx) => (
                      <tr key={`${row.product_id}-${row.sku}-${idx}`} className="border-b last:border-none">
                        <td className="py-1 pr-2 font-mono text-[11px]">
                          {row.sku}
                          {row.sku_var && <span> / {row.sku_var}</span>}
                        </td>
                        <td className="py-1 pr-2 text-[11px]">{row.product_name}</td>
                        <td className="py-1 pr-2 text-right text-[11px]">{row.quantity_cases}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {locState.rows.map((row, idx) => (
                  <div
                    key={`${row.product_id}-${row.sku}-${idx}`}
                    className="w-full rounded-md border bg-white px-3 py-2 text-[11px] shadow-sm"
                  >
                    <div className="font-mono text-[11px]">
                      {row.sku}
                      {row.sku_var && <span> / {row.sku_var}</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{row.product_name}</div>
                    <div className="mt-1 font-semibold text-[11px] text-foreground">
                      Available: {row.quantity_cases} cases
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {locState.ok === true && locState.rows && locState.rows.length === 0 && (
            <p className="text-muted-foreground text-xs">This location exists but currently has no inventory.</p>
          )}

          {locState.ok === true && !locState.rows && (
            <p className="text-muted-foreground text-xs">No inventory found for this location.</p>
          )}
        </div>
      )}
    </div>
  );
}
