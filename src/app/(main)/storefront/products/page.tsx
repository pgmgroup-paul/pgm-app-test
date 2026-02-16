import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/server/auth/current-user";
import { serverSupabase } from "@/lib/serverSupabase";
import { StorefrontProductsTable } from "./products-table";

export const dynamic = "force-dynamic";

async function getVisibleProductsForCustomer(
  customerId: string,
  customerTier: string | null,
): Promise<any[]> {
  // Fetch all products
  const { data: products, error } = await serverSupabase
    .from("products")
    .select("id, sku, sku_var, product_name, category, image, created_at")
    .order("created_at", { ascending: false });

  if (error || !products) {
    console.error("Error fetching products for storefront", error);
    return [];
  }

  // Customers should never see products in the 'Private' category
  const publicProducts = products.filter(
    (p) => (p.category ?? "").toLowerCase() !== "private",
  );

  if (publicProducts.length === 0) {
    return [];
  }

  const productIds = publicProducts.map((p) => p.id);

  // 1) All customer-specific permissions for this customer + these products
  const { data: customerPerms, error: custPermError } = await serverSupabase
    .from("product_customer_permissions")
    .select("product_id, can_view")
    .in("product_id", productIds)
    .eq("customer_id", customerId);

  if (custPermError) {
    console.error("Error fetching customer permissions", custPermError);
  }

  const customerPermMap = new Map<string, boolean>();
  for (const row of customerPerms ?? []) {
    customerPermMap.set(row.product_id as string, !!row.can_view);
  }

  // 2) All tier permissions for this tier + these products
  const tierPermMap = new Map<string, boolean>();

  if (customerTier) {
    const { data: tierPerms, error: tierPermError } = await serverSupabase
      .from("product_tier_permissions")
      .select("product_id, can_view")
      .in("product_id", productIds)
      .eq("customer_tier", customerTier);

    if (tierPermError) {
      console.error("Error fetching tier permissions", tierPermError);
    }

    for (const row of tierPerms ?? []) {
      tierPermMap.set(row.product_id as string, !!row.can_view);
    }
  }

  const visible: typeof publicProducts = [];

  for (const p of publicProducts) {
    const customerOverride = customerPermMap.has(p.id)
      ? customerPermMap.get(p.id)
      : undefined;

    if (customerOverride !== undefined) {
      if (customerOverride) {
        visible.push(p);
      }
      continue; // skip tier if specific override exists
    }

    const tierCanView = tierPermMap.get(p.id);
    if (tierCanView) {
      visible.push(p);
    }
    // default: hidden
  }

  return visible;
}

async function getProductsForProfile() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/v1/login");
  }

  // Admin / staff: see all products
  if (profile.role === "admin" || profile.role === "staff") {
    const { data, error } = await serverSupabase
      .from("products")
      .select("id, sku, sku_var, product_name, category, image, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching products for storefront (staff)", error);
      return [];
    }

    return data ?? [];
  }

  // Customers: permission-filtered
  if (profile.role === "customer") {
    return await getVisibleProductsForCustomer(profile.id, profile.customer_tier);
  }

  // Other roles (e.g. supplier): for now, no access
  return [];
}

export default async function StorefrontProductsPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/v1/login");
  }

  const products = await getProductsForProfile();

  return (
    <div className="space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-sm text-muted-foreground">
          Browse products available to your account.
        </p>
      </div>

      {/* Simple client-side search/filter/sort like Profiles page */}
      {/* We keep this page server-rendered for data, but the controls will be client-side */}

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products available.</p>
      ) : (
        <StorefrontProductsTable products={products as any} />
      )}
    </div>
  );
}
