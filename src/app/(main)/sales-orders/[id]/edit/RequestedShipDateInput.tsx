"use client";

import { FormEvent } from "react";

export function RequestedShipDateInput({
  salesOrderId,
  defaultValue,
  onSubmitAction,
}: {
  salesOrderId: string;
  defaultValue: string | null;
  onSubmitAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={onSubmitAction}
    >
      <input type="hidden" name="sales_order_id" value={salesOrderId} />
      <input
        type="date"
        name="requested_ship_date"
        defaultValue={defaultValue || ""}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
    </form>
  );
}
