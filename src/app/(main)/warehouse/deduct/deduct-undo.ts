"use server";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export interface UndoDeductState {
  ok: boolean | null;
  error?: string;
  message?: string;
}

export async function handleUndoDeduct(_prev: UndoDeductState, formData: FormData): Promise<UndoDeductState> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }

  const movementId = (formData.get("movement_id") || "").toString().trim();

  if (!movementId) {
    return { ok: false, error: "No deduct movement to undo" };
  }

  const supabase = serverSupabase;

  const { error } = await supabase.rpc("undo_deduct_movement", {
    p_movement_id: movementId,
  });

  if (error) {
    console.error("Error undoing deduct", error);
    return { ok: false, error: error.message || "Undo deduct failed" };
  }

  return {
    ok: true,
    message: "Last deduct was undone successfully.",
  };
}
