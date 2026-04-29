"use client";

import { useTransition, useState, useRef } from "react";

interface ProductSearchResult {
  id: string;
  sku: string;
  sku_var: string | null;
  product_name: string | null;
}

export function AddLineForm({ salesOrderId, action, error }: { salesOrderId: string; action: (formData: FormData) => Promise<void>; error?: string; }) {
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);

  const skuInputRef = useRef<HTMLInputElement | null>(null);
  const skuVarInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  async function handleSearchChange(value: string) {
    setSearchQuery(value);

    const q = value.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    try {
      const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        setSearchResults([]);
        return;
      }
      const data = (await res.json()) as ProductSearchResult[];
      setSearchResults(data || []);
    } catch (err) {
      console.error("Error searching products", err);
      setSearchResults([]);
    }
  }

  return (
    <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
      <div className="font-medium text-[11px]">Add line</div>

      <div className="space-y-1">
        <label htmlFor="product_search" className="font-medium text-[11px]">
          Search product
        </label>
        <input
          ref={searchInputRef}
          id="product_search"
          name="product_search"
          type="text"
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <div id="product-search-results" className="mt-1 text-[11px]">
          {searchQuery.trim().length > 0 && searchResults.length === 0 && (
            <div className="rounded-md border bg-background px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
              No products found
            </div>
          )}

          {searchResults.length > 0 && (
            <ul className="max-h-48 w-full overflow-auto rounded-md border bg-background text-[11px] shadow-sm">
              {searchResults.map((p) => (
                <li
                  key={p.id}
                  className="cursor-pointer border-b last:border-none px-2 py-1 hover:bg-muted"
                  onClick={() => {
                    if (skuInputRef.current) {
                      skuInputRef.current.value = p.sku;
                    }
                    if (skuVarInputRef.current) {
                      skuVarInputRef.current.value = p.sku_var || "";
                    }
                    const label = p.product_name ? `${p.sku} - ${p.product_name}` : p.sku;
                    setSearchQuery(label);
                    if (searchInputRef.current) {
                      searchInputRef.current.value = label;
                    }
                    setSearchResults([]);
                  }}
                >
                  <div className="font-mono">
                    {p.sku}
                    {p.sku_var ? ` / ${p.sku_var}` : ""}
                  </div>
                  {p.product_name && (
                    <div className="text-[11px] text-muted-foreground">{p.product_name}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

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
            ref={skuInputRef}
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
            ref={skuVarInputRef}
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
            {isPending ? "Adding..." : "Add line"}
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
        </p>
      )}
    </div>
  );
}
