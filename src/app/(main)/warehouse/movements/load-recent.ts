"use server";

import { serverSupabase } from "@/lib/serverSupabase";

export interface RecentMovementRow {
  id: string;
  created_at: string;
  sku: string | null;
  product_name: string | null;
  movement_type: string;
  note: string | null;
  quantity_cases: number;
  location_code: string | null;
}

export interface RecentMovementsState {
  ok: boolean | null;
  error?: string;
  rows?: RecentMovementRow[];
}

export async function loadRecentMovements(
  _prev: RecentMovementsState,
  _formData: FormData,
): Promise<RecentMovementsState> {
  const supabase = serverSupabase;

  const { data, error } = await supabase
    .from("inventory_movements")
    .select(
      `id,
       created_at,
       movement_type,
       quantity_cases,
       note,
       products:product_id ( sku, product_name ),
       from_location:from_location_id ( code ),
       to_location:to_location_id ( code )`,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Error loading recent movements", error);
    return { ok: false, error: "Error loading recent movements" };
  }

  const rows: RecentMovementRow[] = (data || []).map((m: any) => {
    const product = (m.products as any) || null;
    const fromLoc = (m.from_location as any) || null;
    const toLoc = (m.to_location as any) || null;

    const locationCode = fromLoc?.code || toLoc?.code || null;

    return {
      id: m.id as string,
      created_at: m.created_at as string,
      sku: (product?.sku as string) || null,
      product_name: (product?.product_name as string) || null,
      movement_type: m.movement_type as string,
      note: (m.note as string) || null,
      quantity_cases: Number(m.quantity_cases) || 0,
      location_code: (locationCode as string) || null,
    } satisfies RecentMovementRow;
  });

  return {
    ok: true,
    rows,
  };
}
