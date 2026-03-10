"use server";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export interface DropshipSourcesState {
  ok: boolean | null;
  error?: string;
  productName?: string;
  productId?: string;
  sku?: string;
  skuVar?: string | null;
  containers?: {
    id: string;
  }[];
  shipments?: {
    id: string;
    order_number: string;
    shipment_sequence: number;
  }[];
}

export async function loadDropshipSources(
  _prev: DropshipSourcesState,
  formData: FormData,
): Promise<DropshipSourcesState> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }

  const sku = (formData.get("sku") || "").toString().trim();
  const skuVar = (formData.get("sku_var") || "").toString().trim();

  if (!sku) {
    return { ok: false, error: "SKU is required" };
  }

  const supabase = serverSupabase;

  // 1) Resolve product by sku / sku_var (case-insensitive)
  let productQuery = supabase.from("products").select("id, sku, sku_var, product_name").ilike("sku", sku);

  if (skuVar) {
    productQuery = productQuery.ilike("sku_var", skuVar);
  } else {
    productQuery = productQuery.is("sku_var", null);
  }

  const { data: product, error: productError } = await productQuery.maybeSingle();

  if (productError || !product) {
    console.error("Error finding product for dropship transfer", productError);
    return {
      ok: false,
      error: "Product not found for that SKU / variant (case-insensitive lookup)",
    };
  }

  const productId = product.id as string;

  // 2) Load containers with status 'received' that contain this product
  // We traverse via shipment_items -> purchase_order_lines to get product_id
  const { data: containerItems, error: containersError } = await supabase
    .from("shipment_items")
    .select(
      `shipment_container_id,
       shipment_containers!inner(id, status, container_number),
       purchase_order_lines!inner(product_id)`,
    )
    .eq("shipment_containers.status", "received")
    .eq("purchase_order_lines.product_id", productId);

  if (containersError) {
    console.error("Error loading containers for dropship transfer", containersError);
  }

  const containersMap = new Map<string, { id: string; container_number: string }>();
  for (const row of (containerItems || []) as any[]) {
    const c = row.shipment_containers as any;
    if (!c || !c.id) continue;
    const id = c.id as string;
    const containerNumber = (c.container_number as string) || id;
    if (!containersMap.has(id)) {
      containersMap.set(id, { id, container_number: containerNumber });
    }
  }

  const containers = Array.from(containersMap.values());

  // 3) Load shipments in processing that include this product
  const { data: shipmentsRaw, error: shipmentsError } = await supabase
    .from("so_shipments")
    .select(
      `id,
       shipment_sequence,
       status,
       so_shipment_lines!inner(product_id),
       sales_orders!inner(order_number)`,
    )
    .eq("status", "processing")
    .eq("so_shipment_lines.product_id", productId);

  if (shipmentsError) {
    console.error("Error loading shipments for dropship transfer", shipmentsError);
  }

  const shipments = (shipmentsRaw || []).map((s: any) => ({
    id: s.id as string,
    order_number: (s.sales_orders?.order_number as string) || "",
    shipment_sequence: Number(s.shipment_sequence) || 0,
  }));

  return {
    ok: true,
    productName: (product.product_name as string) || sku,
    productId,
    sku: (product.sku as string) || sku,
    skuVar: (product.sku_var as string) || null,
    containers,
    shipments,
  };
}
