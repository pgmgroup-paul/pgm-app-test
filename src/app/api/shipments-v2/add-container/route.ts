import { NextResponse } from "next/server";

import { serverSupabase } from "@/lib/serverSupabase";

export async function POST(req: Request) {
  try {
    const supabase = serverSupabase;
    const body = await req.json();
    const { shipment_id, container_id } = body as {
      shipment_id?: string;
      container_id?: string;
    };

    if (!shipment_id || !container_id) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // 1. Insert link
    const { error: linkError } = await supabase
      .from("shipment_containers_v2")
      .insert({ shipment_id, container_id });

    if (linkError) {
      console.error("Error inserting shipment_containers_v2 link", linkError);
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    // 2. Update container
    const { error: updateError } = await supabase
      .from("containers_v2")
      .update({ shipment_id })
      .eq("id", container_id);

    if (updateError) {
      console.error("Error updating containers_v2.shipment_id", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in shipments-v2 add-container endpoint", err);
    return NextResponse.json({ error: "Failed to add container to shipment" }, { status: 500 });
  }
}
