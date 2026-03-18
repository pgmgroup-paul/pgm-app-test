"use client";

import { useMemo, useState } from "react";

interface ProductRow {
  id: string;
  sku: string;
  sku_var?: string | null;
  product_name: string;
  category: string | null;
  upc: string | null;
  image: string | null;
  created_at: string;
}

interface ProductsTableProps {
  products: ProductRow[];
  deleteProductAction: (formData: FormData) => void | Promise<void>;
}

export function AdminProductsTable({ products, deleteProductAction }: ProductsTableProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | "">("");
  const [sortKey, setSortKey] = useState<keyof ProductRow | "created_at">("product_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const categories = useMemo(() => {
    const vals = products.map((p) => (p.category ?? "").trim()).filter((v) => v.length > 0);
    return Array.from(new Set(vals)).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    let rows = products.slice();

    if (term) {
      rows = rows.filter((p) => {
        const haystack =
          `${p.product_name} ${p.sku} ${p.sku_var ?? ""} ${p.category ?? ""} ${p.upc ?? ""}`.toLowerCase();
        return haystack.includes(term);
      });
    }

    if (categoryFilter) {
      rows = rows.filter((p) => (p.category ?? "") === categoryFilter);
    }

    rows.sort((a, b) => {
      const aVal = (a[sortKey] ?? "") as string;
      const bVal = (b[sortKey] ?? "") as string;
      const cmp = aVal.localeCompare(bVal);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [products, search, categoryFilter, sortKey, sortDir]);

  return (
    <>
      <div className="flex flex-col gap-3 pb-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor="admin-products-search" className="font-medium">
              Search
            </label>
            <input
              id="admin-products-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, SKU, category, or UPC"
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-64"
            />
          </div>

          <div className="flex flex-col gap-1 text-sm md:flex-row md:items-center md:gap-2">
            <span className="font-medium">Filter</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-48"
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-sm md:flex-row md:items-center md:gap-2">
          <span className="font-medium">Sort by</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as keyof ProductRow)}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="product_name">Name</option>
            <option value="sku">SKU</option>
            <option value="category">Category</option>
            <option value="created_at">Created At</option>
          </select>
          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="border-b px-3 py-2 text-left font-medium">SKU</th>
              <th className="border-b px-3 py-2 text-left font-medium">Image</th>
              <th className="border-b px-3 py-2 text-left font-medium">Product Name</th>
              <th className="border-b px-3 py-2 text-left font-medium">Category</th>
              <th className="border-b px-3 py-2 text-left font-medium">UPC</th>
              <th className="border-b px-3 py-2 text-left font-medium">Created At</th>
              <th className="border-b px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => {
              const fullSku = item.sku_var ? `${item.sku}-${item.sku_var}` : item.sku;
              return (
                <tr key={item.id} className="align-top">
                  <td className="border-b px-3 py-2 font-mono text-xs">{fullSku}</td>
                  <td className="border-b px-3 py-2">
                    {item.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt={item.product_name}
                        width={120}
                        height={80}
                        className="rounded border object-cover"
                      />
                    )}
                  </td>
                  <td className="border-b px-3 py-2">{item.product_name}</td>
                  <td className="border-b px-3 py-2">{item.category}</td>
                  <td className="border-b px-3 py-2 font-mono text-xs">{item.upc}</td>
                  <td className="border-b px-3 py-2 font-mono text-xs">{item.created_at}</td>
                  <td className="space-x-2 border-b px-3 py-2 text-xs">
                    <a href={`/products/${item.id}/edit`} className="text-primary hover:underline">
                      Edit
                    </a>
                    <a href={`/products/${item.id}/edit`} className="text-muted-foreground hover:underline">
                      View details
                    </a>
                    <form
                      action={deleteProductAction}
                      className="inline"
                      onSubmit={(e) => {
                        // Confirmation dialog before soft delete
                        const ok = window.confirm("Are you sure you want to delete this product?");
                        if (!ok) e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="product_id" value={item.id} />
                      <button type="submit" className="text-destructive hover:underline">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
