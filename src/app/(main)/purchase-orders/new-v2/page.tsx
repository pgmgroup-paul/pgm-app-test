import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/serverSupabase";

import {
  createPurchaseOrder,
  addPurchaseOrderLine as addPurchaseOrderLineAction,
  deletePurchaseOrderLine,
  updatePurchaseOrderLineQuantity as updatePurchaseOrderLineQuantityAction,
  updatePurchaseOrder,
  closePurchaseOrder,
} from "../po-actions";

async function addPurchaseOrderLine(formData: FormData) {
  "use server";
  await addPurchaseOrderLineAction(formData);
}

async function updatePurchaseOrderLineQuantity(formData: FormData) {
  "use server";
  await updatePurchaseOrderLineQuantityAction(formData);
}
import { AddProductSearch } from "./AddProductSearch";
import EditableQuantityInput from "./EditableQuantityInput";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderV2Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; id?: string }>;
}) {
  const { error, id } = await searchParams;
  let poId = id ?? null;

  if (!poId) {
    const { data, error: insertError } = await serverSupabase
      .from("purchase_orders")
      .insert({ status: "draft" })
      .select("id")
      .single();

    if (!data || insertError) {
      console.error("Error creating draft PO", insertError);
      return <div>Error creating purchase order</div>;
    }

    redirect(`/purchase-orders/new-v2?id=${data.id}`);
  }

  let po: any | null = null;
  let lines: any[] = [];
  let unitsMap = new Map<string, number>();

  if (poId) {
    // Load existing purchase order
    const { data: poData } = await serverSupabase
      .from("purchase_orders")
      .select("id, po_number, status, supplier, terms, ship_date, eta, notes, created_at")
      .eq("id", poId)
      .maybeSingle();

    po = poData;

    // Load purchase order lines
    const { data: linesData } = await serverSupabase
      .from("purchase_order_lines")
      .select("id, product_id, sku, sku_var, description, quantity_cases, price")
      .eq("purchase_order_id", poId);

    lines = linesData || [];

    // Load units_per (package) for all products
    const { data: dims, error: dimsError } = await serverSupabase
      .from("product_dimensions")
      .select("product_id, units_per")
      .eq("kind", "package");

    if (dimsError) {
      console.error("Error loading product_dimensions for PO lines", dimsError);
    } else {
      unitsMap = new Map<string, number>(
        (dims || []).map((d: any) => [d.product_id as string, Number(d.units_per) || 0]),
      );
    }
  }

  const isLocked = po?.status === "closed";

  const { data: suppliers, error: suppliersError } = await serverSupabase
    .from("profiles")
    .select("id, company")
    .eq("role", "supplier")
    .not("company", "is", null)
    .order("company", { ascending: true });

  const supplierOptions = (suppliersError || !suppliers ? [] : suppliers).map((s) => ({
    id: s.id as string,
    company: (s as any).company as string,
  }));

  return (
    <div className="max-w-2xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg tracking-tight">New purchase order (V2)</h1>
        <div className="flex items-center gap-2 text-sm">
          <h2 className="font-medium text-sm">
            {po?.po_number || "Draft PO"}
          </h2>
          {po?.status && (
            <span className="text-xs text-muted-foreground">{po.status}</span>
          )}
          {po?.status === "open" && (
            <form action={closePurchaseOrder} className="inline-block ml-2">
              <input type="hidden" name="id" value={poId} />
              <button className="text-xs bg-black text-white px-2 py-1 rounded">
                Close PO
              </button>
            </form>
          )}
          {po?.status === "closed" && (
            <span className="text-xs px-2 py-1 bg-gray-200 rounded">Closed</span>
          )}
        </div>
        <p className="text-muted-foreground text-sm">Enter basic information for a new purchase order.</p>
      </div>

      <form action={updatePurchaseOrder} className="space-y-3 rounded-md border px-3 py-3 text-sm">
        <input type="hidden" name="id" value={poId} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="supplier" className="font-medium">
              Supplier
            </label>
            <select
              id="supplier"
              name="supplier"
              required
              disabled={isLocked}
              defaultValue={po?.supplier || ""}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select supplier…</option>
              {supplierOptions.map((s) => (
                <option key={s.id} value={s.company}>
                  {s.company}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="terms" className="font-medium">
              Terms
            </label>
            <input
              id="terms"
              name="terms"
              type="text"
              required
              disabled={isLocked}
              defaultValue={po?.terms || ""}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="ship_date" className="font-medium">
              Ship date
            </label>
            <input
              id="ship_date"
              name="ship_date"
              type="date"
              required
              disabled={isLocked}
              defaultValue={po?.ship_date || ""}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="eta" className="font-medium">
              ETA
            </label>
            <input
              id="eta"
              name="eta"
              type="date"
              required
              disabled={isLocked}
              defaultValue={po?.eta || ""}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="notes" className="font-medium">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            disabled={isLocked}
            defaultValue={po?.notes || ""}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {!isLocked && (
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-xs hover:bg-primary/90"
          >
            Save PO
          </button>
        )}

        {error === "missing-supplier" && <p className="mt-2 text-destructive text-xs">Please select a supplier.</p>}
        {error === "create-failed" && <p className="mt-2 text-destructive text-xs">Failed to create purchase order.</p>}
      </form>

      {poId && (
        <div className="space-y-2 mt-6">
          <h2 className="font-medium text-sm">Products in PO</h2>

          {!isLocked && (
            <>
              <AddProductSearch />

              <form
                action={addPurchaseOrderLine}
                className="space-y-2 border rounded-md p-3 text-xs"
              >
                <input type="hidden" name="purchase_order_id" value={poId} />
                <input type="hidden" name="return_to" value="new-v2" />
                <div className="grid grid-cols-5 gap-2">
                  <input
                    name="sku"
                    placeholder="SKU"
                    className="border px-2 py-1 rounded"
                  />
                  <input
                    name="sku_var"
                    placeholder="Variant"
                    className="border px-2 py-1 rounded"
                  />
                  <input
                    name="quantity_cases"
                    placeholder="Pieces"
                    className="border px-2 py-1 rounded"
                  />
                  <input
                    name="price"
                    placeholder="Price"
                    className="border px-2 py-1 rounded"
                  />
                  <button
                    type="submit"
                    className="bg-primary text-white rounded px-2 py-1"
                  >
                    Add
                  </button>
                </div>
              </form>
            </>
          )}

          {lines.length === 0 ? (
            <div className="text-xs text-muted-foreground">No products added yet.</div>
          ) : (
            <table className="w-full text-xs border rounded-md">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2 py-1 text-left">SKU</th>
                  <th className="px-2 py-1 text-left">Variant</th>
                  <th className="px-2 py-1 text-left">Product</th>
                  <th className="px-2 py-1 text-right">Pieces</th>
                  <th className="px-2 py-1 text-right">Qty (cases)</th>
                  <th className="px-2 py-1 text-right">Suggested</th>
                  <th className="px-2 py-1 text-right">Price</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any) => {
                  const pieces = Number(l.quantity_cases) || 0;
                  const unitsPer = unitsMap.get(l.product_id as string) || 0;
                  const cases = unitsPer > 0 ? (pieces / unitsPer).toFixed(2) : "-";
                  const fullCases = unitsPer > 0 ? Math.ceil(pieces / unitsPer) : 0;
                  const suggestedPieces = unitsPer > 0 ? fullCases * unitsPer : 0;
                  const needsAdjustment = unitsPer > 0 && pieces % unitsPer !== 0;
                  return (
                    <tr
                      key={l.id}
                      className={`border-t ${needsAdjustment ? "bg-amber-50" : ""}`}
                    >
                      <td className="px-2 py-1">{l.sku}</td>
                      <td className="px-2 py-1">{l.sku_var || ""}</td>
                      <td className="px-2 py-1">{l.description}</td>
                      <td className="px-2 py-1 text-right">
                        <form
                          action={updatePurchaseOrderLineQuantity}
                          className="flex justify-end"
                        >
                          {isLocked ? (
                            <span>{pieces}</span>
                          ) : (
                            <EditableQuantityInput key={`${l.id}-${pieces}`} defaultValue={pieces} />
                          )}
                          <input type="hidden" name="line_id" value={l.id} />
                          <input
                            type="hidden"
                            name="purchase_order_id"
                            value={poId}
                          />
                          <input
                            type="hidden"
                            name="return_to"
                            value="new-v2"
                          />
                        </form>
                      </td>
                      <td className="px-2 py-1 text-right">{cases}</td>
                      <td className="px-2 py-1 text-right">
                        {needsAdjustment ? (
                          <span className="text-amber-600">
                            {suggestedPieces} ({fullCases} cs)
                          </span>
                        ) : (
                          "-"
                        )}
                        {needsAdjustment && !isLocked && (
                          <form
                            action={updatePurchaseOrderLineQuantity}
                            className="inline"
                          >
                            <input type="hidden" name="line_id" value={l.id} />
                            <input type="hidden" name="purchase_order_id" value={poId} />
                            <input
                              type="hidden"
                              name="quantity_cases"
                              value={suggestedPieces}
                            />
                            <input
                              type="hidden"
                              name="return_to"
                              value="new-v2"
                            />
                            <button
                              type="submit"
                              className="ml-2 text-xs text-blue-600 hover:underline"
                            >
                              Adjust
                            </button>
                          </form>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {l.price != null ? Number(l.price).toFixed(2) : "-"}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {!isLocked && (
                          <form action={deletePurchaseOrderLine}>
                            <input type="hidden" name="line_id" value={l.id} />
                            <input
                              type="hidden"
                              name="purchase_order_id"
                              value={poId}
                            />
                            <input
                              type="hidden"
                              name="return_to"
                              value="new-v2"
                            />
                            <button
                              type="submit"
                              className="text-red-600 hover:underline"
                            >
                              Remove
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
