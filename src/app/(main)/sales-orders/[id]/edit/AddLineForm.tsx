"use client";

import { useTransition } from "react";

import { FuzzyProductSearch } from "../../../sales-shipments/FuzzyProductSearch";

export function AddLineForm({ salesOrderId, action, error, status }: { salesOrderId: string; action: (formData: FormData) => Promise<void>; error?: string; status?: string; }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
      <div className="font-medium text-[11px]">Add product</div>

      <FuzzyProductSearch />

      <form
        action={(formData: FormData) => {
          startTransition(async () => {
            await action(formData);
          });
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-4"
      >
        <input type="hidden" name="sales_order_id" value={salesOrderId} />
        <div className="space-y-1">
          <label htmlFor="sku" className="font-medium text-[11px]">
            SKU
          </label>
          <input
            id="sku"
            name="sku"
            type="text"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="sku_var" className="font-medium text-[11px]">
            Variant
          </label>
          <input
            id="sku_var"
            name="sku_var"
            type="text"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="quantity_units" className="font-medium text-[11px]">
            Quantity (units)
          </label>
          <input
            id="quantity_units"
            name="quantity_units"
            type="number"
            min="1"
            step="1"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-md border px-3 py-1.5 font-medium text-[11px] hover:bg-muted disabled:opacity-50"
            disabled={isPending}
          >
            {isPending ? "Adding..." : "Add product"}
          </button>
        </div>
      </form>

      {error && (
        <p className="pt-2 text-[11px] text-destructive">
          {error === "missing-line-fields" && "SKU and quantity are required."}
          {error === "bad-qty" && "Quantity must be a positive number."}
          {error === "product-not-in-catalog" && "Product not found in catalog."}
          {error === "failed-to-add-line" && "Failed to add line."}
          {error === "failed-to-delete-line" && "Failed to remove line."}
          {error === "failed-to-update-line" && "Failed to update quantity."}
          {error === "failed-to-update-date" && "Failed to update requested ship date."}
          {error === "no-lines" && "Add products before sending to warehouse."}
          {error === "shipments-exist" && "Cannot use this option once shipments have been created."}
          {error === "failed-fast-ship" && "Failed to send shipment."}
        </p>
      )}

      {status === "fast-shipped" && (
        <p className="pt-2 text-[11px] text-emerald-700">Order sent as 1 shipment to warehouse.</p>
      )}
    </div>
  );
}
