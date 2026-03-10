"use client";

import { useActionState } from "react";

import { loadMovementsBySku, type MovementsState } from "./movements-load";

export function MovementsShell() {
  const [state, action] = useActionState<MovementsState, FormData>(loadMovementsBySku, {
    ok: null,
  });

  return (
    <div className="space-y-4">
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

      {state.ok === true && state.rows && state.rows.length > 0 && (
        <div className="rounded-md border px-3 py-2 text-xs">
          <p className="mb-1 font-medium">Movement history</p>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">Type</th>
                  <th className="py-1 pr-2">Movement</th>
                  <th className="py-1 pr-2 text-right">Qty (cases)</th>
                  <th className="py-1 pr-2">Location</th>
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
                    if (row.reason === "order" && row.order_number) {
                      movementDesc = `Deduct (order ${row.order_number})`;
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {state.ok === true && (!state.rows || state.rows.length === 0) && (
        <p className="text-muted-foreground text-xs">No movements found for this product yet.</p>
      )}
    </div>
  );
}
