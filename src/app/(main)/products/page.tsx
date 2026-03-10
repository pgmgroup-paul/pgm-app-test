import type { Metadata } from "next";

import { supabase } from "@/lib/supabaseClient";

import { AdminProductsTable } from "./products-table";

export const metadata: Metadata = {
  title: "Products",
};

export const dynamic = "force-dynamic";

async function getProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, sku, sku_var, product_name, category, upc, image, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching products", error);
    throw error;
  }

  return data ?? [];
}

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="space-y-4 p-6">
      <h1 className="font-semibold text-2xl tracking-tight">Products</h1>
      {products.length === 0 ? (
        <p className="text-muted-foreground text-sm">No products found.</p>
      ) : (
        <AdminProductsTable products={products as any} />
      )}
    </div>
  );
}
