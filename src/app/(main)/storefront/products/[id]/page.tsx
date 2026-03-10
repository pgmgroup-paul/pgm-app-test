import { notFound, redirect } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

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
    .select(
      "kind, length, width, height, weight, units_per, cartons_per_layer, number_of_layers, cartons_per_pallet, uom_length, uom_weight",
    )
    .eq("product_id", id);

  const dimByKind = Object.fromEntries((dimensions ?? []).map((d) => [d.kind, d]));

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-semibold text-2xl tracking-tight">Product details</h1>
          <p className="text-muted-foreground text-sm">View product information.</p>
          <p className="font-mono text-muted-foreground text-xs">
            SKU: {product.sku}
            {product.sku_var ? `-${product.sku_var}` : ""}
          </p>
        </div>
        <a
          href={backHref}
          className="inline-flex items-center rounded-md border border-input px-3 py-1.5 font-medium text-foreground text-sm hover:bg-muted"
        >
          Back to products
        </a>
      </div>

      {product.image && (
        <div className="flex items-center gap-4 rounded-md border bg-muted/40 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image}
            alt={product.product_name}
            className="h-28 w-28 rounded border bg-background object-cover"
          />
          <div className="space-y-1 text-sm">
            <div className="font-medium">Primary image</div>
            <p className="text-muted-foreground text-xs">Main product image from the catalog.</p>
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
              <div className="font-medium text-muted-foreground text-xs">Product name</div>
              <div>{product.product_name}</div>
            </div>
            <div>
              <div className="font-medium text-muted-foreground text-xs">Category</div>
              <div>{product.category}</div>
            </div>
            <div>
              <div className="font-medium text-muted-foreground text-xs">UPC</div>
              <div className="font-mono text-xs">{product.upc}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="marketing" className="mt-4">
          <div className="space-y-4 rounded-md border p-4 text-sm">
            <div>
              <div className="font-medium text-muted-foreground text-xs">Package picture</div>
              {assetsByType.package_picture ? (
                <a
                  href={assetsByType.package_picture as string}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary text-xs hover:underline"
                >
                  {assetsByType.package_picture as string}
                </a>
              ) : (
                <p className="text-muted-foreground text-xs">No link set.</p>
              )}
            </div>
            <div>
              <div className="font-medium text-muted-foreground text-xs">Sales sheet</div>
              {assetsByType.sales_sheet ? (
                <a
                  href={assetsByType.sales_sheet as string}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary text-xs hover:underline"
                >
                  {assetsByType.sales_sheet as string}
                </a>
              ) : (
                <p className="text-muted-foreground text-xs">No link set.</p>
              )}
            </div>
            <div>
              <div className="font-medium text-muted-foreground text-xs">Product picture</div>
              {assetsByType.product_picture ? (
                <a
                  href={assetsByType.product_picture as string}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary text-xs hover:underline"
                >
                  {assetsByType.product_picture as string}
                </a>
              ) : (
                <p className="text-muted-foreground text-xs">No link set.</p>
              )}
            </div>
            <div>
              <div className="font-medium text-muted-foreground text-xs">Video</div>
              {assetsByType.video ? (
                <a
                  href={assetsByType.video as string}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary text-xs hover:underline"
                >
                  {assetsByType.video as string}
                </a>
              ) : (
                <p className="text-muted-foreground text-xs">No link set.</p>
              )}
            </div>
            <div>
              <div className="font-medium text-muted-foreground text-xs">E-commerce image</div>
              {assetsByType.ecommerce_image ? (
                <a
                  href={assetsByType.ecommerce_image as string}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary text-xs hover:underline"
                >
                  {assetsByType.ecommerce_image as string}
                </a>
              ) : (
                <p className="text-muted-foreground text-xs">No link set.</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="dimensions" className="mt-4">
          <div className="space-y-4 rounded-md border p-4 text-sm">
            <div>
              <h2 className="font-medium text-sm">Item</h2>
              <p className="text-muted-foreground text-xs">
                Length/Width/Height ({dimByKind.item?.uom_length ?? "in"})
              </p>
              <p className="text-xs">
                {dimByKind.item?.length ?? "-"} × {dimByKind.item?.width ?? "-"} × {dimByKind.item?.height ?? "-"}
              </p>
            </div>
            <div>
              <h2 className="font-medium text-sm">Package</h2>
              <p className="text-muted-foreground text-xs">
                L/W/H ({dimByKind.package?.uom_length ?? "in"}), Weight ({dimByKind.package?.uom_weight ?? "lb"})
              </p>
              <p className="text-xs">
                {dimByKind.package?.length ?? "-"} × {dimByKind.package?.width ?? "-"} ×{" "}
                {dimByKind.package?.height ?? "-"}, {dimByKind.package?.weight ?? "-"}{" "}
                {dimByKind.package?.uom_weight ?? "lb"}
              </p>
              <p className="text-muted-foreground text-xs">Case pack: {dimByKind.package?.units_per ?? "-"}</p>
            </div>
            <div>
              <h2 className="font-medium text-sm">Carton</h2>
              <p className="text-muted-foreground text-xs">
                L/W/H ({dimByKind.carton?.uom_length ?? "in"}), Weight ({dimByKind.carton?.uom_weight ?? "lb"})
              </p>
              <p className="text-xs">
                {dimByKind.carton?.length ?? "-"} × {dimByKind.carton?.width ?? "-"} × {dimByKind.carton?.height ?? "-"}
                , {dimByKind.carton?.weight ?? "-"} {dimByKind.carton?.uom_weight ?? "lb"}
              </p>
            </div>
            <div>
              <h2 className="font-medium text-sm">Pallet</h2>
              <p className="text-muted-foreground text-xs">L/W/H ({dimByKind.pallet?.uom_length ?? "in"})</p>
              <p className="text-xs">
                {dimByKind.pallet?.length ?? "-"} × {dimByKind.pallet?.width ?? "-"} × {dimByKind.pallet?.height ?? "-"}
              </p>
              <p className="text-muted-foreground text-xs">
                Cartons / layer: {dimByKind.pallet?.cartons_per_layer ?? "-"}, Layers:{" "}
                {dimByKind.pallet?.number_of_layers ?? "-"}
              </p>
              <p className="text-muted-foreground text-xs">
                Cartons / pallet: {dimByKind.pallet?.cartons_per_pallet ?? "-"}
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
