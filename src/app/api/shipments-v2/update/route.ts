import { NextResponse } from "next/server";

import { serverSupabase } from "@/lib/serverSupabase";

export async function POST(req: Request) {
  try {
    const supabase = serverSupabase;
    const body = await req.json();
    console.log("UPDATE BODY:", body);
    const { shipment_id, updates } = body as {
      shipment_id?: string;
      updates?: Record<string, any>;
    };

    if (!shipment_id || !updates || Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("shipments_v2")
      .update(updates)
      .eq("id", shipment_id)
      .select();

    console.log("UPDATED ROW:", data);
    console.log("UPDATE ERROR:", error);

    if (error) {
      console.error("Error updating shipment", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in shipments-v2 update endpoint", err);
    return NextResponse.json({ error: "Failed to update shipment" }, { status: 500 });
  }
}
