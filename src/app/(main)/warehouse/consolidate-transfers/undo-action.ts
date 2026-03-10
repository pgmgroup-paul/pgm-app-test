"use server";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export interface UndoFormState {
  ok: boolean | null;
  error?: string;
  message?: string;
}

export async function handleUndoLastMovement(
  _prevState: UndoFormState | undefined,
  _formData: FormData,
): Promise<UndoFormState> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }

  const { error } = await serverSupabase.rpc("undo_last_movement");

  if (error) {
    console.error("Error undoing last movement", error);
    return { ok: false, error: `Undo failed: ${error.message}` };
  }

  return { ok: true, message: "Last movement undone." };
}
