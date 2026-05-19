"use server";

import { revalidatePath } from "next/cache";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";
import { logActivity } from "@/lib/activity/log-activity";

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
    // Load previous container status before running the receive RPC
    const { data: existingContainer, error: existingLoadError } = await supabase
      .from("containers_v2")
      .select("status")
      .eq("id", containerId)
      .maybeSingle();

    const previousStatus = (((existingContainer as any)?.status || "") as string).trim();

    console.log("RECEIVE_CONTAINER_BEFORE_RPC", {
      containerId,
      previousStatus,
      existingLoadError,
    });

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

    // After successful receive, check resulting container status and log unload activity when appropriate
    const { data: containerRow, error: containerLoadError } = await supabase
      .from("containers_v2")
      .select("id, shipment_id, status, container_number")
      .eq("id", containerId)
      .maybeSingle();

    console.log("RECEIVE_CONTAINER_AFTER_RPC", {
      containerId,
      status: (containerRow as any)?.status,
      containerNumber: (containerRow as any)?.container_number,
      containerLoadError,
    });

    if (!containerLoadError && containerRow) {
      const resultingStatus = (((containerRow as any).status || "") as string).trim();
      const wasUnloadedBefore = previousStatus === "Unloaded";
      const isNowUnloaded = resultingStatus === "Unloaded";

      console.log("RECEIVE_CONTAINER_UNLOAD_DECISION", {
        previousStatus,
        resultingStatus,
        wasUnloadedBefore,
        isNowUnloaded,
      });

      // Log unload activity only when transitioning into Unloaded
      if (!wasUnloadedBefore && isNowUnloaded) {
        try {
          const containerNumber =
            (((containerRow as any).container_number || "") as string).trim() || containerId;

          const userName =
            (profile.full_name as string | undefined) ||
            (profile.email as string | undefined) ||
            "Unknown User";

          console.log("ATTEMPTING_CONTAINER_UNLOADED_ACTIVITY_LOG", {
            userId: profile.id,
            userName,
            containerId,
            containerNumber,
          });

          await logActivity({
            supabase,
            userId: profile.id as string,
            userName,
            eventType: "container_unloaded",
            entityType: "container",
            entityId: containerId,
            entityLabel: containerNumber,
            message: `unloaded Container ${containerNumber}`,
          });

          console.log("CONTAINER_UNLOADED_ACTIVITY_LOGGED");
        } catch (activityErr) {
          console.error(
            "Failed to log container_unloaded activity (server receive flow)",
            activityErr,
          );
        }
      }
    }

    // After successful receive, check if this container belongs to a shipment and auto-complete if all are unloaded
    const { data: shipmentContainerRow, error: containerLoadError2 } = await supabase
      .from("containers_v2")
      .select("id, shipment_id")
      .eq("id", containerId)
      .maybeSingle();

    if (containerLoadError2) {
      console.error("Error loading container for shipment completion check", containerLoadError2);
    } else if (shipmentContainerRow && (shipmentContainerRow as any).shipment_id) {
      const shipmentId = (shipmentContainerRow as any).shipment_id as string;

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
