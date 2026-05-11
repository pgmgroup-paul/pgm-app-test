"use server";

import { revalidatePath } from "next/cache";

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

    // After successful receive, check if this container belongs to a shipment and auto-complete if all are unloaded
    const { data: containerRow, error: containerLoadError } = await supabase
      .from("containers_v2")
      .select("id, shipment_id")
      .eq("id", containerId)
      .maybeSingle();

    if (containerLoadError) {
      console.error("Error loading container for shipment completion check", containerLoadError);
    } else if (containerRow && (containerRow as any).shipment_id) {
      const shipmentId = (containerRow as any).shipment_id as string;

      // Load all containers for this shipment
      const { data: shipmentContainers, error: shipmentContainersError } = await supabase
        .from("containers_v2")
        .select("status")
        .eq("shipment_id", shipmentId);

      if (shipmentContainersError) {
        console.error("Error loading shipment containers for completion check", shipmentContainersError);
      } else if (shipmentContainers && shipmentContainers.length > 0) {
        const allUnloaded = shipmentContainers.every((c) => {
          const status = ((c as any).status || "").toString().trim();
          return status === "Unloaded";
        });

        if (allUnloaded) {
          const { error: shipmentUpdateError } = await supabase
            .from("shipments_v2")
            .update({ status: "Completed" })
            .eq("id", shipmentId);

          if (shipmentUpdateError) {
            console.error("Error auto-completing shipment after all containers unloaded", shipmentUpdateError);
          } else {
            // Revalidate related shipment and container pages so status updates are visible
            revalidatePath(`/inbound-shipments/${shipmentId}`);
            revalidatePath("/inbound-shipments");
            revalidatePath(`/inbound-containers/${containerId}`);
            revalidatePath("/inbound-containers");
          }
        }
      }
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
