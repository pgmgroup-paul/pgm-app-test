"use server";

import { serverSupabase } from "@/lib/serverSupabase";

export interface AddWarehousesState {
  ok: boolean | null;
  error?: string;
  warehouses?: {
    id: string;
    name: string;
  }[];
}

export async function loadWarehousesForAdd(): Promise<AddWarehousesState> {
  const { data, error } = await serverSupabase.from("warehouses").select("id, name").order("name", { ascending: true });

  if (error) {
    console.error("Error loading warehouses for /warehouse/add", error);
    return { ok: false, error: "Error loading warehouses" };
  }

  return {
    ok: true,
    warehouses: (data || []).map((w: any) => ({
      id: w.id as string,
      name: (w.name as string) || "",
    })),
  };
}
