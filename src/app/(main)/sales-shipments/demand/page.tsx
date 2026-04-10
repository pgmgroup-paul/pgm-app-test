import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/server/auth/current-user";

import { type DemandState, loadDemand } from "./actions";
import { DemandShell } from "./DemandShell";

export default async function DemandPage({ searchParams }: { searchParams: Promise<{ sku?: string; var?: string }> }) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/auth/v1/login");
  }

  const { sku, var: skuVar } = await searchParams;

  let initialState: DemandState = { ok: null };

  if (sku) {
    const formData = new FormData();
    formData.append("sku", sku);
    if (skuVar) {
      formData.append("sku_var", skuVar);
    }
    initialState = await loadDemand({ ok: null }, formData);
  }

  return (
    <DemandShell loadDemand={loadDemand} initialState={initialState} initialSku={sku ?? ""} initialVar={skuVar ?? ""} />
  );
}
