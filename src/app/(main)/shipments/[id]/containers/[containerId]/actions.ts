"use server";

import { revalidatePath } from "next/cache";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export async function saveShipmentEvents(formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    return { ok: false, error: "Not authorized" };
  }

  const shipmentContainerId = (formData.get("shipment_container_id") || "").toString().trim();

  if (!shipmentContainerId) {
    return { ok: false, error: "Missing shipment_container_id" };
  }

  const isfEtd = (formData.get("isf_etd") || "").toString().trim() || null;
  const isfEta = (formData.get("isf_eta") || "").toString().trim() || null;
  const bolValue = (formData.get("bol") || "").toString().trim() || null;
  const telexRelease = (formData.get("telex_release") || "").toString().trim() === "on";
  const customsRelease = (formData.get("customs_release") || "").toString().trim() === "on";
  const freightRelease = (formData.get("freight_release") || "").toString().trim() === "on";
  const cpsHold = (formData.get("cps_hold") || "").toString().trim() === "on";
  const terminal = (formData.get("terminal") || "").toString().trim() || null;
  const holdType = (formData.get("hold_type") || "").toString().trim() || null;
  const arrivalNotes = (formData.get("arrival_notes") || "").toString().trim() || null;
  const doEta = (formData.get("do_eta") || "").toString().trim() || null;

  const rawStatus = (formData.get("status") || "").toString().trim();
  // Normalize status to match check constraint values (lowercase, underscores)
  const status = (rawStatus || "not_departed").toLowerCase().replace(/\s+/g, "_");

  const payload = {
    isf_etd: isfEtd,
    isf_eta: isfEta,
    isf_bol: bolValue,
    arrival_telex_release: telexRelease,
    arrival_customs_release: customsRelease,
    arrival_freight_release: freightRelease,
    arrival_cps_hold: cpsHold,
    arrival_terminal: terminal,
    arrival_hold: holdType,
    arrival_notes: arrivalNotes,
    do_eta: doEta,
    status,
  };

  console.log("saveShipmentEvents payload", payload);

  const { data, error } = await serverSupabase
    .from("shipment_containers")
    .update(payload)
    .eq("id", shipmentContainerId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Error saving shipment container events", error);
    throw new Error(error.message);
  }

  // Revalidate the container edit route
  revalidatePath("/shipments/[id]/containers/[containerId]");

  return { ok: true };
}
