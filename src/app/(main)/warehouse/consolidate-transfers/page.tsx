import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

import { ConsolidateTransfersShell } from "./shell";

export const dynamic = "force-dynamic";

export interface ReceiveFormState {
  ok: boolean | null;
  error?: string;
  summary?: {
    displayQuantity: string;
    displaySku: string;
    warehouseName: string;
    locationCode: string;
  };
  undoMessage?: string;
}

async function handleReceive(_prevState: ReceiveFormState, formData: FormData): Promise<ReceiveFormState> {
  "use server";

  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/v1/login");
  }

  const mode = (formData.get("__action") || "save").toString();

  const supabase = serverSupabase;

  if (mode === "undo") {
    const { error } = await supabase.rpc("undo_last_movement");

    if (error) {
      console.error("Error undoing last movement", error);
      return { ok: false, error: `Undo failed: ${error.message}` };
    }

    return { ok: null, undoMessage: "Last movement undone." };
  }

  const sku = (formData.get("sku") || "").toString().trim();
  const skuVar = (formData.get("sku_var") || "").toString().trim();
  const warehouseName = (formData.get("warehouse") || "").toString().trim();
  const locationCode = (formData.get("location") || "").toString().trim();
  const quantityRaw = (formData.get("quantity") || "").toString().trim();
  const unit = (formData.get("unit") || "cases").toString();

  if (!sku || !warehouseName || !locationCode || !quantityRaw) {
    return { ok: false, error: "Missing required fields" };
  }

  const quantityNumber = Number(quantityRaw);
  if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) {
    return { ok: false, error: "Quantity must be a positive number" };
  }

  // 1) Resolve product by sku / sku_var
  let productQuery = supabase.from("products").select("id, sku, sku_var").eq("sku", sku);

  if (skuVar) {
    productQuery = productQuery.eq("sku_var", skuVar);
  } else {
    productQuery = productQuery.is("sku_var", null);
  }

  const { data: product, error: productError } = await productQuery.maybeSingle();

  if (productError || !product) {
    console.error("Error finding product for receive", productError);
    return { ok: false, error: "Product not found for that SKU / variant" };
  }

  // 2) Resolve warehouse
  const { data: warehouse, error: whError } = await supabase
    .from("warehouses")
    .select("id, name")
    .eq("name", warehouseName)
    .maybeSingle();

  if (whError || !warehouse) {
    console.error("Error finding warehouse", whError);
    return { ok: false, error: "Warehouse not found" };
  }

  // 3) Compute quantity_cases based on unit
  let quantityCases = quantityNumber;

  if (unit === "pallets") {
    const { data: palletDim, error: dimError } = await supabase
      .from("product_dimensions")
      .select("cartons_per_pallet")
      .eq("product_id", product.id)
      .eq("kind", "pallet")
      .maybeSingle();

    if (dimError || !palletDim || !palletDim.cartons_per_pallet) {
      console.error("Missing pallet dimensions for product", dimError);
      return {
        ok: false,
        error: "Cannot use pallets for this product (missing cartons_per_pallet)",
      };
    }

    quantityCases = quantityNumber * Number(palletDim.cartons_per_pallet);
  }

  // 4) Call RPC to perform movement atomically
  const { error: rpcError } = await supabase.rpc("receive_or_transfer", {
    p_product_id: product.id,
    p_warehouse_id: warehouse.id,
    p_location_code: locationCode,
    p_quantity_cases: Math.round(quantityCases),
  });

  if (rpcError) {
    console.error("Error running receive_or_transfer", rpcError);
    return { ok: false, error: "Movement failed, please try again" };
  }

  const displayQuantity =
    unit === "pallets"
      ? `${quantityNumber} pallet${quantityNumber === 1 ? "" : "s"} (${Math.round(quantityCases)} cases)`
      : `${Math.round(quantityCases)} case${Math.round(quantityCases) === 1 ? "" : "s"}`;

  const displaySku = skuVar ? `${sku} – ${skuVar}` : sku;

  return {
    ok: true,
    summary: {
      displayQuantity,
      displaySku,
      warehouseName,
      locationCode,
    },
    undoMessage: undefined,
  };
}

export default async function WarehouseConsolidateTransfersPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/v1/login");
  }

  const supabase = serverSupabase;

  const { data: warehouses } = await supabase.from("warehouses").select("id, name").order("name", { ascending: true });

  return <ConsolidateTransfersShell warehouses={warehouses ?? []} transferAction={handleReceive} />;
}
