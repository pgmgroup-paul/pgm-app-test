"use server";

import { serverSupabase } from "@/lib/serverSupabase";

export interface RecentMovementRow {
  id: string;
  created_at: string;
  sku: string | null;
  product_name: string | null;
  movement_type: string;
  note: string | null;
  reason: string | null;
  order_number: string | null;
  source_ref: string | null;
  quantity_cases: number;
  location_code: string | null;
}

export interface RecentMovementsState {
  ok: boolean | null;
  error?: string;
  rows?: RecentMovementRow[];
  filters?: {
    datePreset: string;
    movementType: string;
    search: string;
  };
}

export async function loadRecentMovements(
  _prev: RecentMovementsState,
  formData: FormData,
): Promise<RecentMovementsState> {
  const supabase = serverSupabase;

  const datePreset = String(formData.get("datePreset") || "last7");
  const movementType = String(formData.get("movementType") || "all");
  const search = String(formData.get("search") || "").trim();

  console.log({ datePreset, movementType, search });

  return loadRecentMovementsCore({ supabase, datePreset, movementType, search });
}

async function loadRecentMovementsCore({
  supabase,
  datePreset,
  movementType,
  search,
}: {
  supabase: typeof serverSupabase;
  datePreset: string;
  movementType: string;
  search: string;
}): Promise<RecentMovementsState> {
  let query = supabase
    .from("inventory_movements")
    .select(
      `id,
       created_at,
       movement_type,
       quantity_cases,
       note,
       reason,
       order_number,
       source_ref,
       products:product_id ( sku, product_name ),
       from_location:from_location_id ( code ),
       to_location:to_location_id ( code )`,
    );

  // Apply date filter
  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (datePreset === "today") {
    // Use Pacific day boundaries for "today" [todayStart, tomorrowStart)
    const { year, month, day } = getPacificDateParts(now);
    const todayStart = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00-07:00`);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    startDate = todayStart;
    endDate = tomorrowStart;
  } else if (datePreset === "yesterday") {
    // Use Pacific day boundaries for "yesterday" [yesterdayStart, todayStart)
    const { year, month, day } = getPacificDateParts(now);
    const todayStart = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00-07:00`);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    startDate = yesterdayStart;
    endDate = todayStart;
  } else if (datePreset === "last7") {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (datePreset === "last30") {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (startDate) {
    query = query.gte("created_at", startDate.toISOString());
  }
  if (endDate) {
    query = query.lt("created_at", endDate.toISOString());
  }

  // Apply movement type filter
  if (movementType && movementType !== "all") {
    query = query.eq("movement_type", movementType);
  }

  // Apply search filter (order_number, source_ref, or note)
  if (search) {
    query = query.or(`order_number.ilike.%${search}%,source_ref.ilike.%${search}%,note.ilike.%${search}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);

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
      reason: (m.reason as string) || null,
      order_number: (m.order_number as string) || null,
      source_ref: (m.source_ref as string) || null,
      quantity_cases: Number(m.quantity_cases) || 0,
      location_code: (locationCode as string) || null,
    } satisfies RecentMovementRow;
  });

  return {
    ok: true,
    rows,
    filters: {
      datePreset,
      movementType,
      search,
    },
  };
}

function getPacificDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

export async function getInitialRecentMovements(): Promise<RecentMovementsState> {
  return loadRecentMovementsCore({
    supabase: serverSupabase,
    datePreset: "today",
    movementType: "all",
    search: "",
  });
}
