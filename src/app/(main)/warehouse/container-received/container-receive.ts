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

  try {
    const { error: rpcError } = await supabase.rpc("receive_container_v2", {
      p_container_id: containerId,
      p_received_by: profile.id,
    });

    if (rpcError) {
      console.error("Error calling receive_container_v2 RPC", rpcError);
      return {
        ok: false,
        error: rpcError.message || "Failed to record container receipt",
      };
    }
  } catch (err: any) {
    console.error("Exception in receive_container_v2 RPC", err);
    return {
      ok: false,
      error: err?.message || "Failed to record container receipt",
    };
  }

  return {
    ok: true,
    message: "Container marked as unloaded",
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
