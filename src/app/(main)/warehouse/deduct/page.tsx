import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

import { DeductShell } from "./deduct-shell";

export const dynamic = "force-dynamic";

export default async function WarehouseDeductPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/v1/login");
  }

  const supabase = serverSupabase;

  const { data: warehouses } = await supabase.from("warehouses").select("id, name").order("name", { ascending: true });

  return (
    <div className="max-w-xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Deduct from inventory</h1>
        <p className="text-muted-foreground text-sm">
          Remove product from a specific warehouse location with a clear reason.
        </p>
      </div>

      <DeductShell />
    </div>
  );
}
