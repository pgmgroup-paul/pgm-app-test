"use client";

import { useActionState } from "react";

import type { ReceiveFormState } from "./page";
import { SkuLookupHelper } from "./sku-lookup";

interface WarehouseFormProps {
  warehouses: { id: string; name: string }[];
  action: (state: ReceiveFormState, formData: FormData) => Promise<ReceiveFormState>;
}

const initialState: ReceiveFormState = { ok: null };

export function WarehouseForm({ warehouses, action }: WarehouseFormProps) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <div className="max-w-xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Transfer between warehouses</h1>
        <p className="text-muted-foreground text-sm">Place or transfer inventory into locations.</p>
      </div>

      <form action={formAction} className="space-y-4 rounded-md border p-4">
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

          {/* Check SKU helper: shows product name + pallet info, controls Unit + Save button */}
          <SkuLookupHelper />
        </div>

        <div className="space-y-1 text-sm">
          <label htmlFor="warehouse" className="font-medium">
            Warehouse
          </label>
          <select
            id="warehouse"
            name="warehouse"
            required
            defaultValue={warehouses?.[0]?.name ?? ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {warehouses?.map((w) => (
              <option key={w.id} value={w.name}>
                {w.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 text-sm">
          <label htmlFor="location" className="font-medium">
            Location (A1–D50)
          </label>
          <input
            id="location"
            name="location"
            type="text"
            required
            placeholder="e.g. A35, C12"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-[11px] text-muted-foreground">Location will be auto-created if it does not exist.</p>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 space-y-1 text-sm">
            <label htmlFor="quantity" className="font-medium">
              Quantity
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={0}
              step={1}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="w-32 space-y-1 text-sm">
            <label htmlFor="unit" className="font-medium">
              Unit
            </label>
            <select
              id="unit"
              name="unit"
              defaultValue="pallets"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="pallets">Pallets</option>
              <option value="cases">Cases</option>
            </select>
          </div>
        </div>

        <button
          id="save-movement"
          type="submit"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
          disabled
        >
          Save movement
        </button>

        {state.ok === false && state.error && <p className="mt-2 text-destructive text-xs">{state.error}</p>}

        {state.ok === true && state.summary && (
          <div className="mt-3 space-y-2 rounded-md border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-emerald-800 text-xs">
            <p>
              You placed <span className="font-semibold">{state.summary.displayQuantity}</span> of
              <span className="font-semibold"> {state.summary.displaySku}</span> in
              <span className="font-semibold"> {state.summary.warehouseName}</span> at
              <span className="font-semibold"> {state.summary.locationCode}</span>.
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
