"use client";

import { useSearchParams } from "next/navigation";

export function EditProductAlerts() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const success = searchParams.get("success");

  if (error === "basic_missing") {
    return <p className="text-destructive text-sm">All basic fields are required.</p>;
  }

  if (error === "basic_fail") {
    return <p className="text-destructive text-sm">Could not update basic info. Please try again.</p>;
  }

  if (error === "marketing_fail") {
    return <p className="text-destructive text-sm">Could not update marketing materials. Please try again.</p>;
  }

  if (error === "permissions_fail") {
    return <p className="text-destructive text-sm">Could not update permissions. Please try again.</p>;
  }

  if (success === "basic") {
    return <p className="text-emerald-600 text-sm">Basic information saved.</p>;
  }

  if (success === "marketing") {
    return <p className="text-emerald-600 text-sm">Marketing materials saved.</p>;
  }

  if (success === "dimensions") {
    return <p className="text-emerald-600 text-sm">Dimensions saved.</p>;
  }

  if (success === "permissions") {
    return <p className="text-emerald-600 text-sm">Permissions saved.</p>;
  }

  return null;
}
