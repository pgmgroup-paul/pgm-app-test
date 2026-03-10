"use server";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

interface LocationState {
  ok: boolean | null;
  error?: string;
  sourceWarehouse?: string;
  sourceLocation?: string;
  rows?: {
    product_id: string;
    sku: string;
    sku_var: string | null;
    product_name: string;
    quantity_cases: number;
  }[];
}

export async function loadLocationContents(_prevState: LocationState, formData: FormData): Promise<LocationState> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }

  const warehouseName = (formData.get("source_warehouse") || "").toString().trim();
  const locationCodeRaw = (formData.get("source_location") || "").toString().trim();

  if (!warehouseName || !locationCodeRaw) {
    return { ok: false, error: "Warehouse and location are required" };
  }

  // Normalize location code: trim, remove all spaces, uppercase
  const locationCode = locationCodeRaw.replace(/\s+/g, "").toUpperCase();

  const supabase = serverSupabase;

  // Find warehouse
  const { data: warehouse, error: whError } = await supabase
    .from("warehouses")
    .select("id")
    .eq("name", warehouseName)
    .maybeSingle();

  if (whError || !warehouse) {
    console.error("Error finding warehouse for consolidate", whError);
    return { ok: false, error: "Warehouse not found" };
  }

  // Find location
  const { data: location, error: locError } = await supabase
    .from("locations")
    .select("id")
    .eq("warehouse_id", warehouse.id)
    .eq("code", locationCode)
    .maybeSingle();

  if (locError) {
    console.error("Error finding location for consolidate", locError);
    return { ok: false, error: "Error finding location" };
  }

  if (!location) {
    return { ok: true, sourceWarehouse: warehouseName, sourceLocation: locationCode, rows: [] };
  }

  const { data: rows, error: invError } = await supabase
    .from("inventory_location")
    .select(
      `product_id,
       quantity_cases,
       products ( sku, sku_var, product_name )`,
    )
    .eq("location_id", location.id);

  if (invError) {
    console.error("Error loading inventory for location", invError);
    return { ok: false, error: "Error loading inventory" };
  }

  const normalized = (rows || []).map((r: any) => ({
    product_id: r.product_id as string,
    sku: r.products?.sku as string,
    sku_var: (r.products?.sku_var as string | null) || null,
    product_name: (r.products?.product_name as string) || "",
    quantity_cases: Number(r.quantity_cases) || 0,
  }));

  return {
    ok: true,
    sourceWarehouse: warehouseName,
    sourceLocation: locationCode,
    rows: normalized,
  };
}
