import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

interface ReceivingContainerRow {
  id: string;
  code: string;
  eta: string | null;
}

async function loadReceivingContainersList(): Promise<ReceivingContainerRow[]> {
  const { data, error } = await serverSupabase
    .from("shipment_containers")
    .select(
      `id,
       container_number,
       status,
       shipment:shipments!inner(eta)`,
    )
    .eq("status", "received")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading receiving containers for /warehouse/receiving", error);
    return [];
  }

  return (data || []).map((c: any) => ({
    id: c.id as string,
    code: (c.container_number as string) || "",
    eta: (c.shipment?.eta as string) || null,
  }));
}

export default async function WarehouseReceivingPage() {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/auth/v1/login");
  }

  const containers = await loadReceivingContainersList();

  return (
    <div className="max-w-4xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Receiving containers</h1>
        <p className="text-muted-foreground text-sm">
          Containers currently in receiving status. Select a container to review and complete receiving.
        </p>
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="font-medium text-[11px]">Containers in receiving</div>

        {containers.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">There are no containers currently in receiving status.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">Code</th>
                  <th className="px-2 py-1">ETA</th>
                  <th className="px-2 py-1 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => (
                  <tr key={c.id} className="border-b last:border-none">
                    <td className="py-1 pr-2 pl-3 font-mono text-[11px]">{c.code}</td>
                    <td className="px-2 py-1 text-[10px] text-muted-foreground">{c.eta || "-"}</td>
                    <td className="space-x-1 px-2 py-1 text-right text-[11px]">
                      <a
                        href={`/warehouse/receiving/${c.id}/pallet-config`}
                        className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted"
                      >
                        Pallet config
                      </a>
                      <a
                        href={`/warehouse/receiving/${c.id}/contents`}
                        className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted"
                      >
                        Contents
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
