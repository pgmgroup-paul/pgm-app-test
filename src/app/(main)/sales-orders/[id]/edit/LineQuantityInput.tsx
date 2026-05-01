"use client";

export function LineQuantityInput({
  lineId,
  defaultValue,
  onSubmitAction,
  disabled,
}: {
  lineId: string;
  defaultValue: number;
  onSubmitAction: (formData: FormData) => void | Promise<void>;
  disabled?: boolean;
}) {
  return (
    <form action={onSubmitAction}>
      <input type="hidden" name="line_id" value={lineId} />
      <input
        type="number"
        name="quantity_units"
        defaultValue={defaultValue}
        min={1}
        disabled={disabled}
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
