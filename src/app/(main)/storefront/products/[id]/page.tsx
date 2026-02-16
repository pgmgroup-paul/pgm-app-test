import { notFound, redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/server/auth/current-user";
import { serverSupabase } from "@/lib/serverSupabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

interface ProductDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

async function canCustomerViewProduct(productId: string, customerId: string, customerTier: string | null) {
  // 1) customer-specific override
  const { data: custPerm, error: custErr } = await serverSupabase
    .from("product_customer_permissions")
    .select("can_view")
    .eq("product_id", productId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (custErr) {
    console.error("Error checking customer permission", custErr);
  }

  if (custPerm) {
    return custPerm.can_view;
  }

  // 2) tier rule
  if (customerTier) {
    const { data: tierPerm, error: tierErr } = await serverSupabase
      .from("product_tier_permissions")
      .select("can_view")
      .eq("product_id", productId)
      .eq("customer_tier", customerTier)
      .maybeSingle();

    if (tierErr) {
      console.error("Error checking tier permission", tierErr);
    }

    if (tierPerm) {
      return tierPerm.can_view;
    }
  }

  // 3) default hidden
  return false;
}

export default async function StorefrontProductDetailsPage({ params }: ProductDetailsPageProps) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/v1/login");
  }

  const { id } = await params;

  // Permission check for customers
  if (profile.role === "customer") {
    const allowed = await canCustomerViewProduct(id, profile.id, profile.customer_tier);
    if (!allowed) {
      notFound();
    }
  }

  // Admin/staff: allowed; others (e.g. supplier) -> simple 404 for now
  if (profile.role !== "admin" && profile.role !== "staff" && profile.role !== "customer") {
    notFound();
  }

  const backHref = profile.role === "customer" ? "/storefront/products" : "/products";

  const { data: product, error: productError } = await serverSupabase
    .from("products")
    .select("id, sku, sku_var, product_name, category, upc, image, created_at")
    .eq("id", id)
    .maybeSingle();

  if (productError || !product) {
    console.error("Product not found", productError);
    notFound();
  }

  // Customers must never see 'Private' products
  if (profile.role === "customer" && (product.category ?? "").toLowerCase() === "private") {
    notFound();
  }

  if (productError || !product) {
    console.error("Product not found", productError);
    notFound();
  }

  const { data: marketingAssets } = await serverSupabase
    .from("product_marketing_assets")
    .select("type, url")
    .eq("product_id", id);

  const assetsByType = Object.fromEntries((marketingAssets ?? []).map((a) => [a.type, a.url]));

  const { data: dimensions } = await serverSupabase
    .from("product_dimensions")
    .select("kind, length, width, height, weight, units_per, cartons_per_layer, number_of_layers, cartons_per_pallet, uom_length, uom_weight")
    .eq("product_id", id);

  const dimByKind = Object.fromEntries((dimensions ?? []).map((d) => [d.kind, d]));

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Product details</h1>
          <p className="text-sm text-muted-foreground">View product information.
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            SKU: {product.sku}
            {product.sku_var ? `-${product.sku_var}` : ""}
          </p>
        </div>
        <a
          href={backHref}
          className="inline-flex items-center rounded-md border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          Back to products
        </a>
      </div>

      {product.image && (
        <div className="rounded-md border bg-muted/40 p-3 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image}
            alt={product.product_name}
            className="h-28 w-28 rounded border object-cover bg-background"
          />
          <div className="space-y-1 text-sm">
            <div className="font-medium">Primary image</div>
            <p className="text-xs text-muted-foreground">
              Main product image from the catalog.
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="basic" className="w-full">
        <TabsList>
          <TabsTrigger value="basic">Basic info</TabsTrigger>
          <TabsTrigger value="marketing">Marketing materials</TabsTrigger>
          <TabsTrigger value="dimensions">Product dimensions</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <div className="space-y-3 rounded-md border p-4 text-sm">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Product name</div>
              <div>{product.product_name}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Category</div>
              <div>{product.category}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">UPC</div>
              <div className="font-mono text-xs">{product.upc}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="marketing" className="mt-4">
          <div className="space-y-4 rounded-md border p-4 text-sm">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Package picture</div>
              {assetsByType["package_picture"] ? (
                <a
                  href={assetsByType["package_picture"] as string}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-xs hover:underline break-all"
                >
                  {assetsByType["package_picture"] as string}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">No link set.</p>
              )}
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Sales sheet</div>
              {assetsByType["sales_sheet"] ? (
                <a
                  href={assetsByType["sales_sheet"] as string}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-xs hover:underline break-all"
                >
                  {assetsByType["sales_sheet"] as string}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">No link set.</p>
              )}
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Product picture</div>
              {assetsByType["product_picture"] ? (
                <a
                  href={assetsByType["product_picture"] as string}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-xs hover:underline break-all"
                >
                  {assetsByType["product_picture"] as string}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">No link set.</p>
              )}
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Video</div>
              {assetsByType["video"] ? (
                <a
                  href={assetsByType["video"] as string}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-xs hover:underline break-all"
                >
                  {assetsByType["video"] as string}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">No link set.</p>
              )}
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">E-commerce image</div>
              {assetsByType["ecommerce_image"] ? (
                <a
                  href={assetsByType["ecommerce_image"] as string}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-xs hover:underline break-all"
                >
                  {assetsByType["ecommerce_image"] as string}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">No link set.</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="dimensions" className="mt-4">
          <div className="space-y-4 rounded-md border p-4 text-sm">
            <div>
              <h2 className="text-sm font-medium">Item</h2>
              <p className="text-xs text-muted-foreground">
                Length/Width/Height ({dimByKind["item"]?.uom_length ?? "in"})
              </p>
              <p className="text-xs">
                {dimByKind["item"]?.length ?? "-"} × {dimByKind["item"]?.width ?? "-"} × {dimByKind["item"]?.height ?? "-"}
              </p>
            </div>
            <div>
              <h2 className="text-sm font-medium">Package</h2>
              <p className="text-xs text-muted-foreground">
                L/W/H ({dimByKind["package"]?.uom_length ?? "in"}), Weight ({dimByKind["package"]?.uom_weight ?? "lb"})
              </p>
              <p className="text-xs">
                {dimByKind["package"]?.length ?? "-"} × {dimByKind["package"]?.width ?? "-"} × {dimByKind["package"]?.height ?? "-"},
                {" "}
                {dimByKind["package"]?.weight ?? "-"} {dimByKind["package"]?.uom_weight ?? "lb"}
              </p>
              <p className="text-xs text-muted-foreground">
                Case pack: {dimByKind["package"]?.units_per ?? "-"}
              </p>
            </div>
            <div>
              <h2 className="text-sm font-medium">Carton</h2>
              <p className="text-xs text-muted-foreground">
                L/W/H ({dimByKind["carton"]?.uom_length ?? "in"}), Weight ({dimByKind["carton"]?.uom_weight ?? "lb"})
              </p>
              <p className="text-xs">
                {dimByKind["carton"]?.length ?? "-"} × {dimByKind["carton"]?.width ?? "-"} × {dimByKind["carton"]?.height ?? "-"},
                {" "}
                {dimByKind["carton"]?.weight ?? "-"} {dimByKind["carton"]?.uom_weight ?? "lb"}
              </p>
            </div>
            <div>
              <h2 className="text-sm font-medium">Pallet</h2>
              <p className="text-xs text-muted-foreground">
                L/W/H ({dimByKind["pallet"]?.uom_length ?? "in"})
              </p>
              <p className="text-xs">
                {dimByKind["pallet"]?.length ?? "-"} × {dimByKind["pallet"]?.width ?? "-"} × {dimByKind["pallet"]?.height ?? "-"}
              </p>
              <p className="text-xs text-muted-foreground">
                Cartons / layer: {dimByKind["pallet"]?.cartons_per_layer ?? "-"}, Layers: {dimByKind["pallet"]?.number_of_layers ?? "-"}
              </p>
              <p className="text-xs text-muted-foreground">
                Cartons / pallet: {dimByKind["pallet"]?.cartons_per_pallet ?? "-"}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
