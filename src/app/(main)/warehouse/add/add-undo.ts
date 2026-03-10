"use server";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export interface UndoAddState {
  ok: boolean | null;
  error?: string;
  message?: string;
}

export async function handleUndoAdd(_prev: UndoAddState, formData: FormData): Promise<UndoAddState> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }

  const movementId = (formData.get("movement_id") || "").toString().trim();

  if (!movementId) {
    return { ok: false, error: "No add movement to undo" };
  }

  const supabase = serverSupabase;

  const { error } = await supabase.rpc("undo_add_movement", {
    p_movement_id: movementId,
  });

  if (error) {
    console.error("Error undoing add", error);
    return { ok: false, error: error.message || "Undo add failed" };
  }

  return {
    ok: true,
    message: "Last add was undone successfully.",
  };
}
