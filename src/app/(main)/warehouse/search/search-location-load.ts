"use server";

import { serverSupabase } from "@/lib/serverSupabase";

export interface SearchLocationState {
  ok: boolean | null;
  error?: string;
  normalizedCode?: string;
  rows?: {
    product_id: string;
    sku: string;
    sku_var: string | null;
    product_name: string | null;
    quantity_cases: number;
  }[];
}

export async function loadSearchByLocation(
  _prev: SearchLocationState,
  formData: FormData,
): Promise<SearchLocationState> {
  const rawCode = (formData.get("location_code") || "").toString().trim();

  if (!rawCode) {
    return { ok: false, error: "Location code is required" };
  }

  // Normalize same as our inventory functions: trim, remove spaces, uppercase
  const normalizedCode = rawCode.replace(/\s+/g, "").toUpperCase();

  const supabase = serverSupabase;

  // First, find all location ids in "New warehouse" matching this code
  const { data: locs, error: locErr } = await supabase
    .from("locations")
    .select("id, code, warehouses ( name )")
    .eq("code", normalizedCode)
    .eq("warehouses.name", "New warehouse");

  if (locErr) {
    console.error("Error looking up locations for search", locErr);
    return { ok: false, error: "Error looking up this location" };
  }

  if (!locs || locs.length === 0) {
    return {
      ok: true,
      normalizedCode,
      rows: [],
    };
  }

  const locationIds = locs.map((l) => l.id as string);

  // Load all inventory entries at those locations with product details
  const { data: rows, error: invErr } = await supabase
    .from("inventory_location")
    .select("quantity_cases, product_id, products ( sku, sku_var, product_name )")
    .in("location_id", locationIds);

  if (invErr) {
    console.error("Error loading inventory for location search", invErr);
    return { ok: false, error: "Error loading inventory for this location" };
  }

  if (!rows || rows.length === 0) {
    return {
      ok: true,
      normalizedCode,
      rows: [],
    };
  }

  const normalizedRows = (rows || []).map((r: any) => ({
    product_id: r.product_id as string,
    sku: (r.products?.sku as string) || "",
    sku_var: (r.products?.sku_var as string) || null,
    product_name: (r.products?.product_name as string) || null,
    quantity_cases: Number(r.quantity_cases) || 0,
  }));

  return {
    ok: true,
    normalizedCode,
    rows: normalizedRows,
  };
}
