"use client";

import { useState } from "react";

interface LookupResult {
  ok: boolean;
  error?: string;
  product?: {
    id: string;
    sku: string;
    sku_var: string | null;
    product_name: string;
    category: string | null;
  };
  palletInfo?: {
    cartons_per_pallet: number;
  } | null;
}

export function SkuLookupHelper() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);

  const doLookup = async () => {
    const skuInput = document.getElementById("sku") as HTMLInputElement | null;
    const skuVarInput = document.getElementById("sku_var") as HTMLInputElement | null;
    const unitSelect = document.getElementById("unit") as HTMLSelectElement | null;

    const sku = skuInput?.value.trim() || "";
    const skuVar = skuVarInput?.value.trim() || "";

    if (!sku) return;

    setLoading(true);
    setResult(null);

    try {
      const params = new URLSearchParams({ sku });
      if (skuVar) {
        params.set("sku_var", skuVar);
      }

      const res = await fetch(`/api/products/lookup?${params.toString()}`);
      const data = await res.json();
      setResult(data);

      const saveButton = document.getElementById("save-movement") as HTMLButtonElement | null;

      // Adjust Unit select and save button based on pallet info / product validity
      if (unitSelect) {
        const palletsOption = Array.from(unitSelect.options).find((opt) => opt.value === "pallets");

        if (data.ok) {
          // Enable save when SKU is valid
          if (saveButton) {
            saveButton.disabled = false;
          }

          if (data.palletInfo && palletsOption) {
            // Pallet info exists: allow pallets
            palletsOption.disabled = false;
          } else {
            // No pallet info: force cases and disable pallets
            unitSelect.value = "cases";
            if (palletsOption) {
              palletsOption.disabled = true;
            }
          }
        } else {
          // Invalid SKU: disable save and pallets
          if (saveButton) {
            saveButton.disabled = true;
          }
          unitSelect.value = "cases";
          if (palletsOption) {
            palletsOption.disabled = true;
          }
        }
      } else if (saveButton) {
        // If no unit select, still toggle save button based on validity
        saveButton.disabled = !data.ok;
      }
    } catch (err) {
      console.error("Error looking up product", err);
      setResult({ ok: false, error: "Lookup failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-1 space-y-2 text-xs">
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={doLookup}
          disabled={loading}
          className="inline-flex items-center rounded-md border border-input px-2 py-1 font-medium text-[11px] text-muted-foreground hover:bg-muted/40 disabled:opacity-50"
        >
          {loading ? "Checking..." : "Check SKU"}
        </button>
      </div>

      {result?.ok && result.product && (
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>
            Product: <span className="font-medium">{result.product.product_name}</span>
          </p>
          {result.palletInfo ? (
            <p>Pallets OK: {result.palletInfo.cartons_per_pallet} cases per pallet.</p>
          ) : (
            <p>Pallet info missing – use cases only.</p>
          )}
        </div>
      )}

      {result && !result.ok && result.error && <p className="text-[11px] text-destructive">{result.error}</p>}
    </div>
  );
}
