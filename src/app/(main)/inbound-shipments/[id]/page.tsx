import Link from "next/link";
import { serverSupabase } from "@/lib/serverSupabase";
import { revalidatePath } from "next/cache";
import { ContainersTable } from "./ContainersTable";
import { AvailableContainersTable } from "./AvailableContainersTable";

export const dynamic = "force-dynamic";

const shipmentStatusBadgeMap: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 border-gray-200",
  Planned: "bg-blue-100 text-blue-700 border-blue-200",
  Booked: "bg-purple-100 text-purple-700 border-purple-200",
  "In Transit": "bg-yellow-100 text-yellow-800 border-yellow-200",
  Arrived: "bg-green-100 text-green-700 border-green-200",
  Delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {children}
    </div>
  );
}

async function updateShipment(formData: FormData) {
  "use server";

  const shipmentId = formData.get("shipment_id") as string;
  const bolNumber = (formData.get("bol_number") as string) || null;
  const eta = (formData.get("eta") as string) || null;
  const status = (formData.get("status") as string) || null;

  const isfFiled = (formData.get("isf_filed") || "").toString().trim() === "on";
  const bolReceived = (formData.get("bol_received") || "").toString().trim() === "on";
  const arrivalNotice = (formData.get("arrival_notice") || "").toString().trim() === "on";
  const telexRelease = (formData.get("telex_release") || "").toString().trim() === "on";
  const customsRelease = (formData.get("customs_release") || "").toString().trim() === "on";
  const freightRelease = (formData.get("freight_release") || "").toString().trim() === "on";
  const cpsHold = (formData.get("cps_hold") || "").toString().trim() === "on";
  const terminal =
    (formData.get("terminal") || "").toString().trim() || null;
  const holdType =
    (formData.get("hold_type") || "").toString().trim() || null;

  if (!shipmentId) {
    console.error("Missing shipment_id in updateShipment");
    return;
  }

  const { error } = await serverSupabase
    .from("shipments_v2")
    .update({
      bol_number: bolNumber,
      eta,
      status,
      isf_filed: isfFiled,
      bol_received: bolReceived,
      arrival_notice: arrivalNotice,
      telex_release: telexRelease,
      customs_release: customsRelease,
      freight_release: freightRelease,
      cps_hold: cpsHold,
      terminal,
      hold_type: holdType,
    })
    .eq("id", shipmentId);

  if (error) {
    console.error("Error updating shipment", error);
    return;
  }

  // Ensure fresh data on re-render
  revalidatePath(`/inbound-shipments/${shipmentId}`);
}

async function removeContainer(formData: FormData) {
  "use server";

  const shipmentId = formData.get("shipment_id") as string;
  const containerId = formData.get("container_id") as string;

  if (!containerId) {
    console.error("Missing container_id in removeContainer");
    return;
  }

  const { error } = await serverSupabase
    .from("containers_v2")
    .update({ shipment_id: null })
    .eq("id", containerId);

  if (error) {
    console.error("Error removing container", error);
    return;
  }

  if (shipmentId) {
    revalidatePath(`/inbound-shipments/${shipmentId}`);
  }
}

async function addContainer(formData: FormData) {
  "use server";

  const shipmentId = formData.get("shipment_id") as string;
  const containerId = formData.get("container_id") as string;

  if (!shipmentId || !containerId) {
    console.error("Missing shipment_id or container_id in addContainer");
    return;
  }

  const { error } = await serverSupabase
    .from("containers_v2")
    .update({ shipment_id: shipmentId })
    .eq("id", containerId);

  if (error) {
    console.error("Error adding container to shipment", error);
    return;
  }

  revalidatePath(`/inbound-shipments/${shipmentId}`);
}

export default async function Page({ params }: any) {
  const resolvedParams = await params;
  const shipmentId = resolvedParams.id;
  const supabase = serverSupabase;

  console.log("Shipment ID:", shipmentId);

  // 1) Fetch shipment detail from shipments_v2
  const { data: shipmentRows, error: shipmentError } = await supabase
    .from("shipments_v2")
    .select("*")
    .eq("id", shipmentId);

  if (shipmentError) {
    console.error("Error loading shipment detail", shipmentError);
    return (
      <div className="p-6 text-sm text-red-500">Error loading shipment</div>
    );
  }

  const shipment = (shipmentRows || [])[0] || null;

  // 2) Fetch containers from shipment_containers_view
  const { data: containerRows, error: containersError } = await supabase
    .from("shipment_containers_view")
    .select("*")
    .eq("shipment_id", shipmentId)
    .order("created_at", { ascending: false });

  if (containersError) {
    console.error("Error loading containers for shipment", containersError);
    return (
      <div className="p-6 text-sm text-red-500">Error loading containers</div>
    );
  }

  const containers = containerRows || [];

  const canEditContainers =
    shipment && (shipment as any).status
      ? (shipment as any).status === "Draft" ||
        (shipment as any).status === "Planned"
      : false;

  let availableContainers: any[] = [];

  if (canEditContainers) {
    // 3) Fetch available containers (not assigned to any shipment)
    const { data: availableRows, error: availableError } = await supabase
      .from("containers_v2")
      .select("id, container_number, temp_code, status")
      .is("shipment_id", null);

    if (availableError) {
      console.error("Error loading available containers", availableError);
      return (
        <div className="p-6 text-sm text-red-500">
          Error loading available containers
        </div>
      );
    }

    availableContainers = availableRows || [];
  }

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-6 text-xs md:text-sm">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Shipment header with editable fields */}
        <SectionCard>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                Inbound Shipment
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {shipment?.shipment_number || shipmentId}
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2 sm:mt-0">
              <span className="text-[11px] font-medium text-slate-600">
                Status
              </span>
              {(() => {
                const s = (shipment as any)?.status || "Draft";
                const badgeClasses =
                  shipmentStatusBadgeMap[s] ??
                  "bg-slate-100 text-slate-700 border-slate-200";
                return (
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium ${badgeClasses}`}
                  >
                    {s}
                  </span>
                );
              })()}
            </div>
          </div>

          <form action={updateShipment} className="mt-3 space-y-3 text-xs md:text-sm">
            <input type="hidden" name="shipment_id" value={shipmentId} />

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  BOL
                </label>
                <input
                  name="bol_number"
                  defaultValue={shipment?.bol_number || ""}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  ETA
                </label>
                <input
                  type="date"
                  name="eta"
                  defaultValue={shipment?.eta || ""}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue={shipment?.status || ""}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                >
                  <option value="">Select status</option>
                  <option value="Draft">Draft</option>
                  <option value="Planned">Planned</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Arrived">Arrived</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            {/* Document tracking checkboxes */}
            <div className="grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  name="isf_filed"
                  defaultChecked={!!(shipment as any)?.isf_filed}
                  className="h-3 w-3 border-slate-300 text-sky-600 focus-visible:ring-1 focus-visible:ring-sky-500"
                />
                <span>ISF Filed</span>
              </label>
              <label className="flex items-center gap-2 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  name="bol_received"
                  defaultChecked={!!(shipment as any)?.bol_received}
                  className="h-3 w-3 border-slate-300 text-sky-600 focus-visible:ring-1 focus-visible:ring-sky-500"
                />
                <span>BOL Received</span>
              </label>
              <label className="flex items-center gap-2 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  name="arrival_notice"
                  defaultChecked={!!(shipment as any)?.arrival_notice}
                  className="h-3 w-3 border-slate-300 text-sky-600 focus-visible:ring-1 focus-visible:ring-sky-500"
                />
                <span>Arrival Notice</span>
              </label>
              <label className="flex items-center gap-2 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  name="telex_release"
                  defaultChecked={!!(shipment as any)?.telex_release}
                  className="h-3 w-3 border-slate-300 text-sky-600 focus-visible:ring-1 focus-visible:ring-sky-500"
                />
                <span>Telex Release</span>
              </label>
              <label className="flex items-center gap-2 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  name="customs_release"
                  defaultChecked={!!(shipment as any)?.customs_release}
                  className="h-3 w-3 border-slate-300 text-sky-600 focus-visible:ring-1 focus-visible:ring-sky-500"
                />
                <span>Customs Release</span>
              </label>
              <label className="flex items-center gap-2 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  name="freight_release"
                  defaultChecked={!!(shipment as any)?.freight_release}
                  className="h-3 w-3 border-slate-300 text-sky-600 focus-visible:ring-1 focus-visible:ring-sky-500"
                />
                <span>Freight Release</span>
              </label>
              <label className="flex items-center gap-2 text-[11px] text-slate-700">
                <input
                  type="checkbox"
                  name="cps_hold"
                  defaultChecked={!!(shipment as any)?.cps_hold}
                  className="h-3 w-3 border-slate-300 text-sky-600 focus-visible:ring-1 focus-visible:ring-sky-500"
                />
                <span>CPS Hold</span>
              </label>
            </div>

            {/* Terminal + Hold Type */}
            <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  Terminal
                </label>
                <input
                  name="terminal"
                  defaultValue={(shipment as any)?.terminal || ""}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600">
                  Hold Type
                </label>
                <select
                  name="hold_type"
                  defaultValue={(shipment as any)?.hold_type || ""}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!((shipment as any)?.cps_hold)}
                >
                  <option value="">Hold Type</option>
                  <option value="FDA">FDA</option>
                  <option value="CTF">CTF</option>
                  <option value="Freight">Freight</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="mt-2 rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Save
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard>
          <h2 className="mb-2 text-[13px] font-semibold text-slate-900">
            Containers
          </h2>
          <ContainersTable
            containers={containers as any}
            shipmentId={shipmentId}
            canEditContainers={canEditContainers}
            removeAction={removeContainer}
          />
        </SectionCard>

        <SectionCard>
          <h2 className="mb-2 text-[13px] font-semibold text-slate-900">
            Available Containers
          </h2>

          {canEditContainers ? (
            <>
              <form action={addContainer} className="mb-2 flex gap-2 text-sm">
                <input type="hidden" name="shipment_id" value={shipmentId} />
                <select
                  name="container_id"
                  className="border border-slate-300 px-2 py-1 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select Container
                  </option>
                  {availableContainers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.container_number || c.temp_code || "(pending)"}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Add
                </button>
              </form>

              {availableContainers.length === 0 ? (
                <div className="text-sm text-gray-500">No available containers</div>
              ) : (
                <AvailableContainersTable containers={availableContainers as any} />
              )}
            </>
          ) : (
            <div className="text-[11px] text-red-500">
              Containers can only be added in Draft or Planned status
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
