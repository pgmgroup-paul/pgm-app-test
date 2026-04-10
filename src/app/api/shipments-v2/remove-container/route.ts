import { NextResponse } from "next/server";

import { serverSupabase } from "@/lib/serverSupabase";

export async function POST(req: Request) {
  try {
    const supabase = serverSupabase;
    const body = await req.json();
    const { container_id } = body as { container_id?: string };

    if (!container_id) {
      return NextResponse.json({ error: "Missing container_id" }, { status: 400 });
    }

    // 1. Remove link from shipment_containers_v2
    const { error: deleteError } = await supabase
      .from("shipment_containers_v2")
      .delete()
      .eq("container_id", container_id);

    if (deleteError) {
      console.error("Error deleting shipment_containers_v2 link", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // 2. Reset container shipment_id
    const { error: updateError } = await supabase
      .from("containers_v2")
      .update({ shipment_id: null })
      .eq("id", container_id);

    if (updateError) {
      console.error("Error resetting containers_v2.shipment_id", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in shipments-v2 remove-container endpoint", err);
    return NextResponse.json({ error: "Failed to remove container from shipment" }, { status: 500 });
  }
}
