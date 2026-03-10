"use server";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export interface ContainerReceiveState {
  ok: boolean | null;
  error?: string;
  message?: string;
}

export async function markContainerReceived(
  _prev: ContainerReceiveState,
  formData: FormData,
): Promise<ContainerReceiveState> {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }

  const containerId = (formData.get("container_id") || "").toString().trim();

  if (!containerId) {
    return { ok: false, error: "No container selected" };
  }

  const supabase = serverSupabase;

  // Resolve container from shipment_containers
  const { data: container, error: contError } = await supabase
    .from("shipment_containers")
    .select("id, status, container_number")
    .eq("id", containerId)
    .maybeSingle();

  if (contError || !container) {
    console.error("Error resolving container for receive", contError);
    return { ok: false, error: "Container not found" };
  }

  if (container.status !== "received") {
    return { ok: false, error: "Container is not in received status" };
  }

  // Build line payloads for receive_container RPC from shipment_items + PO/product snapshot
  const { data: items, error: itemsError } = await supabase
    .from("shipment_items")
    .select(
      `quantity,
       purchase_order_lines (
         id,
         product_id,
         sku,
         sku_var,
         description
       )`,
    )
    .eq("shipment_container_id", containerId);

  if (itemsError) {
    console.error("Error loading shipment_items for receive", itemsError);
    return { ok: false, error: "Failed to load container contents" };
  }

  // Aggregate received quantities from inventory_movements by product for this container
  const { data: moves, error: movError } = await supabase
    .from("inventory_movements")
    .select("product_id, quantity_cases")
    .eq("movement_type", "add")
    .eq("source_type", "container")
    .eq("source_ref", container.container_number as string);

  if (movError) {
    console.error("Error loading inventory_movements for receive", movError);
  }

  const receivedCasesByProduct = new Map<string, number>();
  for (const m of (moves || []) as any[]) {
    const pid = m.product_id as string;
    const qtyCases = Number(m.quantity_cases) || 0;
    if (!pid || qtyCases <= 0) continue;
    receivedCasesByProduct.set(pid, (receivedCasesByProduct.get(pid) || 0) + qtyCases);
  }

  // Load units_per for conversion to units
  const productIdsForUnits = Array.from(
    new Set(
      (items || [])
        .map((it: any) => it.purchase_order_lines?.product_id as string | undefined)
        .filter(Boolean) as string[],
    ),
  );

  const { data: dims, error: dimsError } = await supabase
    .from("product_dimensions")
    .select("product_id, units_per")
    .in("product_id", productIdsForUnits);

  if (dimsError) {
    console.error("Error loading product_dimensions for receive", dimsError);
  }

  const unitsPerMap = new Map<string, number>();
  for (const d of (dims || []) as any[]) {
    const pid = d.product_id as string;
    const units = Number(d.units_per) || 0;
    if (units > 0 && !unitsPerMap.has(pid)) unitsPerMap.set(pid, units);
  }

  const receivedUnitsByProduct = new Map<string, number>();
  for (const [pid, cases] of receivedCasesByProduct.entries()) {
    const unitsPer = unitsPerMap.get(pid) || 0;
    if (unitsPer <= 0) continue;
    receivedUnitsByProduct.set(pid, cases * unitsPer);
  }

  const linesPayload = (items || [])
    .map((it: any) => {
      const line = it.purchase_order_lines;
      if (!line) return null;
      const expectedUnits = Number(it.quantity) || 0;
      if (!line.id || !line.product_id || expectedUnits <= 0) return null;

      const pid = line.product_id as string;
      const receivedUnits = receivedUnitsByProduct.get(pid) ?? expectedUnits;
      const unitsPer = unitsPerMap.get(pid) || 0;
      const receivedCases = unitsPer > 0 ? receivedUnits / unitsPer : null;

      return {
        purchase_order_line_id: line.id as string,
        product_id: pid,
        sku: (line.sku as string) || "",
        sku_var: (line.sku_var as string) || null,
        product_name: (line.description as string) || "",
        quantity_expected_units: expectedUnits,
        quantity_received_units: receivedUnits,
        quantity_received_cases: receivedCases,
        units_per_case: unitsPer || null,
        line_notes: null,
      };
    })
    .filter((l) => l !== null);

  try {
    const { error: rpcError } = await supabase.rpc("receive_container", {
      p_shipment_container_id: containerId,
      p_lines: linesPayload,
      p_received_by: profile.id,
    });

    if (rpcError) {
      console.error("Error calling receive_container RPC", rpcError);
      return {
        ok: false,
        error: rpcError.message || "Failed to record container receipt",
      };
    }
  } catch (err: any) {
    console.error("Exception in receive_container RPC", err);
    return {
      ok: false,
      error: err?.message || "Failed to record container receipt",
    };
  }

  return {
    ok: true,
    message: "Container receipt recorded and marked as unloaded.",
  };
}

export async function undoContainerReceived(
  _prev: ContainerReceiveState,
  formData: FormData,
): Promise<ContainerReceiveState> {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }

  const containerId = (formData.get("container_id") || "").toString().trim();

  if (!containerId) {
    return { ok: false, error: "No container selected" };
  }

  const supabase = serverSupabase;

  // Check container exists in shipment_containers
  const { data: container, error: contError } = await supabase
    .from("shipment_containers")
    .select("id, status")
    .eq("id", containerId)
    .maybeSingle();

  if (contError || !container) {
    console.error("Error resolving container for undo", contError);
    return { ok: false, error: "Container not found" };
  }

  // Update container back to received
  const { error: upError } = await supabase
    .from("shipment_containers")
    .update({ status: "received" })
    .eq("id", containerId);

  if (upError) {
    console.error("Error updating container status to receiving", upError);
    return { ok: false, error: "Failed to update container status" };
  }

  // Note: for now we only flip the shipment_container status back to 'received'.
  // We do not roll back quantity_received on PO lines here.

  return {
    ok: true,
    message: "Container receive status undone.",
  };
}
