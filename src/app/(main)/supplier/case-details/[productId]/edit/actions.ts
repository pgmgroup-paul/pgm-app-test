"use server";

import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export async function saveCaseDetails(formData: FormData) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "supplier")) {
    throw new Error("Not authorized");
  }

  const productId = (formData.get("product_id") || "").toString().trim();
  if (!productId) {
    throw new Error("Missing product");
  }

  const num = (name: string): number | null => {
    const raw = (formData.get(name) || "").toString().trim();
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return value;
  };

  const caseLength = num("length");
  const caseWidth = num("width");
  const caseHeight = num("height");
  const caseWeight = num("weight");
  const unitsPer = num("units_per");

  // Upsert helper per kind, mirroring the product edit page behavior
  const upsertKind = async (kind: string, fields: Record<string, any>) => {
    const hasValue = Object.values(fields).some((v) => v !== null && v !== undefined);
    if (!hasValue) return;

    const { error } = await serverSupabase.from("product_dimensions").upsert(
      {
        product_id: productId,
        kind,
        ...fields,
      },
      {
        onConflict: "product_id,kind",
      },
    );

    if (error) {
      console.error("Error updating supplier case details", kind, error);
      throw new Error("Failed to save case details");
    }
  };

  // Supplier-provided case dims should populate the same slots as the product editor:
  // - Carton dimensions + weight → kind = 'carton'
  // - Case pack (units_per)      → kind = 'package'

  await upsertKind("carton", {
    length: caseLength,
    width: caseWidth,
    height: caseHeight,
    weight: caseWeight,
    uom_length: "in",
    uom_weight: "lb",
  });

  await upsertKind("package", {
    units_per: unitsPer,
  });

  redirect(`/supplier/case-details/${productId}?saved=1`);
}
