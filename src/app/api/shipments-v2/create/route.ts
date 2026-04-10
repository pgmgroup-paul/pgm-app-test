import { NextResponse } from "next/server";

import { serverSupabase } from "@/lib/serverSupabase";

function generateShipmentNumber() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `PLSH${code}`;
}

export async function POST(req: Request) {
  try {
    const supabase = serverSupabase;
    const body = await req.json();
    const { container_ids } = body as { container_ids?: string[] };

    if (!container_ids || container_ids.length === 0) {
      return NextResponse.json({ error: "No containers selected" }, { status: 400 });
    }

    const shipmentNumber = generateShipmentNumber();

    // 1. Create shipment
    const { data: shipment, error: shipmentError } = await supabase
      .from("shipments_v2")
      .insert({
        shipment_number: shipmentNumber,
        status: "Draft",
      })
      .select()
      .single();

    if (shipmentError || !shipment) {
      console.error("Error creating shipment", shipmentError);
      return NextResponse.json(
        { error: shipmentError?.message || "Failed to create shipment" },
        { status: 500 },
      );
    }

    // 2. Link containers
    const links = container_ids.map((cid) => ({
      shipment_id: shipment.id,
      container_id: cid,
    }));

    const { error: linkError } = await supabase
      .from("shipment_containers_v2")
      .insert(links);

    if (linkError) {
      console.error("Error linking containers to shipment", linkError);
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    // 3. Update containers
    const { error: updateError } = await supabase
      .from("containers_v2")
      .update({ shipment_id: shipment.id })
      .in("id", container_ids);

    if (updateError) {
      console.error("Error updating containers with shipment_id", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      shipment_id: shipment.id,
      shipment_number: shipmentNumber,
    });
  } catch (err: any) {
    console.error("Error in shipments-v2 create endpoint", err);
    return NextResponse.json({ error: "Failed to create shipment" }, { status: 500 });
  }
}
