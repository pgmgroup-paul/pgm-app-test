import { NextResponse } from "next/server";

import { serverSupabase } from "@/lib/serverSupabase";

export async function GET(req: Request) {
  try {
    const supabase = serverSupabase;
    const { searchParams } = new URL(req.url);

    const statusFilter = searchParams.get("status") || "all";
    const search = (searchParams.get("q") || "").trim();

    let query = supabase
      .from("inbound_containers_list")
      .select("container_id, container_number, bol_number, status, shipment_status, eta, total_cartons, total_units, sku_count, items_detail")
      .order("eta", { ascending: true, nullsFirst: true });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    if (search) {
      // Basic ILIKE search over container_number and bol_number
      query = query.or(
        `container_number.ilike.%${search}%,bol_number.ilike.%${search}%`,
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error loading inbound_containers_list", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ containers: data || [] });
  } catch (err: any) {
    console.error("Error in inbound-containers list endpoint", err);
    return NextResponse.json({ error: "Failed to load inbound containers" }, { status: 500 });
  }
}
