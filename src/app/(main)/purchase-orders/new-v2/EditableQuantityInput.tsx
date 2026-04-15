"use client";

import { useRef } from "react";

export default function EditableQuantityInput({
  defaultValue,
}: {
  defaultValue: number;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <input
      ref={ref}
      type="number"
      name="quantity_cases"
      defaultValue={defaultValue}
      className="w-20 border rounded px-1 text-right"
      onBlur={(e) => {
        const form = e.currentTarget.form;
        if (!form) return;
        const newValue = Number(e.currentTarget.value);
        if (newValue !== defaultValue) {
          form.requestSubmit();
        }
      }}
    />
  );
}
