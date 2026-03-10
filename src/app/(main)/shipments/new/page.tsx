import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export const dynamic = "force-dynamic";

export default async function NewShipmentPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/unauthorized");
  }

  const { error } = await searchParams;

  return (
    <div className="max-w-2xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-lg tracking-tight">New shipment</h1>
        <p className="text-muted-foreground text-sm">Create a shipment to group containers and purchase orders.</p>
      </div>

      <form
        action={async (formData: FormData) => {
          "use server";

          const profile = await getCurrentUserProfile();

          if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
            redirect("/unauthorized");
          }

          const origin = (formData.get("origin_port") || "").toString().trim();
          const destination = (formData.get("destination_port") || "").toString().trim();
          const etdRaw = (formData.get("etd") || "").toString().trim();
          const etaRaw = (formData.get("eta") || "").toString().trim();
          const incoterms = (formData.get("incoterms") || "").toString().trim();
          const carrier = (formData.get("carrier") || "").toString().trim();
          const vessel = (formData.get("vessel") || "").toString().trim();
          const voyage = (formData.get("voyage") || "").toString().trim();
          const notes = (formData.get("notes") || "").toString().trim();

          // Auto-generate shipment number (sequential PGM00001, PGM00002, ...)
          let shipmentNumber = "";
          {
            const prefix = "PGM";
            const { data: existing, error: numError } = await serverSupabase
              .from("shipments")
              .select("shipment_number")
              .order("created_at", { ascending: false })
              .limit(50);

            if (numError) {
              console.error("Error loading existing shipments for auto-number", numError);
            }

            let maxSeq = 0;
            for (const row of existing || []) {
              const num = (row.shipment_number as string) || "";
              if (!num.startsWith(prefix)) continue;
              const tail = num.slice(prefix.length).replace(/^0+/, "");
              const n = tail ? parseInt(tail, 10) : 0;
              if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
            }

            const nextSeq = maxSeq + 1;
            shipmentNumber = prefix + nextSeq.toString().padStart(5, "0");
          }

          const { data, error } = await serverSupabase
            .from("shipments")
            .insert({
              shipment_number: shipmentNumber,
              origin_port: origin || null,
              destination_port: destination || null,
              etd: etdRaw || null,
              eta: etaRaw || null,
              incoterms: incoterms || null,
              carrier: carrier || null,
              vessel: vessel || null,
              voyage: voyage || null,
              notes: notes || null,
            })
            .select("id")
            .single();

          if (error || !data) {
            console.error("Error creating shipment", error);
            redirect("/shipments/new?error=create-failed");
          }

          redirect(`/shipments/${data.id}/edit`);
        }}
        className="space-y-3 rounded-md border px-3 py-3 text-sm"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="font-medium">Shipment number</label>
            <div className="w-full rounded-md border border-input border-dashed bg-muted px-3 py-2 text-muted-foreground text-xs">
              Will be assigned automatically (PGM00001, PGM00002, ...)
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="incoterms" className="font-medium">
              Incoterms
            </label>
            <input
              id="incoterms"
              name="incoterms"
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="origin_port" className="font-medium">
              Origin port
            </label>
            <input
              id="origin_port"
              name="origin_port"
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="destination_port" className="font-medium">
              Destination port
            </label>
            <input
              id="destination_port"
              name="destination_port"
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="etd" className="font-medium">
              ETD
            </label>
            <input
              id="etd"
              name="etd"
              type="date"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="eta" className="font-medium">
              ETA
            </label>
            <input
              id="eta"
              name="eta"
              type="date"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="carrier" className="font-medium">
              Carrier
            </label>
            <input
              id="carrier"
              name="carrier"
              type="text"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="vessel" className="font-medium">
              Vessel / Voyage
            </label>
            <div className="flex gap-2">
              <input
                id="vessel"
                name="vessel"
                type="text"
                placeholder="Vessel"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <input
                id="voyage"
                name="voyage"
                type="text"
                placeholder="Voyage"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="notes" className="font-medium">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-xs hover:bg-primary/90"
        >
          Save & continue
        </button>

        {error === "create-failed" && <p className="mt-2 text-destructive text-xs">Failed to create shipment.</p>}
      </form>
    </div>
  );
}
