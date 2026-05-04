import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export default async function NewSalesOrderPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  const { error } = await searchParams;

  // Pre-generate next SO number for default input value
  let nextNumber = 10100;

  const { data: maxSoForUi, error: maxErrorForUi } = await serverSupabase
    .from("sales_orders")
    .select("order_number")
    .ilike("order_number", "SO1%")
    .order("order_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!maxErrorForUi && maxSoForUi?.order_number) {
    const match = maxSoForUi.order_number.match(/^SO(\d+)$/);
    if (match) {
      const current = Number(match[1]);
      if (Number.isFinite(current)) {
        nextNumber = current + 1;
      }
    }
  }

  const autoOrderNumber = `SO${nextNumber}`;

  return (
    <div className="max-w-2xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg tracking-tight">New sales order</h1>
        <p className="text-muted-foreground text-sm">Enter basic information for a new sales order.</p>
      </div>

      <form
        action={async (formData: FormData) => {
          "use server";

          const profile = await getCurrentUserProfile();

          if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
            redirect("/unauthorized");
          }

          const customerName = (formData.get("customer_name") || "").toString().trim();
          const orderDateRaw = (formData.get("order_date") || "").toString().trim();
          const requestedShipRaw = (formData.get("requested_ship_date") || "").toString().trim();
          const notes = (formData.get("notes") || "").toString().trim();

          if (!customerName || !orderDateRaw) {
            redirect("/sales-orders/new?error=missing-fields");
          }

          // Generate next SO number sequentially starting from SO10100
          let nextNumber = 10100;

          const { data: maxSo, error: maxError } = await serverSupabase
            .from("sales_orders")
            .select("order_number")
            .ilike("order_number", "SO1%")
            .order("order_number", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!maxError && maxSo?.order_number) {
            const match = maxSo.order_number.match(/^SO(\d+)$/);
            if (match) {
              const current = Number(match[1]);
              if (Number.isFinite(current)) {
                nextNumber = current + 1;
              }
            }
          }

          const autoOrderNumber = `SO${nextNumber}`;

          // Allow user override, normalize, and keep SOxxxxx format
          let orderNumber = (formData.get("order_number") || "").toString().trim();
          if (!orderNumber) {
            orderNumber = autoOrderNumber;
          }

          // Normalize: uppercase
          orderNumber = orderNumber.toUpperCase();

          // Validate format: must start with SO and be SO + digits
          const matchCustom = orderNumber.match(/^SO(\d+)$/);
          if (!matchCustom) {
            redirect("/sales-orders/new?error=bad-order-number");
          }

          // Enforce uniqueness before insert
          const { data: existingSo, error: existingError } = await serverSupabase
            .from("sales_orders")
            .select("id")
            .eq("order_number", orderNumber)
            .maybeSingle();

          if (!existingError && existingSo) {
            redirect("/sales-orders/new?error=duplicate-order-number");
          }

          const { data, error } = await serverSupabase
            .from("sales_orders")
            .insert({
              order_number: orderNumber,
              customer_name: customerName,
              order_date: orderDateRaw,
              requested_ship_date: requestedShipRaw || null,
              notes: notes || null,
            })
            .select("id")
            .single();

          if (error || !data) {
            console.error("Error creating sales order", error);
            redirect("/sales-orders/new?error=create-failed");
          }

          redirect(`/sales-orders/${data.id}/edit`);
        }}
        className="space-y-3 rounded-md border px-3 py-3 text-sm"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="order_number" className="font-medium">
              SO number
            </label>
            <input
              id="order_number"
              name="order_number"
              type="text"
              defaultValue={autoOrderNumber}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Leave as is or enter a custom SO number (format: SOxxxxx)
            </p>
          </div>
          <div className="space-y-1">
            <label htmlFor="customer_name" className="font-medium">
              Customer
            </label>
            <input
              id="customer_name"
              name="customer_name"
              type="text"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="order_date" className="font-medium">
              Order date
            </label>
            <input
              id="order_date"
              name="order_date"
              type="date"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="requested_ship_date" className="font-medium">
              Requested ship date
            </label>
            <input
              id="requested_ship_date"
              name="requested_ship_date"
              type="date"
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
          Continue to add products
        </button>

        {error === "missing-fields" && (
          <p className="mt-2 text-destructive text-xs">Customer and order date are required.</p>
        )}
        {error === "bad-order-number" && (
          <p className="mt-2 text-destructive text-xs">SO number must be in the format SOxxxxx.</p>
        )}
        {error === "duplicate-order-number" && (
          <p className="mt-2 text-destructive text-xs">SO number already exists. Please choose a different one.</p>
        )}
        {error === "create-failed" && <p className="mt-2 text-destructive text-xs">Failed to create sales order.</p>}
      </form>
    </div>
  );
}
