import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

import { StorefrontProductsTable } from "./products-table";

export const dynamic = "force-dynamic";

// Helper: fetch all non-private products
async function getPublicProducts() {
  const { data, error } = await serverSupabase
    .from("products")
    .select("id, sku, sku_var, product_name, category, image, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("STORE FRONT: error fetching products", error);
    return [] as any[];
  }

  const publicProducts = (data ?? []).filter((p) => (p.category ?? "").toLowerCase() !== "private");

  console.log("STORE FRONT: public products", {
    count: publicProducts.length,
  });

  return publicProducts;
}

// Customers: filtered by tier/customer permissions
async function getVisibleProductsForCustomer(customerId: string, customerTier: string | null) {
  const publicProducts = await getPublicProducts();

  if (publicProducts.length === 0) return [];

  const productIds = publicProducts.map((p) => p.id as string);

  // Customer-specific overrides (no .in() to avoid huge header URLs; filter in memory)
  const { data: customerPerms } = await serverSupabase
    .from("product_customer_permissions")
    .select("product_id, can_view")
    .eq("customer_id", customerId);

  const publicIdSet = new Set(productIds);

  const customerPermMap = new Map<string, boolean>();
  for (const row of customerPerms ?? []) {
    const pid = row.product_id as string;
    if (!publicIdSet.has(pid)) continue;
    customerPermMap.set(pid, !!row.can_view);
  }

  // Tier permissions (same: load by tier, filter to public ids in memory)
  let tierPerms: any[] = [];
  if (customerTier) {
    const { data: tierData, error: tierError } = await serverSupabase
      .from("product_tier_permissions")
      .select("product_id, can_view")
      .eq("customer_tier", customerTier);

    if (tierError) {
      console.error("STORE FRONT: error fetching tier permissions", tierError);
    }

    tierPerms = tierData ?? [];
  }

  const tierPermMap = new Map<string, boolean>();
  for (const row of tierPerms ?? []) {
    const pid = row.product_id as string;
    if (!publicIdSet.has(pid)) continue;
    tierPermMap.set(pid, !!row.can_view);
  }

  console.log("STORE FRONT: permission maps", {
    customerId,
    customerTier,
    publicCount: publicProducts.length,
    customerPerms: customerPermMap.size,
    tierPerms: tierPermMap.size,
  });

  const visible: any[] = [];

  for (const p of publicProducts) {
    const pid = p.id as string;

    const customerOverride = customerPermMap.has(pid) ? customerPermMap.get(pid) : undefined;

    if (customerOverride !== undefined) {
      if (customerOverride) {
        visible.push(p);
      }
      continue; // skip tier if specific override exists
    }

    const tierCanView = tierPermMap.get(pid);
    if (tierCanView) {
      visible.push(p);
    }
    // default: hidden
  }

  console.log("STORE FRONT: visible products for customer", {
    customerId,
    customerTier,
    visibleCount: visible.length,
  });

  return visible;
}

// Role-based data fetch
async function getProductsForProfile() {
  let profile: any = null;

  try {
    profile = await getCurrentUserProfile();
  } catch (err) {
    console.error("STORE FRONT: error getting current profile", err);
  }

  console.log("STORE FRONT: profile", {
    id: profile?.id,
    email: profile?.email,
    role: profile?.role,
    customer_tier: profile?.customer_tier,
  });

  // Admin / staff: see all products (including Private)
  if (profile && (profile.role === "admin" || profile.role === "staff")) {
    const { data, error } = await serverSupabase
      .from("products")
      .select("id, sku, sku_var, product_name, category, image, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("STORE FRONT: error fetching products (staff)", error);
      return [];
    }

    return data ?? [];
  }

  // Customers: permission-filtered
  if (profile && profile.role === "customer") {
    return await getVisibleProductsForCustomer(profile.id, profile.customer_tier);
  }

  // Anonymous or other roles: show public catalog
  return await getPublicProducts();
}

export default async function StorefrontProductsPage() {
  const products = await getProductsForProfile();

  return (
    <div className="space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Products</h1>
        <p className="text-muted-foreground text-sm">Browse products available in the catalog.</p>
      </div>

      {/* Simple client-side search/filter/sort like Profiles page */}
      {/* We keep this page server-rendered for data, but the controls will be client-side */}

      {products.length === 0 ? (
        <p className="text-muted-foreground text-sm">No products available.</p>
      ) : (
        <StorefrontProductsTable products={products as any} />
      )}
    </div>
  );
}
