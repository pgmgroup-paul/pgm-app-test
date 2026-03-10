import { type NextRequest, NextResponse } from "next/server";

import { serverSupabase } from "@/lib/serverSupabase";

export async function GET(req: NextRequest) {
  const supabase = serverSupabase;
  const { searchParams } = new URL(req.url);

  const sku = (searchParams.get("sku") || "").trim();
  const skuVar = (searchParams.get("sku_var") || "").trim();

  if (!sku) {
    return NextResponse.json({ ok: false, error: "Missing sku" }, { status: 400 });
  }

  let productQuery = supabase.from("products").select("id, sku, sku_var, product_name, category").eq("sku", sku);

  if (skuVar) {
    productQuery = productQuery.eq("sku_var", skuVar);
  } else {
    productQuery = productQuery.is("sku_var", null);
  }

  const { data: product, error: productError } = await productQuery.maybeSingle();

  if (productError) {
    console.error("Error looking up product", productError);
    return NextResponse.json({ ok: false, error: "Error looking up product" }, { status: 500 });
  }

  if (!product) {
    return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });
  }

  // Check pallet info
  const { data: palletDim, error: dimError } = await supabase
    .from("product_dimensions")
    .select("cartons_per_pallet")
    .eq("product_id", product.id)
    .eq("kind", "pallet")
    .maybeSingle();

  if (dimError) {
    console.error("Error checking pallet dimensions", dimError);
  }

  const palletsOk = !!palletDim?.cartons_per_pallet;

  return NextResponse.json({
    ok: true,
    product,
    palletInfo: palletsOk ? { cartons_per_pallet: Number(palletDim?.cartons_per_pallet) } : null,
  });
}
