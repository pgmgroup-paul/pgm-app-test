import { NextResponse } from "next/server";

import { serverSupabase } from "@/lib/serverSupabase";

export async function POST(req: Request) {
  try {
    const supabase = serverSupabase;
    const body = await req.json();
    const { shipment_id } = body as { shipment_id?: string };

    if (!shipment_id) {
      return NextResponse.json({ error: "Missing shipment_id" }, { status: 400 });
    }

    // 1. Check if shipment has containers
    const { data: links, error: linksError } = await supabase
      .from("shipment_containers_v2")
      .select("id")
      .eq("shipment_id", shipment_id);

    if (linksError) {
      console.error("Error checking shipment containers", linksError);
      return NextResponse.json({ error: linksError.message }, { status: 500 });
    }

    if ((links || []).length > 0) {
      return NextResponse.json(
        { error: "Shipment still has containers" },
        { status: 400 },
      );
    }

    // 2. Check status
    const { data: shipment, error: shipmentError } = await supabase
      .from("shipments_v2")
      .select("status")
      .eq("id", shipment_id)
      .single();

    if (shipmentError) {
      console.error("Error loading shipment for delete", shipmentError);
      return NextResponse.json({ error: shipmentError.message }, { status: 500 });
    }

    if (!shipment || shipment.status !== "Draft") {
      return NextResponse.json(
        { error: "Only Draft shipments can be deleted" },
        { status: 400 },
      );
    }

    // 3. Delete shipment
    const { error } = await supabase
      .from("shipments_v2")
      .delete()
      .eq("id", shipment_id);

    if (error) {
      console.error("Error deleting shipment", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Error in shipments-v2 delete endpoint", err);
    return NextResponse.json({ error: "Failed to delete shipment" }, { status: 500 });
  }
}
