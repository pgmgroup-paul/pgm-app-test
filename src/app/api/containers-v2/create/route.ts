import { NextResponse } from "next/server";

import { serverSupabase } from "@/lib/serverSupabase";

function generateContainerCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `PLCN${code}`;
}

export async function POST(req: Request) {
  try {
    const supabase = serverSupabase;
    const body = await req.json();

    const {
      items,
      total_weight,
      total_volume,
    }: {
      items: {
        purchase_order_line_id: string;
        sku_id: string;
        cartons: number;
        units_per: number | null;
        carton_weight_kg: number | null;
        carton_volume_m3: number | null;
      }[];
      total_weight: number;
      total_volume: number;
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items to save" }, { status: 400 });
    }

    const containerCode = generateContainerCode();

    // 1. Insert container
    const { data: container, error: containerError } = await supabase
      .from("containers_v2")
      .insert({
        temp_code: containerCode,
        status: "Draft",
        planned_weight: total_weight,
        planned_volume: total_volume,
      })
      .select()
      .single();

    if (containerError || !container) {
      console.error("Error inserting container", containerError);
      return NextResponse.json(
        { error: containerError?.message || "Failed to create container" },
        { status: 500 },
      );
    }

    // 2. Insert items
    const itemsToInsert = items
      .filter((item) => item && item.cartons && item.cartons > 0)
      .map((item) => ({
        container_id: container.id,
        purchase_order_line_id: item.purchase_order_line_id,
        sku_id: item.sku_id,
        quantity: item.cartons,
        units_per: item.units_per,
        carton_weight_kg: item.carton_weight_kg,
        carton_volume_m3: item.carton_volume_m3,
      }));

    if (itemsToInsert.length === 0) {
      return NextResponse.json({ error: "No valid items to save" }, { status: 400 });
    }

    const { error: itemsError } = await supabase
      .from("container_items_v2")
      .insert(itemsToInsert);

    if (itemsError) {
      console.error("Error inserting container items", itemsError);
      return NextResponse.json(
        { error: itemsError.message || "Failed to create container items" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      container_id: container.id,
      container_code: containerCode,
    });
  } catch (err: any) {
    console.error("Error in containers-v2 create endpoint", err);
    return NextResponse.json({ error: "Failed to create container" }, { status: 500 });
  }
}
