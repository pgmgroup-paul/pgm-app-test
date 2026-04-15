"use client";

import { useState, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

export function AddProductSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (value.length < 2) {
      setResults([]);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id, sku, sku_var, product_name")
      .or(`sku.ilike.%${value}%,product_name.ilike.%${value}%`)
      .limit(5);

    if (error) {
      console.error("Product search error", error);
      setResults([]);
      return;
    }

    setResults(data || []);
  };

  const handleSelect = (p: any) => {
    const skuInput = document.querySelector<HTMLInputElement>("input[name='sku']");
    const skuVarInput = document.querySelector<HTMLInputElement>("input[name='sku_var']");

    if (skuInput) {
      skuInput.value = p.sku || "";
      skuInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    if (skuVarInput) {
      skuVarInput.value = p.sku_var || "";
      skuVarInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    setResults([]);
    setQuery("");

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="space-y-1 text-xs">
      <input
        ref={inputRef}
        value={query}
        onChange={handleChange}
        placeholder="Search SKU or product"
        className="w-full rounded border px-2 py-1"
      />
      {results.length > 0 && (
        <div className="mt-1 max-h-40 overflow-auto rounded border bg-white shadow-sm">
          {results.map((p) => (
            <div
              key={p.id}
              onClick={() => handleSelect(p)}
              className="cursor-pointer px-2 py-1 hover:bg-gray-100"
            >
              <span className="font-mono">{p.sku}</span>
              {p.sku_var && <span className="ml-1 text-gray-500">({p.sku_var})</span>}
              <span className="ml-2 text-gray-700">— {p.product_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
