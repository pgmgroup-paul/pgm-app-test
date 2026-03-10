import Link from "next/link";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

async function loadShipmentWithContainers(id: string) {
  const { data: shipment, error } = await serverSupabase
    .from("shipments")
    .select(
      "id, shipment_number, status, origin_port, destination_port, etd, eta, incoterms, carrier, vessel, voyage, notes",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !shipment) {
    console.error("Error loading shipment", error);
    return null;
  }

  const { data: containers, error: contError } = await serverSupabase
    .from("shipment_containers")
    .select("id, container_number, type, status, seal_number")
    .eq("shipment_id", id)
    .order("created_at", { ascending: true });

  if (contError) {
    console.error("Error loading shipment containers", contError);
  }

  return { shipment, containers: containers || [] };
}

export default async function ShipmentViewPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return <div className="p-6 text-destructive text-sm">Not authorized.</div>;
  }

  const { id } = await params;

  const data = await loadShipmentWithContainers(id);

  if (!data) {
    return <div className="p-6 text-destructive text-sm">Shipment not found.</div>;
  }

  const { shipment, containers } = data as any;

  return (
    <div className="max-w-5xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg tracking-tight">Shipment</h1>
        <p className="text-muted-foreground text-sm">
          Shipment <span className="font-mono">{shipment.shipment_number}</span>
        </p>
        <p className="text-muted-foreground text-xs">
          <Link href={`/shipments/${shipment.id}/edit`} className="underline">
            Edit shipment
          </Link>
        </p>
      </div>

      {/* Shipment metadata */}
      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="font-medium text-[11px]">Shipment details</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Status</div>
            <div className="text-[11px] capitalize">{shipment.status}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Lane</div>
            <div className="text-[11px]">
              {shipment.origin_port || "?"} → {shipment.destination_port || "?"}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">ETD / ETA</div>
            <div className="text-[11px]">
              {shipment.etd ? new Date(shipment.etd).toLocaleDateString() : "-"} /{" "}
              {shipment.eta ? new Date(shipment.eta).toLocaleDateString() : "-"}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Incoterms</div>
            <div className="text-[11px]">{shipment.incoterms || "-"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Carrier</div>
            <div className="text-[11px]">{shipment.carrier || "-"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Vessel / Voyage</div>
            <div className="text-[11px]">
              {shipment.vessel || "-"}
              {shipment.voyage ? ` / ${shipment.voyage}` : ""}
            </div>
          </div>
        </div>
        {shipment.notes && (
          <div className="space-y-1 pt-2">
            <div className="text-[11px] text-muted-foreground">Notes</div>
            <div className="whitespace-pre-wrap text-[11px]">{shipment.notes}</div>
          </div>
        )}
      </div>

      {/* Containers list */}
      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="font-medium text-[11px]">Containers</div>
        </div>

        {containers.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No containers for this shipment yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">Container #</th>
                  <th className="px-2 py-1">Type</th>
                  <th className="px-2 py-1">Status</th>
                  <th className="px-2 py-1">Seal</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c: any) => (
                  <tr key={c.id} className="border-b last:border-none">
                    <td className="py-1 pr-2 pl-3 font-mono text-[11px]">
                      <Link href={`/shipments/${shipment.id}/containers/${c.id}/view`} className="underline">
                        {c.container_number || "(pending)"}
                      </Link>
                    </td>
                    <td className="px-2 py-1 text-[11px]">{c.type || "-"}</td>
                    <td className="px-2 py-1 text-[11px] capitalize">{c.status}</td>
                    <td className="px-2 py-1 text-[11px]">{c.seal_number || "-"}</td>
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
