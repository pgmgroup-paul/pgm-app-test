"use client";

import { useActionState } from "react";

import type { DemandState } from "./actions";

interface DemandShellProps {
  loadDemand: (prev: DemandState, formData: FormData) => Promise<DemandState>;
  initialState: DemandState;
  initialSku?: string | null;
  initialVar?: string | null;
}

export function DemandShell({ loadDemand, initialState, initialSku, initialVar }: DemandShellProps) {
  const [state, formAction] = useActionState<DemandState, FormData>(loadDemand, initialState);

  return (
    <div className="max-w-4xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Demand</h1>
        <p className="text-muted-foreground text-sm">
          Enter a SKU and variant to compare current warehouse stock against demand from open and processing sales
          orders.
        </p>
      </div>

      {/* Product lookup */}
      <form action={formAction} className="space-y-4 rounded-md border px-3 py-3 text-xs">
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="sku" className="font-medium text-[11px]">
                SKU
              </label>
              <input
                id="sku"
                name="sku"
                type="text"
                defaultValue={initialSku ?? ""}
                placeholder="e.g. PG94117"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="sku_var" className="font-medium text-[11px]">
                Variant (optional)
              </label>
              <input
                id="sku_var"
                name="sku_var"
                type="text"
                defaultValue={initialVar ?? ""}
                placeholder="e.g. BLUE, 10oz, Large"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
              >
                Check demand
              </button>
            </div>
          </div>
        </div>

        {state.ok === false && state.error && <p className="text-[11px] text-destructive">{state.error}</p>}

        {state.ok === true && state.productId && (
          <div className="mt-3 space-y-4 border-t pt-3">
            {/* Product confirmation */}
            <div className="flex items-start gap-3 text-[11px]">
              <div>
                <div className="font-medium">
                  Product found: {state.productName} ({state.sku}
                  {state.skuVar ? ` / ${state.skuVar}` : ""})
                </div>
                {state.imageUrl && (
                  <div className="mt-2">
                    <img
                      src={state.imageUrl}
                      alt={state.productName || state.sku || "Product"}
                      className="h-[150px] w-[300px] rounded-md border object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Demand summary */}
            <div className="space-y-1 rounded-md bg-muted px-3 py-2 text-[11px]">
              <div className="font-medium">Demand Summary</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <div className="text-muted-foreground">Quantity in stock</div>
                  <div className="font-mono text-sm">{state.quantityInStock ?? 0} units</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Quantity in SOs</div>
                  <div className="font-mono text-sm">{state.quantityInSOs ?? 0} units</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Balance</div>
                  <div
                    className={`font-mono text-sm${(state.balance ?? 0) < 0 ? "font-semibold text-destructive" : ""}`}
                  >
                    {state.balance ?? 0} units
                  </div>
                </div>
              </div>
            </div>

            {/* Sales order demand list */}
            <div className="space-y-2 rounded-md border px-3 py-2 text-[11px]">
              <div className="font-medium">Sales Order Demand</div>
              {state.orders && state.orders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1">SO number</th>
                        <th className="px-2 py-1">Customer</th>
                        <th className="px-2 py-1 text-right">Quantity</th>
                        <th className="px-2 py-1">Status</th>
                        <th className="px-2 py-1 text-right">Ship date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.orders.map((o, idx) => (
                        <tr key={`${o.so_number}-${o.ship_date || "no-date"}-${idx}`} className="border-b last:border-none">
                          <td className="px-2 py-1 font-mono text-[11px]">{o.so_number}</td>
                          <td className="px-2 py-1 text-[11px]">{o.customer_name || "-"}</td>
                          <td className="px-2 py-1 text-right text-[11px]">{o.quantity}</td>
                          <td className="px-2 py-1 text-[11px]">{o.status || "-"}</td>
                          <td className="px-2 py-1 text-right text-[11px]">
                            {o.ship_date ? new Date(o.ship_date).toISOString().slice(0, 10) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  No open or processing sales orders found for this product.
                </p>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
