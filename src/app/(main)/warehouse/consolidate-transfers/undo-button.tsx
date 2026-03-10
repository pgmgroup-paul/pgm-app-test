"use client";

import { useActionState } from "react";

import { handleUndoLastMovement, type UndoFormState } from "./undo-action";

const undoInitialState: UndoFormState = { ok: null };

export function UndoLastMovementButton() {
  const [state, formAction] = useActionState<UndoFormState, FormData>(handleUndoLastMovement, undoInitialState);

  return (
    <form action={formAction} className="mt-3">
      <button
        type="submit"
        disabled={state.ok === true}
        className="inline-flex items-center rounded-md border border-amber-500 bg-amber-50 px-2 py-1 font-medium text-[11px] text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Undo last movement
      </button>

      {state.ok === true && state.message && <p className="mt-1 text-emerald-700 text-xs">{state.message}</p>}

      {state.ok === false && state.error && <p className="mt-1 text-destructive text-xs">{state.error}</p>}
    </form>
  );
}
