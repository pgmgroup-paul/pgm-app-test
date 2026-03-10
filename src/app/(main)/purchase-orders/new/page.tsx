import { serverSupabase } from "@/lib/serverSupabase";

import { createPurchaseOrder } from "../po-actions";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

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
        <h1 className="font-semibold text-lg tracking-tight">New purchase order</h1>
        <p className="text-muted-foreground text-sm">Enter basic information for a new purchase order.</p>
      </div>

      <form action={createPurchaseOrder} className="space-y-3 rounded-md border px-3 py-3 text-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="supplier" className="font-medium">
              Supplier
            </label>
            <select
              id="supplier"
              name="supplier"
              required
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
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-xs hover:bg-primary/90"
        >
          Save & continue
        </button>

        {error === "missing-supplier" && <p className="mt-2 text-destructive text-xs">Please select a supplier.</p>}
        {error === "create-failed" && <p className="mt-2 text-destructive text-xs">Failed to create purchase order.</p>}
      </form>
    </div>
  );
}
