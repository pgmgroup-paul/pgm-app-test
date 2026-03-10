import { serverSupabase } from "@/lib/serverSupabase";

import { saveShipmentEvents } from "./actions";

interface ContainerShipmentEventsSectionProps {
  shipmentContainerId: string;
}

export default async function ContainerShipmentEventsSection({
  shipmentContainerId,
}: ContainerShipmentEventsSectionProps) {
  const { data, error } = await serverSupabase
    .from("shipment_containers")
    .select("*")
    .eq("id", shipmentContainerId)
    .maybeSingle();

  if (error) {
    console.error("Error loading shipment_container_events in section", error);
  }

  const events = (data || null) as any | null;

  return (
    <form action={saveShipmentEvents} className="space-y-3 rounded-md border px-3 py-3 text-xs">
      <input type="hidden" name="shipment_container_id" value={shipmentContainerId} />

      {/* ISF block */}
      <div className="space-y-2">
        <div className="font-medium text-[11px]">ISF</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="isf_etd" className="text-[11px] text-muted-foreground">
              ETD
            </label>
            <input
              id="isf_etd"
              name="isf_etd"
              type="date"
              defaultValue={events?.isf_etd ?? ""}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="isf_eta" className="text-[11px] text-muted-foreground">
              ETA
            </label>
            <input
              id="isf_eta"
              name="isf_eta"
              type="date"
              defaultValue={events?.isf_eta ?? ""}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="bol" className="text-[11px] text-muted-foreground">
              BOL
            </label>
            <input
              id="bol"
              name="bol"
              type="text"
              defaultValue={events?.isf_bol ?? ""}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Arrival Notice block */}
      <div className="space-y-2">
        <div className="font-medium text-[11px]">Arrival notice</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  name="telex_release"
                  defaultChecked={!!events?.arrival_telex_release}
                  className="h-3 w-3 border-input text-primary focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span>Telex release</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  name="customs_release"
                  defaultChecked={!!events?.arrival_customs_release}
                  className="h-3 w-3 border-input text-primary focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span>Customs release</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  name="freight_release"
                  defaultChecked={!!events?.arrival_freight_release}
                  className="h-3 w-3 border-input text-primary focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span>Freight release</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  name="cps_hold"
                  defaultChecked={!!events?.arrival_cps_hold}
                  className="h-3 w-3 border-input text-primary focus-visible:ring-1 focus-visible:ring-ring"
                />
                <span>CPS hold</span>
              </label>
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="terminal" className="text-[11px] text-muted-foreground">
              Terminal
            </label>
            <input
              id="terminal"
              name="terminal"
              type="text"
              defaultValue={events?.arrival_terminal ?? ""}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <label htmlFor="hold_type" className="mt-2 block text-[11px] text-muted-foreground">
              Hold type
            </label>
            <select
              id="hold_type"
              name="hold_type"
              defaultValue={events?.hold_type ?? events?.arrival_hold ?? ""}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">None</option>
              <option value="FDA">FDA</option>
              <option value="CTF">CTF</option>
              <option value="Freight">Freight</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="arrival_notes" className="text-[11px] text-muted-foreground">
              Arrival notes
            </label>
            <textarea
              id="arrival_notes"
              name="arrival_notes"
              rows={4}
              defaultValue={events?.arrival_notes ?? ""}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Delivery Order block */}
      <div className="space-y-2">
        <div className="font-medium text-[11px]">Delivery order</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="do_eta" className="text-[11px] text-muted-foreground">
              DO ETA
            </label>
            <input
              id="do_eta"
              name="do_eta"
              type="date"
              defaultValue={events?.do_eta ?? ""}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Update Status block */}
      <div className="space-y-2">
        <div className="font-medium text-[11px]">Status</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="status" className="text-[11px] text-muted-foreground">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={events?.status ?? "not_departed"}
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="not_departed">Not Departed</option>
              <option value="on_water">On Water</option>
              <option value="arrived">Arrived</option>
              <option value="arrival_notice">Arrival Notice</option>
              <option value="received">Received</option>
              <option value="unloaded">Unloaded</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
        >
          Save shipment events
        </button>
      </div>
    </form>
  );
}
