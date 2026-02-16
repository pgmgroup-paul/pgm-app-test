import { notFound, redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/server/auth/current-user";
import { serverSupabase } from "@/lib/serverSupabase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EditProductAlerts } from "./edit-product-alerts";

export const dynamic = "force-dynamic";

interface EditProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

async function updateBasicInfo(formData: FormData) {
  "use server";

  const current = await getCurrentUserProfile();
  const isAllowed =
    current &&
    (current.role === "admin" || (current.role === "staff" && current.staff_type === "operations"));

  if (!isAllowed) {
    redirect("/unauthorized");
  }

  const id = (formData.get("id") || "").toString();
  const sku = (formData.get("sku") || "").toString().trim();
  const skuVarRaw = (formData.get("sku_var") || "").toString().trim();
  const sku_var = skuVarRaw || null;
  const productName = (formData.get("product_name") || "").toString().trim();
  const category = (formData.get("category") || "").toString().trim();
  const upc = (formData.get("upc") || "").toString().trim();
  const image = (formData.get("image") || "").toString().trim();

  if (!sku || !productName || !category || !upc || !image) {
    redirect(`/products/${id}/edit?error=basic_missing`);
  }

  // UPC rule: can be shared only within the same base SKU
  const { data: existingUpcRows, error: upcError } = await serverSupabase
    .from("products")
    .select("id, sku, upc")
    .eq("upc", upc);

  if (upcError) {
    console.error("Error checking existing UPC on update", upcError);
  }

  if (existingUpcRows && existingUpcRows.length > 0) {
    const conflict = existingUpcRows.some((row) => row.id !== id && row.sku !== sku);
    if (conflict) {
      redirect(`/products/${id}/edit?error=basic_fail`);
    }
  }

  const { error } = await serverSupabase
    .from("products")
    .update({
      sku,
      sku_var,
      product_name: productName,
      category,
      upc,
      image,
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating product", error);
    redirect(`/products/${id}/edit?error=basic_fail`);
  }

  redirect(`/products/${id}/edit?tab=basic&success=basic`);
}

async function updateMarketing(formData: FormData) {
  "use server";

  const current = await getCurrentUserProfile();
  const isAllowed =
    current &&
    (current.role === "admin" || (current.role === "staff" && current.staff_type === "operations"));

  if (!isAllowed) {
    redirect("/unauthorized");
  }

  const id = (formData.get("id") || "").toString();

  const packagePicture = (formData.get("package_picture") || "").toString().trim();
  const salesSheet = (formData.get("sales_sheet") || "").toString().trim();
  const productPicture = (formData.get("product_picture") || "").toString().trim();
  const video = (formData.get("video") || "").toString().trim();
  const ecommerceImage = (formData.get("ecommerce_image") || "").toString().trim();

  const updates: { type: string; url: string }[] = [
    { type: "package_picture", url: packagePicture },
    { type: "sales_sheet", url: salesSheet },
    { type: "product_picture", url: productPicture },
    { type: "video", url: video },
    { type: "ecommerce_image", url: ecommerceImage },
  ];

  for (const { type, url } of updates) {
    if (!url) {
      // If the field is empty, we skip for now (could optionally delete the asset)
      continue;
    }

    const { error } = await serverSupabase
      .from("product_marketing_assets")
      .upsert(
        {
          product_id: id,
          type,
          url,
        },
        {
          onConflict: "product_id,type",
        },
      );

    if (error) {
      console.error("Error updating marketing asset", type, error);
      redirect(`/products/${id}/edit?error=marketing_fail`);
    }
  }

  redirect(`/products/${id}/edit?tab=marketing&success=marketing`);
}

async function updatePermissions(formData: FormData) {
  "use server";

  const current = await getCurrentUserProfile();
  const isAllowed =
    current &&
    (current.role === "admin" || (current.role === "staff" && current.staff_type === "operations"));

  if (!isAllowed) {
    redirect("/unauthorized");
  }

  const id = (formData.get("id") || "").toString();

  const allowedTiers = formData.getAll("allowed_tiers").map((v) => v.toString());

  // Clear existing tier permissions for this product
  const { error: delError } = await serverSupabase
    .from("product_tier_permissions")
    .delete()
    .eq("product_id", id);

  if (delError) {
    console.error("Error clearing tier permissions", delError);
    redirect(`/products/${id}/edit?error=permissions_fail&tab=permissions`);
  }

  if (allowedTiers.length > 0) {
    const { error: insError } = await serverSupabase.from("product_tier_permissions").insert(
      allowedTiers.map((tier) => ({
        product_id: id,
        customer_tier: tier,
        can_view: true,
      })),
    );

    if (insError) {
      console.error("Error inserting tier permissions", insError);
      redirect(`/products/${id}/edit?error=permissions_fail&tab=permissions`);
    }
  }

  redirect(`/products/${id}/edit?tab=permissions&success=permissions`);
}

async function updateDimensions(formData: FormData) {
  "use server";

  const current = await getCurrentUserProfile();
  const isAllowed =
    current &&
    (current.role === "admin" || (current.role === "staff" && current.staff_type === "operations"));

  if (!isAllowed) {
    redirect("/unauthorized");
  }

  const id = (formData.get("id") || "").toString();

  // Helpers to parse numbers or null
  const num = (name: string) => {
    const raw = (formData.get(name) || "").toString().trim();
    if (!raw) return null;
    const n = Number(raw.replace(",", "."));
    return Number.isNaN(n) ? null : n;
  };

  // Item
  const itemLength = num("item_length");
  const itemWidth = num("item_width");
  const itemHeight = num("item_height");

  // Package
  const packageLength = num("package_length");
  const packageWidth = num("package_width");
  const packageHeight = num("package_height");
  const packageWeight = num("package_weight");
  const casePack = num("case_pack");

  // Carton
  const cartonLength = num("carton_length");
  const cartonWidth = num("carton_width");
  const cartonHeight = num("carton_height");
  const cartonWeight = num("carton_weight");

  // Pallet
  const palletLength = num("pallet_length");
  const palletWidth = num("pallet_width");
  const palletHeight = num("pallet_height");
  const cartonsPerLayer = num("cartons_per_layer");
  const numberOfLayers = num("number_of_layers");
  const cartonsPerPallet =
    cartonsPerLayer !== null && numberOfLayers !== null
      ? cartonsPerLayer * numberOfLayers
      : null;

  const productId = id;

  // Upsert helper per kind
  const upsertKind = async (kind: string, fields: Record<string, any>) => {
    const hasValue = Object.values(fields).some((v) => v !== null && v !== undefined);
    if (!hasValue) return;

    const { error } = await serverSupabase
      .from("product_dimensions")
      .upsert(
        {
          product_id: productId,
          kind,
          ...fields,
        },
        {
          onConflict: "product_id,kind",
        },
      );

    if (error) {
      console.error("Error updating dimensions", kind, error);
      redirect(`/products/${id}/edit?error=dimensions_fail&tab=dimensions`);
    }
  };

  await upsertKind("item", {
    length: itemLength,
    width: itemWidth,
    height: itemHeight,
    uom_length: "in",
  });

  await upsertKind("package", {
    length: packageLength,
    width: packageWidth,
    height: packageHeight,
    weight: packageWeight,
    units_per: casePack,
    uom_length: "in",
    uom_weight: "lb",
  });

  await upsertKind("carton", {
    length: cartonLength,
    width: cartonWidth,
    height: cartonHeight,
    weight: cartonWeight,
    uom_length: "in",
    uom_weight: "lb",
  });

  await upsertKind("pallet", {
    length: palletLength,
    width: palletWidth,
    height: palletHeight,
    cartons_per_layer: cartonsPerLayer,
    number_of_layers: numberOfLayers,
    cartons_per_pallet: cartonsPerPallet,
    uom_length: "in",
  });

  redirect(`/products/${id}/edit?tab=dimensions&success=dimensions`);
}

interface EditPageSearchParams {
  searchParams?: {
    error?: string;
    tab?: string;
    success?: string;
  };
}

export default async function EditProductPage({ params, searchParams }: EditProductPageProps & EditPageSearchParams) {
  const current = await getCurrentUserProfile();
  const isAllowed =
    current &&
    (current.role === "admin" || (current.role === "staff" && current.staff_type === "operations"));

  if (!isAllowed) {
    redirect("/unauthorized");
  }

  const { id } = await params;

  const { data: product, error: productError } = await serverSupabase
    .from("products")
    .select("id, sku, sku_var, product_name, category, upc, image, created_at")
    .eq("id", id)
    .maybeSingle();

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
    .select("kind, length, width, height, weight, units_per, cartons_per_layer, number_of_layers, cartons_per_pallet")
    .eq("product_id", id);

  const dimByKind = Object.fromEntries((dimensions ?? []).map((d) => [d.kind, d]));

  const { data: tierPerms } = await serverSupabase
    .from("product_tier_permissions")
    .select("customer_tier, can_view")
    .eq("product_id", id);

  const allowedTierSet = new Set((tierPerms ?? []).filter((p) => p.can_view).map((p) => p.customer_tier));

  const { data: tierRows } = await serverSupabase
    .from("profiles")
    .select("customer_tier")
    .not("customer_tier", "is", null);

  const distinctTiers = Array.from(
    new Set((tierRows ?? []).map((r) => r.customer_tier).filter((t): t is string => !!t && t.trim().length > 0)),
  ).sort();

  const activeTab = searchParams?.tab ?? "basic";

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Edit Product</h1>
          <p className="text-sm text-muted-foreground">Update catalog information for this product.</p>
          <p className="text-xs text-muted-foreground font-mono">
            SKU: {product.sku}
            {product.sku_var ? `-${product.sku_var}` : ""}
          </p>
        </div>
        <a
          href="/products"
          className="inline-flex items-center rounded-md border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
        >
          Close
        </a>
      </div>

      <EditProductAlerts />

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
              This is the main product image used in the catalog (from the Image URL field in Basic
              info).
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue={activeTab} className="w-full">
        <TabsList>
          <TabsTrigger value="basic">Basic info</TabsTrigger>
          <TabsTrigger value="marketing">Marketing materials</TabsTrigger>
          <TabsTrigger value="dimensions">Product dimension</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4">
          <div className="space-y-4 rounded-md border p-4">
            <form action={updateBasicInfo} className="space-y-4">
              <input type="hidden" name="id" value={product.id} />

              <div className="space-y-1 text-sm">
                <label htmlFor="sku" className="font-medium">
                  SKU
                </label>
                <input
                  id="sku"
                  name="sku"
                  type="text"
                  defaultValue={product.sku}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1 text-sm">
                <label htmlFor="sku_var" className="font-medium">
                  Color, Size or Variant
                </label>
                <input
                  id="sku_var"
                  name="sku_var"
                  type="text"
                  defaultValue={product.sku_var ?? ""}
                  placeholder="e.g. GREEN, 10oz, Large"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1 text-sm">
                <label htmlFor="product_name" className="font-medium">
                  Product name
                </label>
                <input
                  id="product_name"
                  name="product_name"
                  type="text"
                  defaultValue={product.product_name}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1 text-sm">
                <label htmlFor="category" className="font-medium">
                  Category
                </label>
                <input
                  id="category"
                  name="category"
                  type="text"
                  defaultValue={product.category}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1 text-sm">
                <label htmlFor="upc" className="font-medium">
                  UPC
                </label>
                <input
                  id="upc"
                  name="upc"
                  type="text"
                  defaultValue={product.upc}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1 text-sm">
                <label htmlFor="image" className="font-medium">
                  Image URL
                </label>
                <input
                  id="image"
                  name="image"
                  type="url"
                  defaultValue={product.image ?? ""}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Save basic info
              </button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="marketing" className="mt-4">
          <div className="space-y-4 rounded-md border p-4">
            <form action={updateMarketing} className="space-y-4">
              <input type="hidden" name="id" value={product.id} />

              <div className="space-y-1 text-sm">
                <label htmlFor="package_picture" className="font-medium">
                  Package picture URL
                </label>
                <input
                  id="package_picture"
                  name="package_picture"
                  type="url"
                  defaultValue={(assetsByType["package_picture"] as string | undefined) ?? ""}
                  placeholder="https://..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1 text-sm">
                <label htmlFor="sales_sheet" className="font-medium">
                  Sales sheet URL
                </label>
                <input
                  id="sales_sheet"
                  name="sales_sheet"
                  type="url"
                  defaultValue={(assetsByType["sales_sheet"] as string | undefined) ?? ""}
                  placeholder="https://..." 
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1 text-sm">
                <label htmlFor="product_picture" className="font-medium">
                  Product picture URL
                </label>
                <input
                  id="product_picture"
                  name="product_picture"
                  type="url"
                  defaultValue={(assetsByType["product_picture"] as string | undefined) ?? ""}
                  placeholder="https://..." 
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1 text-sm">
                <label htmlFor="video" className="font-medium">
                  Video URL
                </label>
                <input
                  id="video"
                  name="video"
                  type="url"
                  defaultValue={(assetsByType["video"] as string | undefined) ?? ""}
                  placeholder="https://..." 
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1 text-sm">
                <label htmlFor="ecommerce_image" className="font-medium">
                  E-commerce image URL
                </label>
                <input
                  id="ecommerce_image"
                  name="ecommerce_image"
                  type="url"
                  defaultValue={(assetsByType["ecommerce_image"] as string | undefined) ?? ""}
                  placeholder="https://..." 
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Save marketing materials
              </button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="dimensions" className="mt-4">
          <div className="space-y-4 rounded-md border p-4">
            <form action={updateDimensions} className="space-y-6">
              <input type="hidden" name="id" value={product.id} />

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3 text-sm">
                  <h2 className="font-medium">Item dimensions</h2>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label htmlFor="item_length" className="block text-xs font-medium">
                        Length
                      </label>
                      <input
                        id="item_length"
                        name="item_length"
                        type="number"
                        step="0.01"
                        defaultValue={(dimByKind["item"]?.length as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="item_width" className="block text-xs font-medium">
                        Width
                      </label>
                      <input
                        id="item_width"
                        name="item_width"
                        type="number"
                        step="0.01"
                        defaultValue={(dimByKind["item"]?.width as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="item_height" className="block text-xs font-medium">
                        Height
                      </label>
                      <input
                        id="item_height"
                        name="item_height"
                        type="number"
                        step="0.01"
                        defaultValue={(dimByKind["item"]?.height as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Units: inches.</p>
                </div>

                <div className="space-y-3 text-sm">
                  <h2 className="font-medium">Package dimensions</h2>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label htmlFor="package_length" className="block text-xs font-medium">
                        Length
                      </label>
                      <input
                        id="package_length"
                        name="package_length"
                        type="number"
                        step="0.01"
                        defaultValue={(dimByKind["package"]?.length as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="package_width" className="block text-xs font-medium">
                        Width
                      </label>
                      <input
                        id="package_width"
                        name="package_width"
                        type="number"
                        step="0.01"
                        defaultValue={(dimByKind["package"]?.width as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="package_height" className="block text-xs font-medium">
                        Height
                      </label>
                      <input
                        id="package_height"
                        name="package_height"
                        type="number"
                        step="0.01"
                        defaultValue={(dimByKind["package"]?.height as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label htmlFor="package_weight" className="block text-xs font-medium">
                        Weight
                      </label>
                      <input
                        id="package_weight"
                        name="package_weight"
                        type="number"
                        step="0.01"
                        defaultValue={(dimByKind["package"]?.weight as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Units: inches, pounds.</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3 text-sm">
                  <h2 className="font-medium">Carton dimensions</h2>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label htmlFor="carton_length" className="block text-xs font-medium">
                        Length
                      </label>
                      <input
                        id="carton_length"
                        name="carton_length"
                        type="number"
                        step="0.01"
                        defaultValue={(dimByKind["carton"]?.length as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="carton_width" className="block text-xs font-medium">
                        Width
                      </label>
                      <input
                        id="carton_width"
                        name="carton_width"
                        type="number"
                        step="0.01"
                        defaultValue={(dimByKind["carton"]?.width as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="carton_height" className="block text-xs font-medium">
                        Height
                      </label>
                      <input
                        id="carton_height"
                        name="carton_height"
                        type="number"
                        step="0.01"
                        defaultValue={(dimByKind["carton"]?.height as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <label htmlFor="carton_weight" className="block text-xs font-medium">
                        Weight
                      </label>
                      <input
                        id="carton_weight"
                        name="carton_weight"
                        type="number"
                        step="0.01"
                        defaultValue={(dimByKind["carton"]?.weight as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="case_pack" className="block text-xs font-medium">
                        Case pack
                      </label>
                      <input
                        id="case_pack"
                        name="case_pack"
                        type="number"
                        step="1"
                        defaultValue={(dimByKind["package"]?.units_per as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Units: inches, pounds.</p>
                </div>

                <div className="space-y-3 text-sm">
                  <h2 className="font-medium">Pallet dimensions</h2>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label htmlFor="pallet_length" className="block text-xs font-medium">
                        Length
                      </label>
                      <input
                        id="pallet_length"
                        name="pallet_length"
                        type="number"
                        step="0.01"
                        defaultValue={(dimByKind["pallet"]?.length as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="pallet_width" className="block text-xs font-medium">
                        Width
                      </label>
                      <input
                        id="pallet_width"
                        name="pallet_width"
                        type="number"
                        step="0.01"
                        defaultValue={(dimByKind["pallet"]?.width as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="pallet_height" className="block text-xs font-medium">
                        Height
                      </label>
                      <input
                        id="pallet_height"
                        name="pallet_height"
                        type="number"
                        step="0.01"
                        defaultValue={(dimByKind["pallet"]?.height as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <label htmlFor="cartons_per_layer" className="block text-xs font-medium">
                        Cartons / layer
                      </label>
                      <input
                        id="cartons_per_layer"
                        name="cartons_per_layer"
                        type="number"
                        step="1"
                        defaultValue={(dimByKind["pallet"]?.cartons_per_layer as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="number_of_layers" className="block text-xs font-medium">
                        Layers
                      </label>
                      <input
                        id="number_of_layers"
                        name="number_of_layers"
                        type="number"
                        step="1"
                        defaultValue={(dimByKind["pallet"]?.number_of_layers as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="cartons_per_pallet" className="block text-xs font-medium">
                        Cartons / pallet
                      </label>
                      <input
                        id="cartons_per_pallet"
                        type="number"
                        step="1"
                        readOnly
                        value={(dimByKind["pallet"]?.cartons_per_pallet as number | undefined) ?? ""}
                        className="w-full rounded-md border border-input bg-muted px-2 py-1 text-xs shadow-sm outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Units: inches.</p>
                </div>
              </div>

              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Save dimensions
              </button>
            </form>
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="mt-4">
          <div className="space-y-4 rounded-md border p-4 text-sm">
            <p className="text-xs text-muted-foreground">
              Products are <span className="font-semibold">hidden by default</span> for customers.
              Use the checkboxes below to allow specific customer tiers to see this product.
              Admins and staff can always see all products.
            </p>

            {distinctTiers.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No customer tiers found. Set <code>customer_tier</code> values on profiles first.
              </p>
            ) : (
              <form action={updatePermissions} className="space-y-4">
                <input type="hidden" name="id" value={product.id} />

                <div className="grid gap-2 md:grid-cols-2">
                  {distinctTiers.map((tier) => (
                    <label key={tier} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        name="allowed_tiers"
                        value={tier}
                        defaultChecked={allowedTierSet.has(tier)}
                        className="h-3 w-3 rounded border border-input"
                      />
                      <span>{tier}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Save permissions
                </button>
              </form>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
