"use client";

import { useActionState, useState } from "react";

import { type AddMoveState, handleAddMove } from "./add-move";
import { handleUndoAdd, type UndoAddState } from "./add-undo";
import { type AddProductState, loadAddProduct } from "./product-load";

export function AddShell() {
  const [productState, productAction] = useActionState<AddProductState, FormData>(loadAddProduct, { ok: null });

  const [moveState, moveAction] = useActionState<AddMoveState, FormData>(handleAddMove, { ok: null });

  const [undoState, undoAction] = useActionState<UndoAddState, FormData>(handleUndoAdd, { ok: null });

  const [sourceType, setSourceType] = useState("container");

  return (
    <div className="space-y-4">
      {/* SKU validator */}
      <form action={productAction} className="space-y-3 rounded-md border px-3 py-3 text-sm">
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
          Check SKU & load sources
        </button>

        {productState.ok === false && productState.error && (
          <p className="mt-2 text-destructive text-xs">{productState.error}</p>
        )}

        {productState.ok === true && productState.productName && (
          <p className="mt-2 text-emerald-700 text-xs">
            Product: <span className="font-semibold">{productState.productName}</span>{" "}
            {productState.sku && (
              <span className="font-mono text-[11px] text-emerald-900">
                ({productState.sku}
                {productState.skuVar ? ` / ${productState.skuVar}` : ""})
              </span>
            )}
          </p>
        )}
      </form>

      {/* Add movement form */}
      {productState.ok === true && productState.productId && (
        <form action={moveAction} className="space-y-3 rounded-md border px-3 py-3 text-xs">
          {/* keep track of which product is being added */}
          <input type="hidden" name="product_id" value={productState.productId || ""} />

          {/* Source block */}
          <div className="space-y-1 text-xs">
            <label htmlFor="add_source_type" className="font-medium">
              Source
            </label>
            <select
              id="add_source_type"
              name="add_source_type"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
            >
              <option value="container">Container</option>
              <option value="vendor">Other vendor</option>
              <option value="return">Return</option>
              <option value="found">Found item</option>
            </select>
            <p className="text-[10px] text-muted-foreground">
              {sourceType === "container"
                ? "Select a receiving container to receive into stock."
                : sourceType === "vendor"
                  ? "Enter the PO number from the vendor."
                  : sourceType === "return"
                    ? "Enter the SO number or tracking number for the return."
                    : "Describe where this item was found or the location."}
            </p>
          </div>

          {sourceType === "container" && productState.containers && (
            <div className="space-y-1 text-xs">
              <p className="font-medium">Receiving containers</p>
              {productState.containers.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No containers with status 'receiving' found.</p>
              ) : (
                <div className="max-h-40 overflow-auto rounded-md border">
                  <table className="w-full text-left text-[11px]">
                    <thead className="border-b text-[11px] text-muted-foreground">
                      <tr>
                        <th className="w-6 py-1 pr-2" />
                        <th className="py-1 pr-2">Code</th>
                        <th className="py-1 pr-2">Vendor</th>
                        <th className="py-1 pr-2">ETA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productState.containers.map((c) => (
                        <tr key={c.id} className="border-b last:border-none">
                          <td className="py-1 pr-2 text-right align-top">
                            <input type="radio" name="add_source_ref" value={c.code} className="h-3 w-3" />
                          </td>
                          <td className="py-1 pr-2 font-mono text-[11px]">{c.code}</td>
                          <td className="py-1 pr-2 text-[11px]">{c.vendor_name}</td>
                          <td className="py-1 pr-2 text-[10px] text-muted-foreground">
                            {c.eta ? new Date(c.eta).toLocaleDateString() : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {sourceType !== "container" && (
            <div className="space-y-1 text-xs">
              <label htmlFor="add_source_ref" className="font-medium">
                {sourceType === "vendor"
                  ? "PO number"
                  : sourceType === "return"
                    ? "SO number or tracking number"
                    : "Where / description"}
              </label>
              <input
                id="add_source_ref"
                name="add_source_ref"
                type="text"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {sourceType === "found" && (
                <>
                  <label htmlFor="add_source_note" className="font-medium">
                    Extra note (optional)
                  </label>
                  <textarea
                    id="add_source_note"
                    name="add_source_note"
                    rows={2}
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </>
              )}
            </div>
          )}

          {/* Quantity + location */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1 text-xs">
              <label htmlFor="add_quantity" className="font-medium">
                Quantity to add
              </label>
              <input
                id="add_quantity"
                name="add_quantity"
                type="number"
                min={0}
                step={1}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {productState.cartonsPerPallet && (
                <p className="text-[10px] text-muted-foreground">{productState.cartonsPerPallet} cases per pallet</p>
              )}
            </div>

            <div className="space-y-1 text-xs">
              <label htmlFor="add_unit" className="font-medium">
                Unit
              </label>
              <select
                id="add_unit"
                name="add_unit"
                defaultValue="cases"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="cases">Cases</option>
                <option value="pallets">Pallets</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1 text-xs">
              <label htmlFor="add_warehouse_name" className="font-medium">
                Warehouse
              </label>
              <select
                id="add_warehouse_name"
                name="add_warehouse_name"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                defaultValue={
                  productState.warehouses?.find((w) => w.name === "New warehouse")
                    ? "New warehouse"
                    : productState.warehouses && productState.warehouses.length > 0
                      ? productState.warehouses[0].name
                      : ""
                }
              >
                <option value="" disabled>
                  Select a warehouse
                </option>
                {productState.warehouses?.map((w) => (
                  <option key={w.id} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 text-xs">
              <label htmlFor="add_location_code" className="font-medium">
                Location code
              </label>
              <input
                id="add_location_code"
                name="add_location_code"
                type="text"
                placeholder="e.g. A2-03-01"
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-[10px] text-muted-foreground">New locations will be created automatically.</p>
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
          >
            Save add
          </button>

          {moveState.ok === false && moveState.error && <p className="text-destructive text-xs">{moveState.error}</p>}

          {moveState.ok === true && moveState.message && (
            <div className="space-y-1 text-xs">
              <p className="text-emerald-700">{moveState.message}</p>

              {moveState.movementId && (
                <div className="inline-flex items-center gap-2 pt-1">
                  <input type="hidden" name="movement_id" value={moveState.movementId} />
                  <button
                    type="submit"
                    formAction={undoAction}
                    className="inline-flex items-center rounded-md border border-input border-dashed px-2 py-1 font-medium text-[10px] text-muted-foreground hover:bg-muted/40"
                  >
                    Undo last add
                  </button>
                  {undoState.ok === false && undoState.error && (
                    <span className="text-[10px] text-destructive">{undoState.error}</span>
                  )}
                  {undoState.ok === true && undoState.message && (
                    <span className="text-[10px] text-emerald-700">{undoState.message}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
