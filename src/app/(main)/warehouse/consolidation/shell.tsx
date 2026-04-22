"use client";

import React, { useActionState, useState } from "react";

import { loadConsolidationBySku, type ConsolidationSkuState } from "./load-sku";
import { loadConsolidationCandidates, type ConsolidationCandidatesState } from "./load-candidates";
import {
  loadConsolidationCandidateDetail,
  type ConsolidationCandidateDetailState,
} from "./load-candidate-detail";

export function ConsolidationShell() {
  const [activeTab, setActiveTab] = useState<"sku" | "candidates">("sku");

  const [skuState, skuAction] = useActionState<ConsolidationSkuState, FormData>(loadConsolidationBySku, {
    ok: null,
  });

  const [candidatesState, candidatesAction] = useActionState<
    ConsolidationCandidatesState,
    FormData
  >(loadConsolidationCandidates, {
    ok: null,
  });

  const [detailState, detailAction] = useActionState<ConsolidationCandidateDetailState, FormData>(
    loadConsolidationCandidateDetail,
    { ok: null },
  );
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

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
          onClick={() => setActiveTab("candidates")}
          className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
            activeTab === "candidates" ? "bg-background text-foreground" : "text-muted-foreground"
          }`}
        >
          Candidates
        </button>
      </div>

      {/* Search by SKU tab */}
      {activeTab === "sku" && (
        <div className="space-y-3">
          <form action={skuAction} className="space-y-3 rounded-md border px-3 py-3 text-sm">
            <div className="space-y-1 text-sm">
              <label htmlFor="sku" className="font-medium">
                SKU
              </label>
              <input
                id="sku"
                name="sku"
                type="text"
                required
                placeholder="Search SKU or product name"
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
              Analyze SKU
            </button>

            {skuState.ok === false && skuState.error && (
              <p className="mt-2 text-destructive text-xs">{skuState.error}</p>
            )}

            {skuState.ok === true && skuState.productName && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Results will show locations for this SKU that may be good consolidation candidates.
              </p>
            )}
          </form>

          {/* Summary card */}
          {skuState.ok === true && skuState.rows && skuState.rows.length > 0 && (
            <div className="rounded-md border px-3 py-3 text-xs">
              <p className="mb-1 font-medium">Summary</p>
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Product:</span>{" "}
                  <span>{skuState.productName}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">SKU:</span>{" "}
                  <span className="font-mono">{skuState.sku}</span>
                  {skuState.skuVar && <span> / {skuState.skuVar}</span>}
                </div>
                <div>
                  <span className="font-medium text-foreground">Cartons per pallet:</span>{" "}
                  <span>{skuState.cartonsPerPallet}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">Small locations:</span>{" "}
                  <span>{skuState.totalSmallLocations}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">Total small cases:</span>{" "}
                  <span>{skuState.totalSmallCases}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">Unused pallet space:</span>{" "}
                  <span>{skuState.totalUnusedPalletSpace}</span>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {skuState.ok === true && skuState.rows && skuState.rows.length > 0 && (
            <div className="w-full max-w-none rounded-md border px-3 py-2 text-xs">
              <p className="mb-1 font-medium">Locations for this product</p>

              {/* Desktop table */}
              <div className="hidden max-h-64 overflow-auto md:block">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b text-[11px] text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2">Location</th>
                      <th className="py-1 pr-2 text-right">Cases</th>
                      <th className="py-1 pr-2 text-right">% Full Pallet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skuState.rows.map((row) => (
                      <tr key={row.location_id} className="border-b last:border-none">
                        <td className="py-1 pr-2 font-mono text-[11px]">{row.location_code}</td>
                        <td className="py-1 pr-2 text-right text-[11px]">{row.quantity_cases}</td>
                        <td className="py-1 pr-2 text-right text-[11px]">
                          {Math.round(row.pallet_fill_percent * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {skuState.rows.map((row) => (
                  <div
                    key={row.location_id}
                    className="w-full rounded-md border bg-white px-3 py-2 text-[11px] shadow-sm"
                  >
                    <div className="font-mono text-[11px]">{row.location_code}</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-muted-foreground">Cases</span>
                      <span className="font-semibold text-foreground">{row.quantity_cases}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-muted-foreground">% Full Pallet</span>
                      <span className="font-semibold text-foreground">
                        {Math.round(row.pallet_fill_percent * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {skuState.ok === true && (!skuState.rows || skuState.rows.length === 0) && (
            <p className="text-muted-foreground text-xs">No consolidation opportunities for this SKU.</p>
          )}
        </div>
      )}

      {/* Candidates tab */}
      {activeTab === "candidates" && (
        <div className="space-y-3">
          <div className="space-y-1 text-sm">
            <p className="text-[11px] text-muted-foreground">
              This tab shows system-generated consolidation opportunities, such as SKUs spread across multiple nearby
              locations.
            </p>
          </div>

          <form action={candidatesAction} className="space-y-2 text-xs">
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs hover:bg-primary/90"
            >
              Load candidates
            </button>
            {candidatesState.ok === false && candidatesState.error && (
              <p className="mt-1 text-destructive text-[11px]">{candidatesState.error}</p>
            )}
          </form>

          {candidatesState.ok === true && candidatesState.rows && candidatesState.rows.length > 0 && (
            <div className="w-full max-w-none rounded-md border px-3 py-2 text-xs">
              <p className="mb-1 font-medium">Consolidation candidates</p>

              {/* Desktop table */}
              <div className="hidden max-h-64 overflow-auto md:block">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b text-[11px] text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2">SKU</th>
                      <th className="py-1 pr-2">Variant</th>
                      <th className="py-1 pr-2">Product</th>
                      <th className="py-1 pr-2 text-right">Small locs</th>
                      <th className="py-1 pr-2 text-right">Cases</th>
                      <th className="py-1 pr-2 text-right">Spaces saved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidatesState.rows.map((row) => {
                      const isExpanded = expandedProductId === row.product_id;
                      const hasDetail =
                        detailState.ok === true &&
                        detailState.productId === row.product_id &&
                        detailState.rows &&
                        detailState.rows.length > 0;

                      return (
                        <React.Fragment key={row.product_id}>
                          <tr
                            className={
                              isExpanded
                                ? "border-b last:border-none bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800"
                                : "border-b last:border-none"
                            }
                          >
                            <td className="py-1 pr-2 text-[11px]">
                              <form
                                action={detailAction}
                                className="inline-flex items-center gap-1"
                                onSubmit={() => {
                                  setExpandedProductId((prev) =>
                                    prev === row.product_id ? null : row.product_id,
                                  );
                                }}
                              >
                                <input type="hidden" name="product_id" value={row.product_id} />
                                <button
                                  type="submit"
                                  className="inline-flex items-center gap-1 text-left hover:text-foreground"
                                >
                                  <span className="text-[10px]">
                                    {isExpanded ? "▾" : "▸"}
                                  </span>
                                  <span className="font-mono text-[11px]">{row.sku}</span>
                                </button>
                              </form>
                            </td>
                            <td className="py-1 pr-2 text-[11px]">{row.sku_var ?? ""}</td>
                            <td className="py-1 pr-2 text-[11px]">{row.product_name ?? ""}</td>
                            <td className="py-1 pr-2 text-right text-[11px]">{row.smallLocationCount}</td>
                            <td className="py-1 pr-2 text-right text-[11px]">{row.totalSmallCases}</td>
                            <td className="py-1 pr-2 text-right text-[11px]">{row.spacesSaved}</td>
                          </tr>
                          {isExpanded && hasDetail && (
                            <tr className="border-b last:border-none">
                              <td colSpan={6} className="py-2 pr-2 pl-6">
                                <div className="max-h-52 overflow-auto rounded-md border bg-background">
                                  <table className="w-full text-left text-[11px]">
                                    <thead className="border-b text-[11px] text-muted-foreground">
                                      <tr>
                                        <th className="py-1 pr-2">Location</th>
                                        <th className="py-1 pr-2 text-right">Cases</th>
                                        <th className="py-1 pr-2 text-right">% Full Pallet</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detailState.rows!.map((loc) => (
                                        <tr key={loc.location_id} className="border-b last:border-none">
                                          <td className="py-1 pr-2 font-mono text-[11px]">{loc.location_code}</td>
                                          <td className="py-1 pr-2 text-right text-[11px]">{loc.quantity_cases}</td>
                                          <td className="py-1 pr-2 text-right text-[11px]">
                                            {Math.round(loc.pallet_fill_percent * 100)}%
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {candidatesState.rows.map((row) => {
                  const isExpanded = expandedProductId === row.product_id;
                  const hasDetail =
                    detailState.ok === true &&
                    detailState.productId === row.product_id &&
                    detailState.rows &&
                    detailState.rows.length > 0;

                  return (
                    <div
                      key={row.product_id}
                      className="w-full rounded-md border bg-white px-3 py-2 text-[11px] shadow-sm"
                    >
                      <form
                        action={detailAction}
                        className="flex items-center justify-between"
                        onSubmit={() => {
                          setExpandedProductId((prev) =>
                            prev === row.product_id ? null : row.product_id,
                          );
                        }}
                      >
                        <input type="hidden" name="product_id" value={row.product_id} />
                        <button
                          type="submit"
                          className="flex w-full items-center justify-between text-left"
                        >
                          <div>
                            <div className="font-mono text-[11px] flex items-center gap-1">
                              <span className="text-[10px]">{isExpanded ? "▾" : "▸"}</span>
                              <span>{row.sku}</span>
                            </div>
                            {row.sku_var && (
                              <div className="text-[11px] text-muted-foreground">Variant: {row.sku_var}</div>
                            )}
                            {row.product_name && (
                              <div className="text-[11px] text-muted-foreground">{row.product_name}</div>
                            )}
                          </div>
                          <div className="ml-2 text-right">
                            <div className="text-[10px] text-muted-foreground">Spaces saved</div>
                            <div className="font-semibold text-foreground">{row.spacesSaved}</div>
                          </div>
                        </button>
                      </form>

                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-muted-foreground">Small locations</span>
                        <span className="font-semibold text-foreground">{row.smallLocationCount}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-muted-foreground">Cases</span>
                        <span className="font-semibold text-foreground">{row.totalSmallCases}</span>
                      </div>

                      {isExpanded && hasDetail && (
                        <div className="mt-2 space-y-1 border-t border-blue-200 bg-blue-50 pt-2 dark:border-blue-800 dark:bg-blue-950/40">
                          {detailState.rows!.map((loc) => (
                            <div
                              key={loc.location_id}
                              className="flex items-center justify-between text-[10px]"
                            >
                              <div className="font-mono">{loc.location_code}</div>
                              <div className="text-right">
                                <div>{loc.quantity_cases} cases</div>
                                <div className="text-muted-foreground">
                                  {Math.round(loc.pallet_fill_percent * 100)}% full
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {candidatesState.ok === true && (!candidatesState.rows || candidatesState.rows.length === 0) && (
            <p className="text-muted-foreground text-xs">No consolidation candidates found.</p>
          )}
        </div>
      )}
    </div>
  );
}
