"use client";

import { useEffect, useRef, useState } from "react";

export function FuzzyProductSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setOpen(false);
      return;
    }

    const handle = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ q });
        const res = await fetch(`/api/products/search?${params.toString()}`);
        if (!res.ok) {
          setResults([]);
          setOpen(false);
          return;
        }
        const data = await res.json();
        setResults(data.products || []);
        setOpen(true);
      } catch (err) {
        console.error("Error searching products", err);
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSelect = (p: any) => {
    const skuInput = document.getElementById("sku") as HTMLInputElement | null;
    const skuVarInput = document.getElementById("sku_var") as HTMLInputElement | null;
    if (skuInput) {
      skuInput.value = (p.sku as string) || "";
    }
    if (skuVarInput) {
      skuVarInput.value = (p.sku_var as string) || "";
    }
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="space-y-1">
      <label htmlFor="find_product" className="font-medium text-[11px]">
        Find Product
      </label>
      <div className="relative">
        <input
          id="find_product"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search SKU or product name..."
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-2 top-1.5 text-[10px] text-muted-foreground">Searching…</div>
        )}

        {open && results.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-background text-[11px] shadow-md">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="px-2 py-1">SKU</th>
                  <th className="px-2 py-1">Variant</th>
                  <th className="px-2 py-1">Product Name</th>
                </tr>
              </thead>
              <tbody>
                {results.map((p) => (
                  <tr
                    key={p.id}
                    className="cursor-pointer border-b last:border-none hover:bg-muted/70"
                    onClick={() => handleSelect(p)}
                  >
                    <td className="px-2 py-1 font-mono text-[11px]">{p.sku}</td>
                    <td className="px-2 py-1 text-[11px]">{p.sku_var || "" + "\u2014"}</td>
                    <td className="px-2 py-1 text-[11px]">{p.product_name || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
