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

  const length = num("length");
  const width = num("width");
  const height = num("height");
  const weight = num("weight");
  const unitsPer = num("units_per");

  const { data: existing, error: existingError } = await serverSupabase
    .from("product_dimensions")
    .select("id, length, width, height, weight, units_per, uom_length, uom_weight")
    .eq("product_id", productId)
    .eq("kind", "case")
    .maybeSingle();

  if (existingError) {
    console.error("Error loading existing case dims for save", existingError);
    throw new Error("Error loading existing case details");
  }

  if (!existing) {
    // Insert new case row
    const { error } = await serverSupabase.from("product_dimensions").insert({
      product_id: productId,
      kind: "case",
      length,
      width,
      height,
      weight,
      units_per: unitsPer,
      uom_length: "in",
      uom_weight: "lb",
    });

    if (error) {
      console.error("Error inserting case dims", error);
      throw new Error("Failed to save case details");
    }

    redirect(`/supplier/case-details/${productId}?saved=1`);
  }

  // Update only missing fields
  const patch: any = {};

  if ((existing.length == null || Number(existing.length) === 0) && length != null) {
    patch.length = length;
  }
  if ((existing.width == null || Number(existing.width) === 0) && width != null) {
    patch.width = width;
  }
  if ((existing.height == null || Number(existing.height) === 0) && height != null) {
    patch.height = height;
  }
  if ((existing.weight == null || Number(existing.weight) === 0) && weight != null) {
    patch.weight = weight;
  }
  if ((existing.units_per == null || Number(existing.units_per) === 0) && unitsPer != null) {
    patch.units_per = unitsPer;
  }

  if (Object.keys(patch).length === 0) {
    // Nothing to change; just go back
    redirect(`/supplier/case-details/${productId}?saved=1`);
  }

  const { error: updError } = await serverSupabase
    .from("product_dimensions")
    .update(patch)
    .eq("id", existing.id as string);

  if (updError) {
    console.error("Error updating case dims", updError);
    throw new Error("Failed to update case details");
  }

  redirect(`/supplier/case-details/${productId}?saved=1`);
}
