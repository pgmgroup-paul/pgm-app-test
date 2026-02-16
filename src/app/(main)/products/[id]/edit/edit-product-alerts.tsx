"use client";

import { useSearchParams } from "next/navigation";

export function EditProductAlerts() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const success = searchParams.get("success");

  if (error === "basic_missing") {
    return <p className="text-sm text-destructive">All basic fields are required.</p>;
  }

  if (error === "basic_fail") {
    return (
      <p className="text-sm text-destructive">Could not update basic info. Please try again.</p>
    );
  }

  if (error === "marketing_fail") {
    return (
      <p className="text-sm text-destructive">
        Could not update marketing materials. Please try again.
      </p>
    );
  }

  if (error === "permissions_fail") {
    return (
      <p className="text-sm text-destructive">
        Could not update permissions. Please try again.
      </p>
    );
  }

  if (success === "basic") {
    return <p className="text-sm text-emerald-600">Basic information saved.</p>;
  }

  if (success === "marketing") {
    return <p className="text-sm text-emerald-600">Marketing materials saved.</p>;
  }

  if (success === "dimensions") {
    return <p className="text-sm text-emerald-600">Dimensions saved.</p>;
  }

  if (success === "permissions") {
    return <p className="text-sm text-emerald-600">Permissions saved.</p>;
  }

  return null;
}
