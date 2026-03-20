"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";

import {
  type ContainerContentsState,
  loadContainerContents,
  loadReceivingContainers,
  type ReceivingContainersState,
} from "../container-received/containers-load";
import { type AddMoveState, handleAddMove } from "./add-move";
import { handleUndoAdd, type UndoAddState } from "./add-undo";
import { type AddWarehousesState, loadWarehousesForAdd } from "./load-warehouses";
import { type AddProductState, loadAddProduct } from "./product-load";

export function AddShell() {
  // Non-container SKU lookup
  const [productState, productAction] = useActionState<AddProductState, FormData>(loadAddProduct, { ok: null });

  // Shared add/undo actions
  const [moveState, moveAction] = useActionState<AddMoveState, FormData>(handleAddMove, { ok: null });
  const [undoState, undoAction] = useActionState<UndoAddState, FormData>(handleUndoAdd, { ok: null });

  const [sourceType, setSourceType] = useState<"container" | "old_warehouse" | "vendor" | "return" | "found">(
    "container",
  );

  // For Source = Container: containers + contents + selected SKU
  const [containersState, setContainersState] = useState<ReceivingContainersState>({ ok: null });
  const [selectedContainerId, setSelectedContainerId] = useState<string>("");
  const [selectedContainerCode, setSelectedContainerCode] = useState<string>("");

  // Warehouses for dropdowns (both container and non-container flows)
  const [warehousesState, setWarehousesState] = useState<AddWarehousesState>({ ok: null });

  const [contentsState, contentsAction] = useActionState<ContainerContentsState, FormData>(loadContainerContents, {
    ok: null,
  });
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  // Refs for scrolling/focus on mobile when selecting a SKU in container contents
  const addInventoryRef = useRef<HTMLDivElement | null>(null);
  const quantityInputRef = useRef<HTMLInputElement | null>(null);

  // Ref for scrolling to container contents after a container is selected
  const containerContentsRef = useRef<HTMLDivElement | null>(null);

  // Load warehouses once for dropdowns
  useEffect(() => {
    (async () => {
      const res = await loadWarehousesForAdd();
      setWarehousesState(res);
    })();
  }, []);

  // Load containers when Source = Container
  useEffect(() => {
    if (sourceType !== "container") return;
    (async () => {
      const res = await loadReceivingContainers();
      setContainersState(res);
    })();
  }, [sourceType]);

  // When containers load in container mode, auto-select the first one
  useEffect(() => {
    if (sourceType !== "container") return;
    if (selectedContainerId) return;
    if (!containersState.ok || !containersState.containers || containersState.containers.length === 0) return;

    const first = containersState.containers[0];
    setSelectedContainerId(first.id);
    setSelectedContainerCode(first.code);
  }, [sourceType, containersState, selectedContainerId]);

  // Auto-load contents when a container is selected
  useEffect(() => {
    if (sourceType !== "container" || !selectedContainerId) return;
    startTransition(() => {
      const fd = new FormData();
      fd.append("container_id", selectedContainerId);
      contentsAction(fd);
    });
  }, [sourceType, selectedContainerId, contentsAction]);

  // After a successful add in container mode, refresh contents
  useEffect(() => {
    if (sourceType !== "container" || moveState.ok !== true || !selectedContainerId) return;
    startTransition(() => {
      const fd = new FormData();
      fd.append("container_id", selectedContainerId);
      contentsAction(fd);
    });
  }, [sourceType, moveState.ok, selectedContainerId, contentsAction]);

  // On mobile, after container contents load, scroll to the Container contents block
  useEffect(() => {
    if (sourceType !== "container") return;
    if (!selectedContainerId) return;
    if (!contentsState.ok || !contentsState.rows) return;
    if (typeof window === "undefined") return;

    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    if (containerContentsRef.current) {
      containerContentsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [sourceType, selectedContainerId, contentsState.ok, contentsState.rows]);

  // On mobile, when a SKU is selected in container mode, scroll to the Add Inventory block and focus quantity
  useEffect(() => {
    if (sourceType !== "container") return;
    if (!selectedProductId) return;
    if (typeof window === "undefined") return;

    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    if (addInventoryRef.current) {
      addInventoryRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // Small delay to allow scroll animation/layout before focusing
    window.setTimeout(() => {
      quantityInputRef.current?.focus();
    }, 300);
  }, [sourceType, selectedProductId]);

  return (
    <div className="space-y-4">
      {/* Block 1 — Source */}
      <div className="space-y-3 rounded-md border px-3 py-3 text-xs">
        <div className="space-y-1 text-xs">
          <label htmlFor="add_source_type" className="font-medium">
            Source
          </label>
          <select
            id="add_source_type"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={sourceType}
            onChange={(e) => {
              const v = e.target.value as typeof sourceType;
              setSourceType(v);
              // Reset container-specific selections when switching modes
              if (v !== "container") {
                setSelectedContainerId("");
                setSelectedContainerCode("");
                setSelectedProductId("");
              }
            }}
          >
            <option value="container">Container</option>
            <option value="old_warehouse">Old Warehouse</option>
            <option value="vendor">Other Vendor</option>
            <option value="return">Return</option>
            <option value="found">Found Item</option>
          </select>
          <p className="text-[10px] text-muted-foreground">
            {sourceType === "container"
              ? "Select a receiving container to receive into stock."
              : sourceType === "old_warehouse"
                ? "Enter the SKU/Var from the old warehouse, then add quantity and location."
                : sourceType === "vendor"
                  ? "Enter the PO number from the vendor."
                  : sourceType === "return"
                    ? "Enter the SO number or tracking number for the return."
                    : "Describe where this item was found or the location."}
          </p>
        </div>
      </div>

      {/* Block 2 — Container list (when Source = Container) */}
      {sourceType === "container" && (
        <div className="space-y-3 rounded-md border px-3 py-3 text-xs">
          <p className="font-medium text-[11px]">Containers (status = received)</p>

          {containersState.ok === false && containersState.error && (
            <p className="text-[11px] text-destructive">{containersState.error}</p>
          )}

          {containersState.ok === true && (!containersState.containers || containersState.containers.length === 0) && (
            <p className="text-[11px] text-muted-foreground">There are no containers currently in received status.</p>
          )}

          {containersState.containers && containersState.containers.length > 0 && (
            <>
              {/* Desktop table */}
              <div className="hidden max-h-48 overflow-auto rounded-md border md:block">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b text-[11px] text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-2">Container</th>
                      <th className="py-1 pr-2">ETA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {containersState.containers.map((c) => {
                      const isSelected = selectedContainerId === c.id;
                      return (
                        <tr
                          key={c.id}
                          className={
                            "cursor-pointer border-b last:border-none hover:bg-gray-50" +
                            (isSelected ? "border-blue-500 bg-blue-50" : "")
                          }
                          onClick={() => {
                            setSelectedContainerId(c.id);
                            setSelectedContainerCode(c.code);
                            setSelectedProductId("");
                          }}
                        >
                          <td className="py-1 pr-2 font-mono text-[11px]">{c.code}</td>
                          <td className="py-1 pr-2 text-[10px] text-muted-foreground">
                            {c.eta ? new Date(c.eta).toLocaleDateString() : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="max-h-48 space-y-2 overflow-auto md:hidden">
                {containersState.containers.map((c) => {
                  const isSelected = selectedContainerId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedContainerId(c.id);
                        setSelectedContainerCode(c.code);
                        setSelectedProductId("");
                      }}
                      className={
                        "flex w-full flex-col items-start justify-between rounded-lg border p-4 text-left text-[11px] shadow-sm" +
                        (isSelected ? "border-blue-500 bg-blue-50" : "")
                      }
                    >
                      <span className="font-mono text-[11px]">{c.code}</span>
                      <span className="mt-1 text-[10px] text-muted-foreground">
                        ETA: {c.eta ? new Date(c.eta).toLocaleDateString() : "-"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {selectedContainerId && (
            <p className="pt-2 text-[11px] text-muted-foreground">
              Selected container: <span className="font-mono">{selectedContainerCode}</span>
            </p>
          )}
        </div>
      )}

      {/* Block 3 — Container contents (auto-loaded when a container is selected) */}
      {sourceType === "container" && contentsState.ok === true && contentsState.rows && (
        <div ref={containerContentsRef} className="space-y-3 rounded-md border px-3 py-3 text-xs">
          <p className="font-medium text-[11px]">
            Container contents{" "}
            {contentsState.containerCode && <span className="font-mono">({contentsState.containerCode})</span>}
          </p>

          {contentsState.rows.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No inventory movements have been recorded for this container yet.
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden max-h-64 overflow-auto md:block">
                <table className="w-full text-left text-[11px]">
                  <thead className="border-b text-[11px] text-muted-foreground">
                    <tr>
                      <th className="w-6 py-1 pr-2" />
                      <th className="py-1 pr-2">SKU</th>
                      <th className="py-1 pr-2">Product</th>
                      <th className="py-1 pr-2 text-right">Cases in container</th>
                      <th className="py-1 pr-2 text-right">Cases per pallet</th>
                      <th className="py-1 pr-2 text-right">Remaining in container</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contentsState.rows.map((row) => {
                      const isSelected = selectedProductId === row.product_id;
                      const expectedCases = row.expected_cases ?? null;
                      const cartonsPerPallet = row.cartons_per_pallet ?? null;
                      const remainingCases = row.remaining_cases ?? null;

                      return (
                        <tr
                          key={row.product_id}
                          className={`border-b last:border-none${isSelected ? "bg-muted/60" : ""}`}
                        >
                          <td className="py-1 pr-2 text-right align-top">
                            <input
                              type="radio"
                              name="container_product_id"
                              value={row.product_id}
                              className="h-3 w-3"
                              checked={isSelected}
                              onChange={() => setSelectedProductId(row.product_id)}
                            />
                          </td>
                          <td className="py-1 pr-2 font-mono text-[11px]">
                            {row.sku}
                            {row.sku_var ? `-${row.sku_var}` : ""}
                          </td>
                          <td className="py-1 pr-2 text-[11px]">{row.product_name}</td>
                          <td className="py-1 pr-2 text-right text-[11px]">
                            {expectedCases != null ? Math.round(expectedCases) : "-"}
                          </td>
                          <td className="py-1 pr-2 text-right text-[11px]">
                            {cartonsPerPallet != null ? cartonsPerPallet : "-"}
                          </td>
                          <td className="py-1 pr-2 text-right text-[11px]">
                            {remainingCases != null ? Math.round(remainingCases) : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {contentsState.rows.map((row) => {
                  const expectedCases = row.expected_cases ?? null;
                  const cartonsPerPallet = row.cartons_per_pallet ?? null;
                  const remainingCases = row.remaining_cases ?? null;

                  return (
                    <div key={row.product_id} className="rounded-md border px-3 py-2 text-[11px] shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-mono text-[11px]">
                          {row.sku}
                          {row.sku_var ? `-${row.sku_var}` : ""}
                        </div>
                      </div>
                      <div className="mt-1 font-medium text-[11px]">{row.product_name}</div>
                      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">Cases in container:</span>{" "}
                          {expectedCases != null ? Math.round(expectedCases) : "-"}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Cases per pallet:</span>{" "}
                          {cartonsPerPallet != null ? cartonsPerPallet : "-"}
                        </div>
                        <div>
                          <span className="font-medium text-foreground">Remaining in container:</span>{" "}
                          {remainingCases != null ? Math.round(remainingCases) : "-"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProductId(row.product_id)}
                        className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
                      >
                        Select SKU
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Block 4 — Add inventory from container (when a SKU is selected) */}
      {sourceType === "container" && selectedContainerId && selectedProductId && (
        <form action={moveAction} className="space-y-3 rounded-md border px-3 py-3 text-xs">
          <input type="hidden" name="product_id" value={selectedProductId} />
          <input type="hidden" name="add_source_type" value="container" />
          <input type="hidden" name="add_source_ref" value={selectedContainerCode} />

          {/* Selected product header */}
          {contentsState.rows &&
            (() => {
              const row = contentsState.rows.find((r) => r.product_id === selectedProductId);
              if (!row) return null;
              return (
                <div ref={addInventoryRef} className="rounded-md bg-muted px-3 py-2 text-[11px]">
                  <div className="text-[10px] text-muted-foreground">Adding inventory for:</div>
                  <div className="font-mono text-[11px]">
                    {row.sku}
                    {row.sku_var ? `-${row.sku_var}` : ""}
                  </div>
                  <div className="font-medium text-[11px]">{row.product_name}</div>
                </div>
              );
            })()}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1 text-xs">
              <label htmlFor="add_quantity" className="font-medium">
                Quantity to add
              </label>
              <input
                ref={quantityInputRef}
                id="add_quantity"
                name="add_quantity"
                type="number"
                min={0}
                step={1}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-medium">Unit</label>
              <div className="w-full rounded-md border border-input bg-muted px-2 py-1 text-xs shadow-sm">
                Cases
              </div>
              <input type="hidden" id="add_unit" name="add_unit" value="cases" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Warehouse is fixed to Industry; no user selection needed */}
            <input type="hidden" id="add_warehouse_name" name="add_warehouse_name" value="Industry" />

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
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-3 font-medium text-lg text-primary-foreground hover:bg-primary/90 md:w-auto md:py-1.5 md:text-[11px]"
          >
            Save inventory
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

      {/* Existing workflow for non-container sources */}
      {sourceType !== "container" && (
        <>
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
              Check SKU &amp; load sources
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
              <input type="hidden" name="add_source_type" value={sourceType} />

              {sourceType !== "old_warehouse" && (
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

              {sourceType === "old_warehouse" && (
                <input type="hidden" id="add_source_ref" name="add_source_ref" value="" />
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
                    <p className="text-[10px] text-muted-foreground">
                      {productState.cartonsPerPallet} cases per pallet
                    </p>
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  <label className="font-medium">Unit</label>
                  <div className="w-full rounded-md border border-input bg-muted px-2 py-1 text-xs shadow-sm">
                    Cases
                  </div>
                  <input type="hidden" id="add_unit" name="add_unit" value="cases" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Warehouse is fixed to Industry; no user selection needed */}
                <input type="hidden" id="add_warehouse_name" name="add_warehouse_name" value="Industry" />

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

              {moveState.ok === false && moveState.error && (
                <p className="text-destructive text-xs">{moveState.error}</p>
              )}

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
        </>
      )}
    </div>
  );
}
