import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/server/auth/current-user";

import { type AvailabilityState, loadAvailability } from "./actions";
import { AvailabilityShell } from "./AvailabilityShell";

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ sku?: string; var?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/auth/v1/login");
  }

  const { sku, var: skuVar } = await searchParams;

  let initialState: AvailabilityState = { ok: null };

  if (sku) {
    const formData = new FormData();
    formData.append("sku", sku);
    if (skuVar) {
      formData.append("sku_var", skuVar);
    }
    initialState = await loadAvailability({ ok: null }, formData);
  }

  return (
    <AvailabilityShell
      loadAvailability={loadAvailability}
      initialState={initialState}
      initialSku={sku ?? ""}
      initialVar={skuVar ?? ""}
    />
  );
}
