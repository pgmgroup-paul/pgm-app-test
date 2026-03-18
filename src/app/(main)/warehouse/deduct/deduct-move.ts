"use server";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

export interface DeductMoveState {
  ok: boolean | null;
  error?: string;
  message?: string;
  movementId?: string;
}

export async function handleDeductMove(_prev: DeductMoveState, formData: FormData): Promise<DeductMoveState> {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return { ok: false, error: "Not authenticated" };
  }

  const productId = (formData.get("product_id") || "").toString().trim();
  const locationId = (formData.get("deduct_location_id") || "").toString().trim();
  const qtyRaw = (formData.get("deduct_quantity") || "").toString().trim();
  const unit = (formData.get("deduct_unit") || "cases").toString().trim().toLowerCase();
  const reason = (formData.get("deduct_reason") || "").toString().trim();
  const note = (formData.get("deduct_note") || "").toString().trim();
  const shipmentId = (formData.get("deduct_shipment_id") || "").toString().trim();

  if (!productId || !locationId) {
    return { ok: false, error: "Please select a location for this product" };
  }

  if (!qtyRaw) {
    return { ok: false, error: "Quantity is required" };
  }

  const quantity = Number(qtyRaw);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, error: "Quantity must be a positive number" };
  }

  // Validation: do not allow picking more than remaining cases for this order/shipment
  if (reason === "order" && shipmentId) {
    const supabase = serverSupabase;

    const { data: shipment, error: shipError } = await supabase
      .from("so_shipments")
      .select("id, sales_order_id, sales_orders!inner(order_number)")
      .eq("id", shipmentId)
      .maybeSingle();

    if (!shipError && shipment) {
      const so = (shipment as any).sales_orders as any;
      const orderNumber = (so?.order_number as string) || "";

      // Load total ordered (units) for this shipment+product
      const { data: soLines, error: soLinesError } = await supabase
        .from("so_shipment_lines")
        .select("quantity_shipped_units")
        .eq("so_shipment_id", shipmentId)
        .eq("product_id", productId);

      let totalOrderedUnits = 0;
      if (!soLinesError) {
        for (const row of soLines || []) {
          totalOrderedUnits += Number((row as any).quantity_shipped_units) || 0;
        }
      }

      // Load units_per_case
      let unitsPerCase = 0;
      const { data: dim, error: dimError } = await supabase
        .from("product_dimensions")
        .select("units_per, kind")
        .eq("product_id", productId)
        .eq("kind", "package")
        .maybeSingle();

      if (!dimError && dim && typeof (dim as any).units_per !== "undefined") {
        const u = Number((dim as any).units_per) || 0;
        if (u > 0) unitsPerCase = u;
      }

      const totalOrderedCases = unitsPerCase > 0 ? totalOrderedUnits / unitsPerCase : totalOrderedUnits;

      // Load already picked (cases) for this order+product with reason=order
      let alreadyPickedCases = 0;
      if (orderNumber) {
        const { data: moves, error: movesError } = await supabase
          .from("inventory_movements")
          .select("quantity_cases")
          .eq("product_id", productId)
          .eq("order_number", orderNumber)
          .eq("movement_type", "deduct")
          .eq("reason", "order");

        if (!movesError) {
          for (const m of moves || []) {
            alreadyPickedCases += Number((m as any).quantity_cases) || 0;
          }
        }
      }

      const remainingCases = Math.max(totalOrderedCases - alreadyPickedCases, 0);

      if (unit === "cases" && quantity > remainingCases) {
        return { ok: false, error: "Cannot pick more than remaining cases for this order" };
      }
    }
  }

  if (unit !== "cases" && unit !== "pallets") {
    return { ok: false, error: "Unit must be Cases or Pallets" };
  }

  if (!reason) {
    return { ok: false, error: "Please choose a reason for this deduction" };
  }

  if (reason === "special_instruction" && !note) {
    return { ok: false, error: "Note is required for special instruction" };
  }

  if (reason === "order" && !shipmentId) {
    return { ok: false, error: "Please select a shipment to associate this deduction with" };
  }

  const supabase = serverSupabase;

  let orderNumberForRpc = "";
  let noteAugmented = note;

  // If this deduction is linked to a shipment, resolve its SO number and add to note
  if (reason === "order" && shipmentId) {
    const { data: shipment, error: shipError } = await supabase
      .from("so_shipments")
      .select("id, shipment_sequence, sales_order_id, sales_orders!inner(order_number)")
      .eq("id", shipmentId)
      .maybeSingle();

    if (shipError || !shipment) {
      console.error("Error loading shipment for deduct", shipError);
      return { ok: false, error: "Could not resolve shipment for this deduction" };
    }

    const soHeader = shipment.sales_orders as any;
    orderNumberForRpc = (soHeader?.order_number as string) || "";

    const label = orderNumberForRpc
      ? `${orderNumberForRpc}-${shipment.shipment_sequence}`
      : `Shipment ${shipment.shipment_sequence}`;

    noteAugmented = note
      ? `${note} | Shipment: ${label} (shipment_id=${shipment.id})`
      : `Shipment: ${label} (shipment_id=${shipment.id})`;
  }

  // Resolve warehouse name and location code from locationId
  const { data: locRow, error: locError } = await supabase
    .from("locations")
    .select("code, warehouses ( name )")
    .eq("id", locationId)
    .maybeSingle();

  if (locError || !locRow) {
    console.error("Error resolving location for deduct", locError);
    return { ok: false, error: "Could not resolve location for deduction" };
  }

  const warehouseName =
    (Array.isArray(locRow.warehouses)
      ? (locRow.warehouses[0]?.name as string) || ""
      : ((locRow as any).warehouses?.name as string) || "") || "";
  const locationCode = (locRow.code as string) || "";

  if (!warehouseName || !locationCode) {
    return { ok: false, error: "Incomplete warehouse/location information" };
  }

  const rpcName = reason === "transfer_dropship" ? "deduct_inventory_with_dropship" : "deduct_inventory";

  const { data, error } = await supabase.rpc(rpcName, {
    p_warehouse_name: warehouseName,
    p_location_code: locationCode,
    p_product_id: productId,
    p_quantity: quantity,
    p_unit: unit,
    p_reason: reason,
    p_note: noteAugmented,
    p_order_number: orderNumberForRpc || null,
  });

  if (error) {
    console.error("Error deducting inventory", error);
    return { ok: false, error: error.message || "Deduct movement failed" };
  }

  const normalizedLoc = locationCode.replace(/\s+/g, "").toUpperCase();

  return {
    ok: true,
    message: `Deducted ${qtyRaw} ${unit} from ${warehouseName} / ${normalizedLoc}.`,
    movementId: data as string | undefined,
  };
}
