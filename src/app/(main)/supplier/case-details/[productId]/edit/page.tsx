import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

import { saveCaseDetails } from "./actions";

export const dynamic = "force-dynamic";

export default async function SupplierCaseDetailsEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "supplier")) {
    return <div className="p-6 text-destructive text-sm">Not authorized to view this page.</div>;
  }

  const { productId } = await params;
  const { saved } = await searchParams;

  const { data: product, error: prodError } = await serverSupabase
    .from("products")
    .select("id, sku, sku_var, product_name")
    .eq("id", productId)
    .maybeSingle();

  if (prodError || !product) {
    console.error("Error loading product for case details edit", prodError);
    return <div className="p-6 text-destructive text-sm">Product not found.</div>;
  }

  const { data: dims, error: dimsError } = await serverSupabase
    .from("product_dimensions")
    .select("id, length, width, height, weight, units_per, uom_length, uom_weight")
    .eq("product_id", productId)
    .eq("kind", "case")
    .maybeSingle();

  if (dimsError) {
    console.error("Error loading case dims", dimsError);
  }

  const d: any = dims || {};
  const complete =
    (Number(d.length) || 0) > 0 &&
    (Number(d.width) || 0) > 0 &&
    (Number(d.height) || 0) > 0 &&
    (Number(d.weight) || 0) > 0 &&
    (Number(d.units_per) || 0) > 0;

  if (complete) {
    return (
      <div className="max-w-xl space-y-4 p-6">
        <div className="space-y-1">
          <h1 className="font-semibold text-lg tracking-tight">Case details</h1>
          <p className="text-muted-foreground text-sm">
            {product.sku} {product.sku_var && <span>/ {product.sku_var}</span>} – {product.product_name}
          </p>
        </div>
        <div className="rounded-md border px-3 py-3 text-muted-foreground text-xs">
          Case details are already complete for this product. Please contact the office if they need to be changed.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg tracking-tight">Enter case details</h1>
        <p className="text-muted-foreground text-sm">
          {product.sku} {product.sku_var && <span>/ {product.sku_var}</span>} – {product.product_name}
        </p>
      </div>

      {saved && <p className="text-[11px] text-emerald-700">Case details saved.</p>}

      <form action={saveCaseDetails} className="space-y-3 rounded-md border px-3 py-3 text-xs">
        <input type="hidden" name="product_id" value={product.id as string} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="length" className="font-medium">
              Length
            </label>
            <input
              id="length"
              name="length"
              type="number"
              step="0.01"
              defaultValue={d.length ?? ""}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="width" className="font-medium">
              Width
            </label>
            <input
              id="width"
              name="width"
              type="number"
              step="0.01"
              defaultValue={d.width ?? ""}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="height" className="font-medium">
              Height
            </label>
            <input
              id="height"
              name="height"
              type="number"
              step="0.01"
              defaultValue={d.height ?? ""}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="weight" className="font-medium">
              Weight
            </label>
            <input
              id="weight"
              name="weight"
              type="number"
              step="0.01"
              defaultValue={d.weight ?? ""}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="units_per" className="font-medium">
              Units per case
            </label>
            <input
              id="units_per"
              name="units_per"
              type="number"
              step="1"
              min="0"
              defaultValue={d.units_per ?? ""}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="pt-2 text-[10px] text-muted-foreground">Length UOM: in (fixed) · Weight UOM: lb (fixed)</div>

        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
        >
          Save case details
        </button>
      </form>
    </div>
  );
}
