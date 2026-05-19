"use server";

import { revalidatePath } from "next/cache";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";
import { logActivity } from "@/lib/activity/log-activity";

export async function saveContainerNumberAction(formData: FormData): Promise<void> {
  try {
    const containerId = (formData.get("container_id") || "").toString().trim();
    const rawNumber = (formData.get("container_number") || "").toString().trim();

    console.log("SAVE_CONTAINER_NUMBER_ACTION_INPUT", {
      containerId,
      rawNumber,
    });

    if (!containerId) {
      return;
    }

    const newNumber = rawNumber.toUpperCase();

    console.log("SAVE_CONTAINER_NUMBER_ACTION_NORMALIZED", {
      containerId,
      rawNumber,
      newNumber,
    });

    // Load existing container to determine previous number
    const { data: existing, error: loadError } = await serverSupabase
      .from("containers_v2")
      .select("container_number")
      .eq("id", containerId)
      .maybeSingle();

    console.log("SAVE_CONTAINER_NUMBER_ACTION_EXISTING", {
      existingContainerNumber: existing?.container_number,
      loadError,
    });

    if (loadError || !existing) {
      return;
    }

    const prevNumber = ((existing as any).container_number || "")
      .trim()
      .toUpperCase();
    const isFirstRealContainerAssignment = !prevNumber && !!newNumber;

    console.log("SAVE_CONTAINER_NUMBER_ACTION_BUSINESS_RULE", {
      prevNumber,
      newNumber,
      isFirstRealContainerAssignment,
    });

    // Update container_number
    const { error: updateError } = await serverSupabase
      .from("containers_v2")
      .update({ container_number: newNumber })
      .eq("id", containerId);

    console.log("SAVE_CONTAINER_NUMBER_ACTION_UPDATE_RESULT", {
      updateError,
    });

    if (updateError) {
      return;
    }

    // Log creation event on first real assignment
    if (isFirstRealContainerAssignment) {
      try {
        const profile = await getCurrentUserProfile();

        console.log("SAVE_CONTAINER_NUMBER_ACTION_PROFILE", {
          hasProfile: !!profile,
          id: profile?.id,
          email: profile?.email,
          full_name: profile?.full_name,
        });

        if (profile) {
          const userId = profile.id as string;
          const userName =
            (profile.full_name as string | undefined) ||
            (profile.email as string | undefined) ||
            "Unknown User";

          console.log("ATTEMPTING_CONTAINER_ACTIVITY_LOG", {
            userId,
            userName,
            containerId,
            newNumber,
          });

          await logActivity({
            supabase: serverSupabase,
            userId,
            userName,
            eventType: "container_created",
            entityType: "container",
            entityId: containerId,
            entityLabel: newNumber,
            message: `created Container ${newNumber}`,
          });

          console.log("CONTAINER_ACTIVITY_LOGGED");
        }
      } catch (err) {
        // Logging failures must never interrupt the save flow
        console.error("Failed to log container creation activity (server)", err);
      }
    }

    // Ensure detail page reflects latest data
    revalidatePath(`/inbound-containers/${containerId}`);
  } catch (err) {
    // Action failures should not crash the app; surface in logs only
    console.error("Unexpected error in saveContainerNumberAction", err);
  }
}
