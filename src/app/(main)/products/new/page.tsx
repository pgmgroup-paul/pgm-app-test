import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

import { ImageField } from "../image-field";
import { UpcField } from "../upc-field";
import { NewProductErrors } from "./new-product-errors";

// Convert a string to Title Case while preserving punctuation and spacing.
// Example: 10" QUESADILLA MAKER ( RED) -> 10" Quesadilla Maker ( Red)
function toTitleCasePreservePunctuation(value: string): string {
  if (!value) return value;

  return value
    .split(" ")
    .map((word) => {
      if (word.length === 0) return word;
      const first = word[0];
      const rest = word.slice(1);
      return first.toUpperCase() + rest.toLowerCase();
    })
    .join(" ");
}

async function createProduct(formData: FormData) {
  "use server";

  const current = await getCurrentUserProfile();
  const isAllowed =
    current && (current.role === "admin" || (current.role === "staff" && current.staff_type === "operations"));

  if (!isAllowed) {
    redirect("/unauthorized");
  }

  const sku = (formData.get("sku") || "").toString().trim();
  const skuVarRaw = (formData.get("sku_var") || "").toString().trim();
  const sku_var = skuVarRaw || null;
  const rawProductName = (formData.get("product_name") || "").toString().trim();
  const productName = toTitleCasePreservePunctuation(rawProductName);
  const category = (formData.get("category") || "").toString().trim();
  const upc = (formData.get("upc") || "").toString().trim();
  const image = (formData.get("image") || "").toString().trim();

  if (!sku || !productName || !category || !upc || !image) {
    console.error("All fields are required to create a product");
    redirect("/products/new?error=missing");
  }

  // Check for existing product with same (sku, sku_var)
  let existingSku = null as any;
  if (sku_var === null) {
    const { data, error } = await serverSupabase
      .from("products")
      .select("id, sku, sku_var")
      .eq("sku", sku)
      .is("sku_var", null)
      .maybeSingle();
    if (error) console.error("Error checking existing SKU", error);
    existingSku = data;
  } else {
    const { data, error } = await serverSupabase
      .from("products")
      .select("id, sku, sku_var")
      .eq("sku", sku)
      .eq("sku_var", sku_var)
      .maybeSingle();
    if (error) console.error("Error checking existing SKU+variant", error);
    existingSku = data;
  }

  if (existingSku) {
    redirect("/products/new?error=sku");
  }

  // Check UPC: it can repeat only within the same base SKU
  const { data: existingUpcRows, error: upcError } = await serverSupabase
    .from("products")
    .select("id, sku, upc")
    .eq("upc", upc);

  if (upcError) {
    console.error("Error checking existing UPC", upcError);
  }

  if (existingUpcRows && existingUpcRows.length > 0) {
    const conflict = existingUpcRows.some((row) => row.sku !== sku);
    if (conflict) {
      redirect("/products/new?error=upc");
    }
  }

  const { error } = await serverSupabase.from("products").insert({
    sku,
    sku_var,
    product_name: productName,
    category,
    upc,
    image,
  });

  if (error) {
    console.error("Error creating product", error);
    redirect("/products/new?error=unknown");
  }

  // On success, stay on the same page and indicate success via search params.
  redirect("/products/new?success=1");
}

async function loadDistinctCategories(): Promise<string[]> {
  const { data, error } = await serverSupabase
    .from("products")
    .select("category")
    .not("category", "is", null)
    .order("category", { ascending: true });

  if (error) {
    console.error("Error loading distinct categories for /products/new", error);
    return [];
  }

  const seen = new Set<string>();
  const categories: string[] = [];

  for (const row of data || []) {
    const cat = (row.category as string | null) || null;
    if (!cat) continue;
    if (!seen.has(cat)) {
      seen.add(cat);
      categories.push(cat);
    }
  }

  return categories;
}

interface NewProductPageProps {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}

export default async function NewProductPage({ searchParams }: NewProductPageProps) {
  const params = await searchParams;
  const success = params.success === "1";

  const current = await getCurrentUserProfile();
  const isAllowed =
    current && (current.role === "admin" || (current.role === "staff" && current.staff_type === "operations"));

  if (!isAllowed) {
    redirect("/unauthorized");
  }

  const categories = await loadDistinctCategories();

  return (
    <div className="max-w-xl space-y-6 p-6">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Add Product</h1>
        <p className="text-muted-foreground text-sm">Create a new catalog product.</p>
        <NewProductErrors />
      </div>

      <div className="space-y-4 rounded-md border p-4">
        <form action={createProduct} className="space-y-4">
          <div className="space-y-1 text-sm">
            <label htmlFor="sku" className="font-medium">
              SKU
            </label>
            <input
              id="sku"
              name="sku"
              type="text"
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
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1 text-sm">
            <label htmlFor="category" className="font-medium">
              Category
            </label>
            <select
              id="category"
              name="category"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              defaultValue=""
            >
              <option value="" disabled>
                Select a category
              </option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <UpcField />

          <ImageField />

          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
          >
            Save product
          </button>

          {success && <p className="mt-2 text-emerald-700 text-xs">Product created successfully</p>}
        </form>
      </div>
    </div>
  );
}
