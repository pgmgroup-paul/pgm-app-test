import { NextRequest, NextResponse } from "next/server";

import { serverSupabase } from "@/lib/serverSupabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json([]);
  }

  const { data, error } = await serverSupabase
    .from("products")
    .select("id, sku, sku_var, product_name")
    .or(`sku.ilike.%${q}%,product_name.ilike.%${q}%`)
    .limit(10);

  if (error) {
    console.error("Error searching products", error);
    return NextResponse.json([], { status: 500 });
  }

  return NextResponse.json(data || []);
}
