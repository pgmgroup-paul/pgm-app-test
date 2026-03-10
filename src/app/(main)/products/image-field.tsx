"use client";

import { useRef } from "react";

export function ImageField() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleUseWhiteBox = () => {
    const input = inputRef.current;
    if (!input) return;
    input.value = "https://i.imgur.com/fpSFPSa.jpeg";
    const event = new Event("input", { bubbles: true });
    input.dispatchEvent(event);
  };

  return (
    <div className="space-y-1 text-sm">
      <label htmlFor="image" className="font-medium">
        Image URL
      </label>
      <input
        id="image"
        name="image"
        type="url"
        required
        placeholder="https://example.com/image.jpg"
        ref={inputRef}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="button"
        onClick={handleUseWhiteBox}
        className="mt-1 inline-flex items-center rounded-md border border-input border-dashed px-2 py-1 font-medium text-muted-foreground text-xs hover:bg-muted/40"
      >
        Use white box
      </button>
      <p className="text-[11px] text-muted-foreground">
        Use this for a generic white box placeholder image. You can change it later.
      </p>
    </div>
  );
}
