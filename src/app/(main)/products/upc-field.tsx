"use client";

import { useRef } from "react";

export function UpcField() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleGenerate = () => {
    const input = inputRef.current;
    if (!input) return;
    // Generate a fairly unique temp UPC; prefix with TEMP- to distinguish
    const rand = Math.floor(Math.random() * 1_000_000_0000) // 10 digits
      .toString()
      .padStart(10, "0");
    const value = `TEMP-${rand}`;
    input.value = value;
    // Trigger native input/change events so formData sees it consistently if needed
    const event = new Event("input", { bubbles: true });
    input.dispatchEvent(event);
  };

  return (
    <div className="space-y-1 text-sm">
      <label htmlFor="upc" className="font-medium">
        UPC
      </label>
      <input
        id="upc"
        name="upc"
        type="text"
        required
        ref={inputRef}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="button"
        onClick={handleGenerate}
        className="mt-1 inline-flex items-center rounded-md border border-dashed border-input px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted/40"
      >
        Generate temporary UPC
      </button>
      <p className="text-[11px] text-muted-foreground">
        Use this when the real UPC is not yet available. A TEMP- prefixed value will be generated
        and can be updated later.
      </p>
    </div>
  );
}
