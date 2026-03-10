"use client";

import { useState } from "react";

import { ConsolidateLocationForm } from "./consolidate-location-form";
import type { ReceiveFormState } from "./page";
import { UndoLastMovementButton } from "./undo-button";
import { WarehouseForm } from "./warehouse-form";

interface ShellProps {
  warehouses: { id: string; name: string }[];
  transferAction: (state: ReceiveFormState, formData: FormData) => Promise<ReceiveFormState>;
}

export function ConsolidateTransfersShell({ warehouses, transferAction }: ShellProps) {
  const [activeTab, setActiveTab] = useState<"consolidate" | "transfer">("transfer");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b pb-2 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("consolidate")}
          className={`rounded-md px-3 py-1 font-medium text-xs ${
            activeTab === "consolidate" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Consolidate
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("transfer")}
          className={`rounded-md px-3 py-1 font-medium text-xs ${
            activeTab === "transfer" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          Transfers
        </button>
      </div>

      {activeTab === "transfer" && (
        <>
          <WarehouseForm warehouses={warehouses} action={transferAction} />
          <UndoLastMovementButton />
        </>
      )}

      {activeTab === "consolidate" && (
        <>
          <ConsolidateLocationForm warehouses={warehouses} />
          <UndoLastMovementButton />
        </>
      )}
    </div>
  );
}
