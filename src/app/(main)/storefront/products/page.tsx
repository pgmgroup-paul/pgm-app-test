import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/server/auth/current-user";
import { serverSupabase } from "@/lib/serverSupabase";
import { StorefrontProductsTable } from "./products-table";

export const dynamic = "force-dynamic";

async function getVisibleProductsForCustomer(customerId: string, customerTier: string | null) {
  // Fetch all products
  const { data: products, error } = await serverSupabase
    .from("products")
    .select("id, sku, sku_var, product_name, category, image, created_at")
    .order("created_at", { ascending: false });

  if (error || !products) {
    console.error("Error fetching products for storefront", error);
    return [] as typeof products;
  }

  // Customers should never see products in the 'Private' category
  const publicProducts = products.filter(
    (p) => (p.category ?? "").toLowerCase() !== "private",
  );

  // For each product, check customer-specific override first, then tier
  const visible: typeof publicProducts = [];

  for (const p of publicProducts) {
    // 1) customer override
    const { data: custPerm, error: custErr } = await serverSupabase
      .from("product_customer_permissions")
      .select("can_view")
      .eq("product_id", p.id)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (custErr) {
      console.error("Error checking customer permission", custErr);
    }

    if (custPerm) {
      if (custPerm.can_view) {
        visible.push(p);
      }
      continue; // skip tier if specific override exists
    }

    // 2) tier rule
    if (customerTier) {
      const { data: tierPerm, error: tierErr } = await serverSupabase
        .from("product_tier_permissions")
        .select("can_view")
        .eq("product_id", p.id)
        .eq("customer_tier", customerTier)
        .maybeSingle();

      if (tierErr) {
        console.error("Error checking tier permission", tierErr);
      }

      if (tierPerm && tierPerm.can_view) {
        visible.push(p);
        continue;
      }
    }

    // 3) default: hidden (do nothing)
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
      return [] as typeof data;
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
