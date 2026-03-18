import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

import { DeductShell } from "./deduct-shell";

export const dynamic = "force-dynamic";

export default async function WarehouseDeductPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/v1/login");
  }

  const supabase = serverSupabase;

  const { data: warehouses } = await supabase.from("warehouses").select("id, name").order("name", { ascending: true });

  const productIdParam = (sp?.product_id as string | undefined) ?? undefined;
  const shipmentIdParam = (sp?.shipment_id as string | undefined) ?? undefined;
  const locationParam = (sp?.location as string | undefined) ?? undefined;
  const reasonParam = (sp?.reason as string | undefined) ?? undefined;
  const isFromOrder = (sp?.from as string | undefined) === "order";

  return (
    <div className="max-w-xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Deduct from inventory</h1>
        <p className="text-muted-foreground text-sm">
          Remove product from a specific warehouse location with a clear reason.
        </p>
      </div>

      <DeductShell
        productId={productIdParam}
        shipmentId={shipmentIdParam}
        locationCode={locationParam}
        reason={reasonParam}
        isFromOrder={isFromOrder}
      />
    </div>
  );
}
