import { NextResponse } from "next/server";

import { serverSupabase } from "@/lib/serverSupabase";

export async function GET(req: Request) {
  try {
    const supabase = serverSupabase;
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q) {
      return NextResponse.json({ products: [] });
    }

    // Case-insensitive fuzzy search on SKU or product name
    const pattern = `%${q}%`;

    const { data, error } = await supabase
      .from("products")
      .select("id, sku, sku_var, product_name")
      .or(`sku.ilike.${pattern},product_name.ilike.${pattern}`)
      .order("sku", { ascending: true })
      .limit(20);

    if (error) {
      console.error("Error searching products", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ products: data || [] });
  } catch (err: any) {
    console.error("Error in products search endpoint", err);
    return NextResponse.json({ error: "Failed to search products" }, { status: 500 });
  }
}
