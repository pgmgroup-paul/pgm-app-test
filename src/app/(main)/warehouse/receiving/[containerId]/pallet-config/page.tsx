import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

interface PageParams {
  params: Promise<{
    containerId: string;
  }>;
}

interface PalletConfigRow {
  product_id: string;
  sku: string;
  sku_var: string | null;
  product_name: string;
  cartons_per_layer: number | null;
  number_of_layers: number | null;
  cartons_per_pallet: number | null;
}

async function loadContainerPalletConfig(
  containerId: string,
): Promise<{ code: string; rows: PalletConfigRow[] } | null> {
  // Resolve container and shipment id
  const { data: container, error: contError } = await serverSupabase
    .from("shipment_containers")
    .select("id, container_number, shipment_id")
    .eq("id", containerId)
    .maybeSingle();

  if (contError || !container) {
    console.error("Error resolving container for pallet config", contError);
    return null;
  }

  const code = (container.container_number as string) || "";

  // Load products in this container via shipment_items -> purchase_order_lines
  const { data: items, error: itemsError } = await serverSupabase
    .from("shipment_items")
    .select(
      `purchase_order_lines!inner(
         product_id,
         sku,
         sku_var,
         description
       )`,
    )
    .eq("shipment_container_id", containerId);

  if (itemsError) {
    console.error("Error loading shipment_items for pallet config", itemsError);
    return { code, rows: [] };
  }

  const productMap = new Map<string, { sku: string; sku_var: string | null; product_name: string }>();

  for (const it of items || []) {
    const line = (it as any).purchase_order_lines as any;
    if (!line || !line.product_id) continue;
    const pid = line.product_id as string;
    if (!productMap.has(pid)) {
      productMap.set(pid, {
        sku: (line.sku as string) || "",
        sku_var: (line.sku_var as string) || null,
        product_name: (line.description as string) || "",
      });
    }
  }

  const productIds = Array.from(productMap.keys());

  if (productIds.length === 0) {
    return { code, rows: [] };
  }

  // Load pallet configuration from product_dimensions
  const { data: dims, error: dimsError } = await serverSupabase
    .from("product_dimensions")
    .select("product_id, cartons_per_layer, number_of_layers, cartons_per_pallet")
    .eq("kind", "pallet")
    .in("product_id", productIds);

  if (dimsError) {
    console.error("Error loading pallet dimensions for pallet config", dimsError);
  }

  const rows: PalletConfigRow[] = productIds.map((pid) => {
    const base = productMap.get(pid)!;
    const d = (dims || []).find((row: any) => row.product_id === pid) as any | undefined;

    const cartonsPerLayer = d?.cartons_per_layer != null ? Number(d.cartons_per_layer) : null;
    const numberOfLayers = d?.number_of_layers != null ? Number(d.number_of_layers) : null;
    const cartonsPerPalletStored = d?.cartons_per_pallet != null ? Number(d.cartons_per_pallet) : null;

    const cartonsPerPallet =
      cartonsPerPalletStored ??
      (cartonsPerLayer != null && numberOfLayers != null ? cartonsPerLayer * numberOfLayers : null);

    return {
      product_id: pid,
      sku: base.sku,
      sku_var: base.sku_var,
      product_name: base.product_name,
      cartons_per_layer: cartonsPerLayer,
      number_of_layers: numberOfLayers,
      cartons_per_pallet: cartonsPerPallet,
    };
  });

  return { code, rows };
}

export default async function WarehouseReceivingPalletConfigPage({ params }: PageParams) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/auth/v1/login");
  }

  const { containerId } = await params;

  if (!containerId) {
    redirect("/warehouse/receiving");
  }

  const data = await loadContainerPalletConfig(containerId);

  if (!data) {
    return <div className="p-6 text-destructive text-sm">Container not found.</div>;
  }

  const { code, rows } = data;

  return (
    <div className="max-w-4xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Pallet configuration</h1>
        <p className="text-muted-foreground text-sm">
          Pallet configuration for products in container <span className="font-mono">{code}</span>.
        </p>
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="font-medium text-[11px]">Products in this container</div>
          <a
            href={`/warehouse/receiving/${containerId}/contents`}
            className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted"
          >
            View contents
          </a>
        </div>

        {rows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No products found for this container.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">SKU/Var</th>
                  <th className="px-2 py-1">Product name</th>
                  <th className="px-2 py-1 text-right">Cartons per layer</th>
                  <th className="px-2 py-1 text-right">Number of layers</th>
                  <th className="px-2 py-1 text-right">Cartons per pallet</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const hasPalletConfig =
                    row.cartons_per_layer != null || row.number_of_layers != null || row.cartons_per_pallet != null;

                  const skuQuery = encodeURIComponent(row.sku);
                  const variantQuery = row.sku_var ? encodeURIComponent(row.sku_var) : "";
                  const dimsHref = `/warehouse/dimensions?sku=${skuQuery}${variantQuery ? `&variant=${variantQuery}` : ""}`;

                  return (
                    <tr key={row.product_id} className="border-b last:border-none">
                      <td className="py-1 pr-2 pl-3 font-mono text-[11px]">
                        {row.sku}
                        {row.sku_var ? `-${row.sku_var}` : ""}
                      </td>
                      <td className="px-2 py-1 text-[11px]">{row.product_name}</td>
                      <td className="px-2 py-1 text-right text-[11px]">
                        {row.cartons_per_layer != null ? row.cartons_per_layer : "-"}
                      </td>
                      <td className="px-2 py-1 text-right text-[11px]">
                        {row.number_of_layers != null ? row.number_of_layers : "-"}
                      </td>
                      <td className="px-2 py-1 text-right text-[11px]">
                        {hasPalletConfig ? (
                          row.cartons_per_pallet != null ? (
                            row.cartons_per_pallet
                          ) : (
                            "-"
                          )
                        ) : (
                          <a href={dimsHref} className="font-medium text-[11px] text-primary hover:underline">
                            Enter pallet build
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
