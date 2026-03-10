import Link from "next/link";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

interface CaseDetailRow {
  product_id: string;
  sku: string;
  sku_var: string | null;
  product_name: string | null;
  has_case_details: boolean;
}

export const dynamic = "force-dynamic";

async function loadCaseDetailRows(profile: any): Promise<CaseDetailRow[]> {
  const isSupplier = profile?.role === "supplier";
  const supplierCompany = (profile as any)?.company as string | undefined;

  // 1) Get open purchase orders, optionally scoped to this supplier's company.
  let poQuery = serverSupabase.from("purchase_orders").select("id, supplier").eq("status", "open");

  if (isSupplier && supplierCompany) {
    poQuery = poQuery.eq("supplier", supplierCompany);
  }

  const { data: pos, error: poError } = await poQuery;

  if (poError) {
    console.error("Error loading purchase orders for case details", poError);
    return [];
  }

  const poIds = (pos || []).map((p) => p.id as string);
  if (poIds.length === 0) return [];

  // 2) Get lines for those POs
  const { data: lines, error: linesError } = await serverSupabase
    .from("purchase_order_lines")
    .select("product_id")
    .in("purchase_order_id", poIds);

  if (linesError) {
    console.error("Error loading PO lines for case details", linesError);
    return [];
  }

  const productIds = Array.from(new Set((lines || []).map((l) => l.product_id as string)));
  if (productIds.length === 0) return [];

  // 3) Load product info
  const { data: products, error: prodError } = await serverSupabase
    .from("products")
    .select("id, sku, sku_var, product_name")
    .in("id", productIds);

  if (prodError) {
    console.error("Error loading products for case details", prodError);
    return [];
  }

  const productMap = new Map<string, any>();
  for (const p of products || []) {
    productMap.set(p.id as string, p);
  }

  // 4) Load dims and compute has_case_details
  const { data: dims, error: dimsError } = await serverSupabase
    .from("product_dimensions")
    .select("product_id, kind, length, width, height, weight, units_per")
    .in("product_id", productIds);

  if (dimsError) {
    console.error("Error loading product dimensions for case details", dimsError);
  }

  const hasCaseMap = new Map<string, boolean>();

  for (const pid of productIds) {
    const rowsForProduct = (dims || []).filter((d) => d.product_id === pid);

    let hasDims = false;
    let hasUnits = false;

    for (const d of rowsForProduct) {
      const kind = (d as any).kind as string | undefined;
      const length = Number(d.length) || 0;
      const width = Number(d.width) || 0;
      const height = Number(d.height) || 0;
      const weight = Number(d.weight) || 0;
      const unitsPer = Number(d.units_per) || 0;

      // Treat carton/case/package dims as valid sources of case dimensions.
      const isCaseLikeKind = kind === "carton" || kind === "case" || kind === "package";

      if (isCaseLikeKind && length > 0 && width > 0 && height > 0 && weight > 0) {
        hasDims = true;
      }

      if (unitsPer > 0) {
        hasUnits = true;
      }
    }

    if (hasDims && hasUnits) {
      hasCaseMap.set(pid, true);
    }
  }

  const rows: CaseDetailRow[] = [];

  for (const pid of productIds) {
    const p = productMap.get(pid) as any | undefined;
    if (!p) continue;
    rows.push({
      product_id: pid,
      sku: (p.sku as string) || "",
      sku_var: (p.sku_var as string) || null,
      product_name: (p.product_name as string) || null,
      has_case_details: hasCaseMap.get(pid) === true,
    });
  }

  // Sort by SKU for readability
  rows.sort((a, b) => a.sku.localeCompare(b.sku));

  return rows;
}

export default async function SupplierCaseDetailsPage() {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "supplier")) {
    return <div className="p-6 text-destructive text-sm">Not authorized to view this page.</div>;
  }

  const rows = await loadCaseDetailRows(profile);

  return (
    <div className="space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Case details</h1>
        <p className="text-muted-foreground text-sm">Products on open purchase orders and their case detail status.</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No products from open purchase orders found.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-left text-[11px]">
            <thead className="border-b bg-muted text-[11px] text-muted-foreground">
              <tr>
                <th className="py-1 pr-2 pl-3">SKU</th>
                <th className="px-2 py-1">Variant</th>
                <th className="px-2 py-1">Product</th>
                <th className="px-2 py-1">Case details</th>
                <th className="px-2 py-1 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.product_id} className="border-b last:border-none">
                  <td className="py-1 pr-2 pl-3 font-mono text-[11px]">{row.sku}</td>
                  <td className="px-2 py-1 text-[11px]">{row.sku_var}</td>
                  <td className="px-2 py-1 text-[11px]">{row.product_name}</td>
                  <td className="px-2 py-1 text-[11px]">
                    {row.has_case_details ? (
                      <span className="font-semibold text-emerald-600">✓ Complete</span>
                    ) : (
                      <span className="font-semibold text-destructive">✗ Missing</span>
                    )}
                  </td>
                  <td className="space-x-1 px-2 py-1 text-right text-[11px]">
                    {row.has_case_details ? (
                      <Link
                        href={`/supplier/case-details/${row.product_id}`}
                        className="inline-flex items-center rounded-md border px-2 py-1 hover:bg-muted"
                      >
                        View
                      </Link>
                    ) : (
                      <Link
                        href={`/supplier/case-details/${row.product_id}/edit`}
                        className="inline-flex items-center rounded-md border px-2 py-1 hover:bg-muted"
                      >
                        Enter details
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
