"use client";

import { useActionState, useState } from "react";

import { loadMovementsBySku, type MovementRow, type MovementsState } from "./movements-load";
import { loadRecentMovements, type RecentMovementsState } from "./load-recent";

export function MovementsShell() {
  const [activeTab, setActiveTab] = useState<"sku" | "recent">("sku");

  const [state, action] = useActionState<MovementsState, FormData>(loadMovementsBySku, {
    ok: null,
  });
  const [recentState, recentAction] = useActionState<RecentMovementsState, FormData>(loadRecentMovements, {
    ok: null,
  });
  const [showFilters, setShowFilters] = useState(false);

  const mobileGroups: { key: string; label: string; rows: MovementRow[] }[] =
    state.ok === true && state.rows
      ? state.rows.reduce<Array<{ key: string; label: string; rows: MovementRow[] }>>((groups, row) => {
          const d = new Date(row.created_at);
          const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
          const label = d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });

          const existing = groups.find((g) => g.key === key);
          if (existing) {
            existing.rows.push(row);
          } else {
            groups.push({ key, label, rows: [row] });
          }

          return groups;
        }, [])
      : [];

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
          onClick={() => setActiveTab("recent")}
          className={`rounded-sm px-3 py-1.5 font-medium transition-colors ${
            activeTab === "recent" ? "bg-background text-foreground" : "text-muted-foreground"
          }`}
        >
          Recent activity
        </button>
      </div>

      {/* Search by SKU tab */}
      {activeTab === "sku" && (
        <>
          <button
            type="button"
            className="inline-flex items-center rounded-md border px-3 py-1 font-medium text-xs md:hidden"
            onClick={() => setShowFilters((prev) => !prev)}
          >
            Filters
          </button>

          <form
            action={action}
            className={`space-y-3 rounded-md border px-3 py-3 text-sm ${showFilters ? "" : "hidden md:block"}`}
          >
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
          Load history
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

      {activeTab === "sku" && state.ok === true && state.rows && state.rows.length > 0 && (
        <div className="rounded-md border px-3 py-2 text-xs">
          <p className="mb-1 font-medium">Movement history</p>
          <div className="max-h-80 overflow-auto">
            {/* Desktop table */}
            <table className="hidden w-full text-left text-[11px] md:table">
              <thead className="border-b text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">Type</th>
                  <th className="py-1 pr-2">Movement</th>
                  <th className="py-1 pr-2 text-right">Qty (cases)</th>
                  <th className="py-1 pr-2">Location</th>
                  <th className="py-1 pr-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row) => {
                  const dateStr = new Date(row.created_at).toLocaleString();

                  let movementDesc = "";
                  let locationDesc = "";

                  if (row.movement_type === "add") {
                    movementDesc = row.source_type
                      ? `Add from ${row.source_type}${row.source_ref ? ` (${row.source_ref})` : ""}`
                      : "Add";
                    locationDesc = row.to_location_code || "";
                  } else if (row.movement_type === "deduct") {
                    if (row.reason === "order" && (row.shipment_label || row.order_number)) {
                      movementDesc = `Deduct (order ${row.shipment_label || row.order_number})`;
                    } else {
                      movementDesc = row.reason
                        ? `Deduct (${row.reason}${row.source_ref ? ` ${row.source_ref}` : ""})`
                        : "Deduct";
                    }
                    locationDesc = row.from_location_code || "";
                  } else if (row.movement_type === "consolidate") {
                    movementDesc = "Consolidate";
                    locationDesc = `${row.from_location_code || "?"} to ${row.to_location_code || "?"}`;
                  } else if (row.movement_type === "transfer") {
                    movementDesc = "Transfer";
                    locationDesc = `${row.from_location_code || "?"} to ${row.to_location_code || "?"}`;
                  } else if (row.movement_type === "undo_deduct") {
                    movementDesc = "Undo deduct";
                    locationDesc = row.to_location_code || "";
                  } else if (row.movement_type === "undo_add") {
                    movementDesc = "Undo add";
                    locationDesc = row.from_location_code || "";
                  } else {
                    movementDesc = row.movement_type;
                    locationDesc = row.from_location_code || row.to_location_code || "";
                  }

                  return (
                    <tr key={row.id} className="border-b last:border-none">
                      <td className="py-1 pr-2 text-[10px] text-muted-foreground">{dateStr}</td>
                      <td className="py-1 pr-2 text-[11px]">{row.movement_type}</td>
                      <td className="py-1 pr-2 text-[11px]">{movementDesc}</td>
                      <td className="py-1 pr-2 text-right text-[11px]">{row.quantity_cases}</td>
                      <td className="py-1 pr-2 text-[11px]">{locationDesc}</td>
                      <td className="py-1 pr-2 text-[10px] text-muted-foreground align-top max-w-xs break-words">
                        {row.note && row.note.trim().length > 0 ? row.note : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="space-y-2 py-2 md:hidden">
              {mobileGroups.map((group) => (
                <div key={group.key} className="space-y-1">
                  <div className="sticky top-0 z-10 bg-background py-1 font-semibold text-[11px] text-muted-foreground">
                    {group.label}
                  </div>

                  {group.rows.map((row) => {
                    const dateStr = new Date(row.created_at).toLocaleTimeString();

                    const skuLabel = state.skuVar ? `${state.sku} / ${state.skuVar}` : state.sku;
                    const productLabel = state.productName || "";

                    let movementDesc = "";
                    let locationDesc = "";

                    if (row.movement_type === "add") {
                      movementDesc = row.source_type
                        ? `Add from ${row.source_type}${row.source_ref ? ` (${row.source_ref})` : ""}`
                        : "Add";
                      locationDesc = row.to_location_code || "";
                    } else if (row.movement_type === "deduct") {
                      if (row.reason === "order" && (row.shipment_label || row.order_number)) {
                        movementDesc = `Deduct (order ${row.shipment_label || row.order_number})`;
                      } else {
                        movementDesc = row.reason
                          ? `Deduct (${row.reason}${row.source_ref ? ` ${row.source_ref}` : ""})`
                          : "Deduct";
                      }
                      locationDesc = row.from_location_code || "";
                    } else if (row.movement_type === "consolidate") {
                      movementDesc = "Consolidate";
                      locationDesc = `${row.from_location_code || "?"} to ${row.to_location_code || "?"}`;
                    } else if (row.movement_type === "transfer") {
                      movementDesc = "Transfer";
                      locationDesc = `${row.from_location_code || "?"} to ${row.to_location_code || "?"}`;
                    } else if (row.movement_type === "undo_deduct") {
                      movementDesc = "Undo deduct";
                      locationDesc = row.to_location_code || "";
                    } else if (row.movement_type === "undo_add") {
                      movementDesc = "Undo add";
                      locationDesc = row.from_location_code || "";
                    } else {
                      movementDesc = row.movement_type;
                      locationDesc = row.from_location_code || row.to_location_code || "";
                    }

                    const typeColorClass =
                      row.movement_type === "add"
                        ? "text-emerald-600"
                        : row.movement_type === "deduct"
                          ? "text-red-600"
                          : "text-blue-600";

                    return (
                      <div key={row.id} className="w-full rounded-md border bg-white px-3 py-2 text-[11px] shadow-sm">
                        {/* SKU + Name */}
                        <div className="flex flex-col gap-0.5">
                          {skuLabel && (
                            <button
                              type="button"
                              className="w-fit font-mono font-semibold text-[11px] text-primary underline-offset-2 hover:underline"
                              onClick={() => {
                                if (!state.sku) return;
                                window.location.href = `/warehouse/search?sku=${encodeURIComponent(state.sku)}`;
                              }}
                            >
                              {skuLabel}
                            </button>
                          )}
                          {productLabel && <span className="text-[11px] text-muted-foreground">{productLabel}</span>}
                        </div>

                        {/* Qty + Type */}
                        <div className="mt-1 flex items-center justify-between">
                          <span className="font-semibold text-[12px] text-foreground">
                            Qty: {row.quantity_cases} cases
                          </span>
                          <span className={`font-semibold text-[11px] uppercase ${typeColorClass}`}>
                            {row.movement_type}
                          </span>
                        </div>

                        {/* Movement description */}
                        <div className="mt-1 text-[11px] text-muted-foreground">{movementDesc}</div>

                        {/* Notes (if present) */}
                        {row.note && row.note.trim().length > 0 && (
                          <div className="mt-1 text-[11px] text-muted-foreground break-words">
                            <span className="font-medium">Note:</span> {row.note}
                          </div>
                        )}

                        {/* Location + Source */}
                        <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                          <span>{dateStr}</span>
                          {locationDesc && (
                            <button
                              type="button"
                              className="w-fit text-left text-[10px] text-primary underline-offset-2 hover:underline"
                              onClick={() => {
                                window.location.href = `/warehouse/search?location=${encodeURIComponent(locationDesc)}`;
                              }}
                            >
                              Location: {locationDesc}
                            </button>
                          )}
                          {row.source_type && (
                            <span>
                              Source: {row.source_type}
                              {row.source_ref && <span> ({row.source_ref})</span>}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "sku" && state.ok === true && (!state.rows || state.rows.length === 0) && (
        <p className="text-muted-foreground text-xs">No movements found for this product yet.</p>
      )}
      </>
      )}

      {/* Recent Activity tab */}
      {activeTab === "recent" && (
        <div className="space-y-3">
          <form action={recentAction} className="space-y-2 text-xs">
            <button
              type="submit"
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs hover:bg-primary/90"
            >
              Load recent activity
            </button>
            {recentState.ok === false && recentState.error && (
              <p className="mt-1 text-destructive text-[11px]">{recentState.error}</p>
            )}
          </form>

          {recentState.ok === true && recentState.rows && recentState.rows.length > 0 && (
            <div className="rounded-md border px-3 py-2 text-xs">
              <p className="mb-1 font-medium">Recent inventory movements</p>

              {/* Desktop table */}
              <div className="hidden max-h-80 overflow-auto md:block">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b text-[11px] text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2">Date</th>
                      <th className="py-1 pr-2">SKU</th>
                      <th className="py-1 pr-2">Product</th>
                      <th className="py-1 pr-2">Type</th>
                      <th className="py-1 pr-2">Notes</th>
                      <th className="py-1 pr-2 text-right">Qty (cases)</th>
                      <th className="py-1 pr-2">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentState.rows.map((row) => (
                      <tr key={row.id} className="border-b last:border-none">
                        <td className="py-1 pr-2 text-[10px] text-muted-foreground">
                          {new Date(row.created_at).toLocaleString()}
                        </td>
                        <td className="py-1 pr-2 font-mono text-[11px]">{row.sku ?? "-"}</td>
                        <td className="py-1 pr-2 text-[11px]">{row.product_name ?? ""}</td>
                        <td className="py-1 pr-2 text-[11px]">{row.movement_type}</td>
                        <td className="py-1 pr-2 text-[10px] text-muted-foreground max-w-xs break-words">
                          {row.note && row.note.trim().length > 0 ? row.note : "—"}
                        </td>
                        <td className="py-1 pr-2 text-right text-[11px]">{row.quantity_cases}</td>
                        <td className="py-1 pr-2 text-[11px]">{row.location_code ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 py-2 md:hidden">
                {recentState.rows.map((row) => (
                  <div key={row.id} className="w-full rounded-md border bg-white px-3 py-2 text-[11px] shadow-sm">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{new Date(row.created_at).toLocaleString()}</span>
                      <span className="font-mono">{row.sku ?? "-"}</span>
                    </div>
                    {row.product_name && (
                      <div className="mt-1 text-[11px] text-muted-foreground">{row.product_name}</div>
                    )}
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-semibold text-foreground">{row.movement_type}</span>
                    </div>
                    {row.note && row.note.trim().length > 0 && (
                      <div className="mt-1 text-[11px] text-muted-foreground break-words">
                        <span className="font-medium">Note:</span> {row.note}
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-muted-foreground">Qty (cases)</span>
                      <span className="font-semibold text-foreground">{row.quantity_cases}</span>
                    </div>
                    {row.location_code && (
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-muted-foreground">Location</span>
                        <span className="font-mono text-foreground">{row.location_code}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentState.ok === true && (!recentState.rows || recentState.rows.length === 0) && (
            <p className="text-muted-foreground text-xs">No recent inventory movements found.</p>
          )}
        </div>
      )}
    </div>
  );
}
