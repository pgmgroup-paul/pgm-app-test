"use server";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export interface ResolveProductResult {
  ok: boolean;
  error?: string;
  sku?: string;
  skuVar?: string | null;
}

export async function resolveProductById(productId: string): Promise<ResolveProductResult> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }

  if (!productId) {
    return { ok: false, error: "Missing product id" };
  }

  const supabase = serverSupabase;

  const { data, error } = await supabase.from("products").select("sku, sku_var").eq("id", productId).maybeSingle();

  if (error || !data) {
    console.error("Error resolving product by id for deduct", error);
    return { ok: false, error: "Product not found" };
  }

  return {
    ok: true,
    sku: (data as any).sku as string,
    skuVar: ((data as any).sku_var as string | null) ?? null,
  };
}
