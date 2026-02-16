"use client";

import { useSearchParams } from "next/navigation";

export function NewProductErrors() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  if (!error) return null;

  if (error === "sku") {
    return (
      <p className="mt-2 text-sm text-destructive">A product with this SKU already exists.</p>
    );
  }

  if (error === "upc") {
    return (
      <p className="mt-2 text-sm text-destructive">A product with this UPC already exists.</p>
    );
  }

  if (error === "missing") {
    return <p className="mt-2 text-sm text-destructive">All fields are required.</p>;
  }

  return (
    <p className="mt-2 text-sm text-destructive">Could not create product. Please try again.</p>
  );
}
