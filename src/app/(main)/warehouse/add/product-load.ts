"use server";

import { serverSupabase } from "@/lib/serverSupabase";

export interface AddProductState {
  ok: boolean | null;
  error?: string;
  productName?: string;
  productId?: string;
  sku?: string;
  skuVar?: string | null;
  cartonsPerPallet?: number | null;
  warehouses?: {
    id: string;
    name: string;
  }[];
  containers?: {
    id: string;
    code: string;
    status: string;
    vendor_name: string | null;
    eta: string | null;
  }[];
}

export async function loadAddProduct(_prev: AddProductState, formData: FormData): Promise<AddProductState> {
  const sku = (formData.get("sku") || "").toString().trim();
  const skuVar = (formData.get("sku_var") || "").toString().trim();

  if (!sku) {
    return { ok: false, error: "SKU is required" };
  }

  const supabase = serverSupabase;

  // Look up product by SKU (+ optional variant), case-insensitive
  let productQuery = supabase.from("products").select("id, product_name").ilike("sku", sku);

  if (skuVar) {
    productQuery = productQuery.ilike("sku_var", skuVar);
  } else {
    productQuery = productQuery.is("sku_var", null);
  }

  const { data: product, error: prodError } = await productQuery.maybeSingle();

  if (prodError) {
    console.error("Error looking up product for add", prodError);
    return { ok: false, error: "Error looking up product" };
  }

  if (!product) {
    return { ok: false, error: "No product found for this SKU / variant (case-insensitive lookup)" };
  }

  // Load pallets info if available
  const { data: dims, error: dimsError } = await supabase
    .from("product_dimensions")
    .select("cartons_per_pallet")
    .eq("product_id", product.id)
    .eq("kind", "pallet")
    .maybeSingle();

  if (dimsError) {
    console.error("Error loading product dimensions for add", dimsError);
  }

  // Load containers with status 'receiving' from shipment_containers for the Container source
  const { data: containers, error: contError } = await supabase
    .from("shipment_containers")
    .select(`id, container_number, status, shipment:shipments!inner(eta)`)
    .eq("status", "received")
    .order("created_at", { ascending: true });

  if (contError) {
    console.error("Error loading shipment containers for add", contError);
  }

  // Load all warehouses for dropdown
  const { data: warehouses, error: whError } = await supabase
    .from("warehouses")
    .select("id, name")
    .order("name", { ascending: true });

  if (whError) {
    console.error("Error loading warehouses for add", whError);
  }

  return {
    ok: true,
    productName: (product.product_name as string) || sku,
    productId: product.id as string,
    sku,
    skuVar: skuVar || null,
    warehouses: (warehouses || []).map((w) => ({
      id: w.id as string,
      name: w.name as string,
    })),
    cartonsPerPallet: dims?.cartons_per_pallet ?? null,
    containers: (containers || []).map((c: any) => ({
      id: c.id as string,
      code: (c.container_number as string) || "",
      status: c.status as string,
      vendor_name: null,
      eta: (c.shipment?.eta as string) || null,
    })),
  };
}
