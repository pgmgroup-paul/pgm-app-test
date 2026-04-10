import Link from "next/link";
import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

type ShipmentStatus = "planned" | "booked" | "on_water" | "arrived" | "delivered" | "cancelled";

type ContainerStatus = "planned" | "loaded" | "gate_out" | "on_water" | "arrived" | "unloaded" | "returned";

async function loadShipment(id: string) {
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

export default async function EditShipmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  const { id } = await params;
  const { error } = await searchParams;

  const data = await loadShipment(id);

  if (!data) {
    return <div className="p-6 text-destructive text-sm">Shipment not found.</div>;
  }

  const { shipment, containers } = data as any;

  return (
    <div className="max-w-5xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg tracking-tight">Edit shipment</h1>
        <p className="text-muted-foreground text-sm">
          Shipment <span className="font-mono">{shipment.shipment_number}</span>
        </p>
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <form
          action={async (formData: FormData) => {
            "use server";

            const profile = await getCurrentUserProfile();

            if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
              redirect("/unauthorized");
            }

            const shipmentId = (formData.get("shipment_id") || "").toString().trim();
            const status = (formData.get("status") || "").toString().trim();
            const origin = (formData.get("origin_port") || "").toString().trim();
            const destination = (formData.get("destination_port") || "").toString().trim();
            const etd = (formData.get("etd") || "").toString().trim();
            const eta = (formData.get("eta") || "").toString().trim();
            const incoterms = (formData.get("incoterms") || "").toString().trim();
            const carrier = (formData.get("carrier") || "").toString().trim();
            const vessel = (formData.get("vessel") || "").toString().trim();
            const voyage = (formData.get("voyage") || "").toString().trim();
            const notes = (formData.get("notes") || "").toString().trim();

            if (!shipmentId) {
              redirect(`/purchase-shipments/${id}/edit`);
            }

            const { error: updError } = await serverSupabase
              .from("shipments")
              .update({
                status: status || shipment.status,
                origin_port: origin || null,
                destination_port: destination || null,
                etd: etd || null,
                eta: eta || null,
                incoterms: incoterms || null,
                carrier: carrier || null,
                vessel: vessel || null,
                voyage: voyage || null,
                notes: notes || null,
              })
              .eq("id", shipmentId);

            if (updError) {
              console.error("Error updating shipment header", updError);
            }

            redirect(`/purchase-shipments/${shipmentId}/edit`);
          }}
          className="space-y-2"
        >
          <input type="hidden" name="shipment_id" value={shipment.id as string} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="status" className="text-[11px] text-muted-foreground">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={shipment.status as string}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="planned">Planned</option>
                <option value="booked">Booked</option>
                <option value="on_water">On water</option>
                <option value="arrived">Arrived</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="origin_port" className="text-[11px] text-muted-foreground">
                Origin port
              </label>
              <input
                id="origin_port"
                name="origin_port"
                type="text"
                defaultValue={shipment.origin_port ?? ""}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="destination_port" className="text-[11px] text-muted-foreground">
                Destination port
              </label>
              <input
                id="destination_port"
                name="destination_port"
                type="text"
                defaultValue={shipment.destination_port ?? ""}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="etd" className="text-[11px] text-muted-foreground">
                ETD
              </label>
              <input
                id="etd"
                name="etd"
                type="date"
                defaultValue={shipment.etd ?? ""}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="eta" className="text-[11px] text-muted-foreground">
                ETA
              </label>
              <input
                id="eta"
                name="eta"
                type="date"
                defaultValue={shipment.eta ?? ""}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="incoterms" className="text-[11px] text-muted-foreground">
                Incoterms
              </label>
              <input
                id="incoterms"
                name="incoterms"
                type="text"
                defaultValue={shipment.incoterms ?? ""}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="carrier" className="text-[11px] text-muted-foreground">
                Carrier
              </label>
              <input
                id="carrier"
                name="carrier"
                type="text"
                defaultValue={shipment.carrier ?? ""}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="vessel" className="text-[11px] text-muted-foreground">
                Vessel / Voyage
              </label>
              <div className="flex gap-2">
                <input
                  id="vessel"
                  name="vessel"
                  type="text"
                  placeholder="Vessel"
                  defaultValue={shipment.vessel ?? ""}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <input
                  id="voyage"
                  name="voyage"
                  type="text"
                  placeholder="Voyage"
                  defaultValue={shipment.voyage ?? ""}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1 pt-2">
            <label htmlFor="notes" className="text-[11px] text-muted-foreground">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={shipment.notes ?? ""}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="inline-flex items-center rounded-md border px-3 py-1.5 font-medium text-[11px] hover:bg-muted"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>

      {/* Containers */}
      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="flex items-center justify-between">
          <div className="font-medium text-[11px]">Containers</div>
        </div>

        {containers.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No containers yet. Add the first container below.</p>
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
                      <Link href={`/sales-shipments/${shipment.id}/containers/${c.id}`} className="underline">
                        {c.container_number || "(pending)"}
                      </Link>
                    </td>
                    <td className="px-2 py-1 text-[11px]">{c.type || "-"}</td>
                    <td className="px-2 py-1 text-[11px] capitalize">{c.status}</td>
                    <td className="px-2 py-1 text-[11px]">{c.seal_number || "-"}</td>
                    <td className="px-2 py-1 text-right text-[11px]">
                      <form
                        action={async (formData: FormData) => {
                          "use server";

                          const profile = await getCurrentUserProfile();

                          if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
                            redirect("/unauthorized");
                          }

                          const containerId = (formData.get("container_id") || "").toString().trim();
                          const shipmentId = (formData.get("shipment_id") || "").toString().trim();

                          if (!containerId || !shipmentId) {
                            redirect(`/purchase-shipments/${shipment.id}/edit`);
                          }

                          const { error: delError } = await serverSupabase
                            .from("shipment_containers")
                            .delete()
                            .eq("id", containerId);

                          if (delError) {
                            console.error("Error deleting shipment container", delError);
                          }

                          redirect(`/purchase-shipments/${shipmentId}/edit`);
                        }}
                        className="inline"
                      >
                        <input type="hidden" name="container_id" value={c.id as string} />
                        <input type="hidden" name="shipment_id" value={shipment.id as string} />
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-md border px-2 py-0.5 font-medium text-[10px] text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add container */}
      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="font-medium text-[11px]">Add container</div>
        <form
          action={async (formData: FormData) => {
            "use server";

            const profile = await getCurrentUserProfile();

            if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
              redirect("/unauthorized");
            }

            const shipmentId = (formData.get("shipment_id") || "").toString().trim();
            const containerNumberRaw = (formData.get("container_number") || "").toString().trim();
            const type = (formData.get("type") || "").toString().trim();
            const seal = (formData.get("seal_number") || "").toString().trim();

            if (!shipmentId) {
              redirect(`/purchase-shipments/${id}/edit`);
            }

            let containerNumber = containerNumberRaw;

            // If no container number provided, auto-generate based on shipment name: {shipment_number}ContPln001
            if (!containerNumber) {
              const { data: shipmentRow, error: shipError } = await serverSupabase
                .from("shipments")
                .select("id, shipment_number")
                .eq("id", shipmentId)
                .maybeSingle();

              if (shipError || !shipmentRow) {
                console.error("Error loading shipment for container auto-number", shipError);
                redirect(`/purchase-shipments/${id}/edit`);
              }

              const shipmentNumber = ((shipmentRow as any).shipment_number as string) || "";
              const basePrefix = shipmentNumber ? `${shipmentNumber}ContPln` : "ContPln";

              const { data: existing, error: numError } = await serverSupabase
                .from("shipment_containers")
                .select("container_number")
                .eq("shipment_id", shipmentId);

              if (numError) {
                console.error("Error loading existing containers for auto-number", numError);
              }

              let maxSeq = 0;
              for (const row of existing || []) {
                const num = (row.container_number as string) || "";
                if (num.startsWith(basePrefix)) {
                  const tail = num.slice(basePrefix.length);
                  const n = parseInt(tail, 10);
                  if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
                }
              }

              const nextSeq = maxSeq + 1;
              containerNumber = `${basePrefix}${nextSeq.toString().padStart(3, "0")}`;
            }

            const { error: insertError } = await serverSupabase.from("shipment_containers").insert({
              shipment_id: shipmentId,
              container_number: containerNumber,
              type: type || null,
              seal_number: seal || null,
            });

            if (insertError) {
              console.error("Error inserting shipment container", insertError);
            }

            redirect(`/purchase-shipments/${id}/edit`);
          }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-4"
        >
          <input type="hidden" name="shipment_id" value={shipment.id as string} />
          <div className="space-y-1">
            <label htmlFor="container_number" className="font-medium text-[11px]">
              Container #
            </label>
            <input
              id="container_number"
              name="container_number"
              type="text"
              placeholder="e.g. ABCU1234567"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="type" className="font-medium text-[11px]">
              Type
            </label>
            <input
              id="type"
              name="type"
              type="text"
              placeholder="40HC, 20GP"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="seal_number" className="font-medium text-[11px]">
              Seal
            </label>
            <input
              id="seal_number"
              name="seal_number"
              type="text"
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-md border px-3 py-1.5 font-medium text-[11px] hover:bg-muted"
            >
              Add container
            </button>
          </div>
        </form>
      </div>

      {error && <p className="pt-2 text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
