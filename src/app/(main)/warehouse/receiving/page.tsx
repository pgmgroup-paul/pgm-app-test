import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

interface ReceivingContainerRow {
  id: string;
  code: string;
  eta: string | null;
  hasMissingPalletConfig: boolean;
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

  const containers = (data || []).map((c: any) => ({
    id: c.id as string,
    code: (c.container_number as string) || "",
    eta: (c.shipment?.eta as string) || null,
  }));

  if (containers.length === 0) return [];

  const containerIds = containers.map((c) => c.id);

  // Load products per container via shipment_items -> purchase_order_lines
  const { data: items, error: itemsError } = await serverSupabase
    .from("shipment_items")
    .select("shipment_container_id, purchase_order_lines!inner(product_id)")
    .in("shipment_container_id", containerIds);

  if (itemsError) {
    console.error("Error loading shipment_items for pallet config status", itemsError);
    return containers.map((c) => ({ ...c, hasMissingPalletConfig: false }));
  }

  const productsByContainer = new Map<string, Set<string>>();

  for (const it of items || []) {
    const row = it as any;
    const cid = (row.shipment_container_id as string) || "";
    const line = row.purchase_order_lines as any;
    const pid = (line?.product_id as string) || "";
    if (!cid || !pid) continue;
    const set = productsByContainer.get(cid) || new Set<string>();
    set.add(pid);
    productsByContainer.set(cid, set);
  }

  const allProductIds = Array.from(
    new Set(
      Array.from(productsByContainer.values())
        .flatMap((s) => Array.from(s.values()))
        .filter(Boolean),
    ),
  );

  if (allProductIds.length === 0) {
    return containers.map((c) => ({ ...c, hasMissingPalletConfig: false }));
  }

  // Load pallet dimensions for these products
  const { data: dims, error: dimsError } = await serverSupabase
    .from("product_dimensions")
    .select("product_id, cartons_per_layer, number_of_layers, cartons_per_pallet")
    .eq("kind", "pallet")
    .in("product_id", allProductIds);

  if (dimsError) {
    console.error("Error loading product_dimensions for pallet config status", dimsError);
    return containers.map((c) => ({ ...c, hasMissingPalletConfig: false }));
  }

  const palletMap = new Map<
    string,
    { cartons_per_layer: number | null; number_of_layers: number | null; cartons_per_pallet: number | null }
  >();

  for (const d of dims || []) {
    const row = d as any;
    const pid = row.product_id as string;
    if (!pid) continue;
    palletMap.set(pid, {
      cartons_per_layer: row.cartons_per_layer != null ? Number(row.cartons_per_layer) : null,
      number_of_layers: row.number_of_layers != null ? Number(row.number_of_layers) : null,
      cartons_per_pallet: row.cartons_per_pallet != null ? Number(row.cartons_per_pallet) : null,
    });
  }

  return containers.map((c) => {
    const set = productsByContainer.get(c.id);
    if (!set || set.size === 0) {
      return { ...c, hasMissingPalletConfig: false };
    }

    let hasMissing = false;
    for (const pid of set.values()) {
      const cfg = palletMap.get(pid) || null;
      const cartonsPerLayer = cfg?.cartons_per_layer ?? null;
      const numberOfLayers = cfg?.number_of_layers ?? null;
      const cartonsPerPallet = cfg?.cartons_per_pallet ?? null;

      if (cartonsPerLayer == null || numberOfLayers == null || cartonsPerPallet == null) {
        hasMissing = true;
        break;
      }
    }

    return { ...c, hasMissingPalletConfig: hasMissing };
  });
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
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
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

            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {containers.map((c) => (
                <div key={c.id} className="rounded-lg border bg-white p-3 shadow-sm">
                  <div className="font-mono font-semibold text-sm">{c.code}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">ETA: {c.eta || "-"}</div>
                  {c.hasMissingPalletConfig && (
                    <div className="mt-1 text-[11px] text-amber-600">&#9888; Missing pallet config</div>
                  )}

                  <div className="mt-2 space-y-2">
                    <a
                      href={`/warehouse/receiving/${c.id}/contents`}
                      className="inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
                    >
                      View contents
                    </a>
                    <a
                      href={`/warehouse/receiving/${c.id}/pallet-config`}
                      className="inline-flex w-full items-center justify-center rounded-md border px-3 py-2 font-medium text-[11px] text-muted-foreground hover:bg-muted/40"
                    >
                      Pallet config
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
