import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export default async function SupplierCaseDetailsViewPage({ params }: { params: Promise<{ productId: string }> }) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "supplier")) {
    return <div className="p-6 text-destructive text-sm">Not authorized to view this page.</div>;
  }

  const { productId } = await params;

  const { data: product, error: prodError } = await serverSupabase
    .from("products")
    .select("id, sku, sku_var, product_name")
    .eq("id", productId)
    .maybeSingle();

  if (prodError || !product) {
    console.error("Error loading product for case details view", prodError);
    return <div className="p-6 text-destructive text-sm">Product not found.</div>;
  }

  const { data: dims, error: dimsError } = await serverSupabase
    .from("product_dimensions")
    .select("kind, length, width, height, weight, units_per, uom_length, uom_weight")
    .eq("product_id", productId);

  if (dimsError) {
    console.error("Error loading product dimensions for view", dimsError);
  }

  const rows = dims || [];

  // For viewing, treat dimensions + weight as coming from a carton/case/package row,
  // and units_per (case pack) from any row.
  const cartonLike = rows.find((d) => {
    const kind = (d as any).kind as string | undefined;
    const isCaseLikeKind = kind === "carton" || kind === "case" || kind === "package";
    const length = Number(d.length) || 0;
    const width = Number(d.width) || 0;
    const height = Number(d.height) || 0;
    const weight = Number(d.weight) || 0;
    return isCaseLikeKind && length > 0 && width > 0 && height > 0 && weight > 0;
  });

  const unitsRow = rows.find((d) => (Number(d.units_per) || 0) > 0);

  const complete = cartonLike && unitsRow;

  return (
    <div className="max-w-xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg tracking-tight">Case details</h1>
        <p className="text-muted-foreground text-sm">
          {product.sku} {product.sku_var && <span>/ {product.sku_var}</span>} – {product.product_name}
        </p>
      </div>

      {!complete ? (
        <div className="rounded-md border px-3 py-3 text-destructive text-xs">
          Case details are not fully configured for this product.
        </div>
      ) : (
        <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Length</div>
              <div className="text-[11px]">
                {cartonLike?.length} {(cartonLike as any).uom_length || "in"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Width</div>
              <div className="text-[11px]">{cartonLike?.width}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Height</div>
              <div className="text-[11px]">{cartonLike?.height}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Weight</div>
              <div className="text-[11px]">
                {cartonLike?.weight} {(cartonLike as any).uom_weight || "lb"}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] text-muted-foreground">Units per case</div>
              <div className="text-[11px]">{unitsRow?.units_per}</div>
            </div>
          </div>
          <div className="pt-2 text-[10px] text-muted-foreground">
            Dims from kind: {(cartonLike as any).kind}; Units per case from kind: {(unitsRow as any).kind}
          </div>
        </div>
      )}
    </div>
  );
}
