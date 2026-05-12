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
    container_number: string;
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

  // 2) Load containers with status 'Delivered' that contain this product
  // Step 1: find container_ids from container_items_v2 by sku_id
  const { data: containerItemRows, error: containerItemsError } = await supabase
    .from("container_items_v2")
    .select("container_id")
    .eq("sku_id", productId);

  if (containerItemsError) {
    console.error("Error loading containers for dropship transfer (container_items_v2)", containerItemsError);
  }

  const containerIdSet = new Set<string>();
  for (const row of (containerItemRows || []) as any[]) {
    const cid = row.container_id as string | null | undefined;
    if (cid) {
      containerIdSet.add(cid);
    }
  }

  let containers: { id: string; container_number: string }[] = [];

  if (containerIdSet.size > 0) {
    const containerIds = Array.from(containerIdSet.values());

    // Step 2: load containers_v2 rows for those IDs with status = 'Delivered'
    const { data: containerRows, error: containersError } = await supabase
      .from("containers_v2")
      .select("id, container_number, status")
      .in("id", containerIds)
      .eq("status", "Delivered");

    if (containersError) {
      console.error("Error loading containers for dropship transfer (containers_v2)", containersError);
    } else {
      containers = (containerRows || []).map((c: any) => ({
        id: c.id as string,
        container_number: (c.container_number as string) || (c.id as string),
      }));
    }
  }

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
