"use server";

import { serverSupabase } from "@/lib/serverSupabase";

export interface ReceivingContainersState {
  ok: boolean | null;
  error?: string;
  containers?: {
    id: string;
    code: string;
    eta: string | null;
    vendor_name: string | null;
  }[];
}

export interface ContainerContentsRow {
  product_id: string;
  sku: string;
  sku_var: string | null;
  product_name: string | null;
  expected_units: number; // from shipment_items for this container
  received_units: number | null; // pieces, derived from cases * units_per
  received_cases: number; // from inventory_movements
  loose_pieces_received: number | null; // from dropship_transfers
  discrepancy: number | null; // expected_units - (received_units + loose_pieces_received)
  // Additional derived fields for downstream UIs (e.g. /warehouse/add)
  units_per_case: number | null; // from product_dimensions.units_per
  expected_cases: number | null; // expected_units / units_per_case
  cartons_per_layer?: number | null; // pallet config
  number_of_layers?: number | null; // pallet config
  cartons_per_pallet?: number | null; // pallet config
  remaining_cases?: number | null; // expected_cases - received_cases
}

export interface ContainerContentsState {
  ok: boolean | null;
  error?: string;
  containerId?: string;
  containerCode?: string;
  rows?: ContainerContentsRow[];
}

export async function loadReceivingContainers(): Promise<ReceivingContainersState> {
  const supabase = serverSupabase;

  const { data: containers, error } = await supabase
    .from("containers_v2")
    .select("id, container_number, shipment_id")
    .eq("status", "Delivered")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error loading receiving containers", error);
    return { ok: false, error: error.message || "Error loading containers" };
  }

  const shipmentIds = (containers ?? [])
    .map((c: any) => c.shipment_id as string | null)
    .filter((id): id is string => !!id);

  let shipmentMap = new Map<string, any>();

  if (shipmentIds.length > 0) {
    const { data: shipments, error: shipError } = await supabase
      .from("shipments_v2")
      .select("id, eta")
      .in("id", shipmentIds);

    if (shipError) {
      console.error("Error loading shipments_v2 for receiving containers", shipError);
    }

    shipmentMap = new Map<string, any>(
      (shipments ?? []).map((s: any) => [s.id as string, s]),
    );
  }

  const rows = (containers ?? []).map((c: any) => ({
    id: c.id as string,
    code: (c.container_number as string) ?? "(no number)",
    eta: (shipmentMap.get(c.shipment_id as string)?.eta as string | null) ?? null,
    vendor_name: null,
  }));

  return {
    ok: true,
    containers: rows,
  };
}

export async function loadContainerContents(
  _prev: ContainerContentsState,
  formData: FormData,
): Promise<ContainerContentsState> {
  const containerId = (formData.get("container_id") || "").toString().trim();

  if (!containerId) {
    return { ok: false, error: "Please select a container" };
  }

  const supabase = serverSupabase;

  // Resolve container_number from containers_v2 using the inbound container id
  const { data: containerV2, error: contV2Error } = await supabase
    .from("containers_v2")
    .select("container_number")
    .eq("id", containerId)
    .single();

  if (contV2Error || !containerV2) {
    console.error("Error resolving containers_v2 row for contents", contV2Error);
    return { ok: false, error: "Container not found" };
  }

  const code = containerV2.container_number as string;

  // Sum received quantity per product from inventory_movements for this container.
  // For now we only count add movements; corrections will be handled later when
  // the correction flow is fully defined.
  const { data: moves, error: movError } = await supabase
    .from("inventory_movements")
    .select("product_id, quantity_cases")
    .eq("movement_type", "add")
    .eq("source_type", "container")
    .eq("source_ref", code);

  if (movError) {
    console.error("Error loading movements for container", movError);
    return { ok: false, error: "Error loading container contents" };
  }

  // Expected quantity per product from container_items_v2 + purchase_order_lines
  const { data: items, error: itemsError } = await supabase
    .from("container_items_v2")
    .select("purchase_order_line_id, quantity, units_per")
    .eq("container_id", containerId);

  if (itemsError) {
    console.error("Error loading container_items_v2 for container", itemsError);
    return { ok: false, error: "Error loading expected quantities" };
  }

  const purchaseOrderLineIds = Array.from(
    new Set(
      (items || [])
        .map((it: any) => (it.purchase_order_line_id as string) || "")
        .filter(Boolean),
    ),
  );

  const expectedMap = new Map<string, number>();
  const productMap = new Map<string, any>();

  if (purchaseOrderLineIds.length > 0) {
    const { data: polines, error: poError } = await supabase
      .from("purchase_order_lines")
      .select("id, product_id, sku, sku_var, description")
      .in("id", purchaseOrderLineIds);

    if (poError) {
      console.error("Error loading purchase_order_lines for container contents", poError);
      return { ok: false, error: "Error loading expected quantities" };
    }

    const poById = new Map<string, any>();
    for (const line of polines || []) {
      poById.set((line as any).id as string, line);
    }

    for (const row of items || []) {
      const r = row as any;
      const poLineId = (r.purchase_order_line_id as string) || "";
      const poLine = poById.get(poLineId) as any | undefined;
      if (!poLine) continue;

      const pid = (poLine.product_id as string) || "";
      const qty = Number(r.quantity) || 0;
      const unitsPer = Number(r.units_per) || 0;
      if (!pid || qty <= 0 || unitsPer <= 0) continue;

      const expectedUnits = qty * unitsPer;
      expectedMap.set(pid, (expectedMap.get(pid) || 0) + expectedUnits);

      if (!productMap.has(pid)) {
        productMap.set(pid, {
          id: pid,
          sku: (poLine.sku as string) || "",
          sku_var: (poLine.sku_var as string) || null,
          product_name: (poLine.description as string) || "",
        });
      }
    }
  }

  // Aggregate received cases by product_id
  const receivedCasesMap = new Map<string, number>();
  for (const m of (moves as any[]) || []) {
    const pid = m.product_id as string;
    const qty = Number(m.quantity_cases) || 0;
    if (!pid || qty <= 0) continue;
    receivedCasesMap.set(pid, (receivedCasesMap.get(pid) || 0) + qty);
  }

  // Union of product ids that are expected or received
  const productIds = Array.from(new Set([...Array.from(expectedMap.keys()), ...Array.from(receivedCasesMap.keys())]));

  if (productIds.length === 0) {
    return {
      ok: true,
      containerId,
      containerCode: code,
      rows: [],
    };
  }

  // productMap is built from container_items_v2 join on products above; no extra products query needed here.

  // Load loose pieces moved to dropship from this container
  const { data: dropshipRows, error: dropshipError } = await supabase
    .from("dropship_transfers")
    .select("product_id, quantity")
    .eq("source_type", "container")
    .eq("source_container_id", containerId)
    .in("product_id", productIds);

  if (dropshipError) {
    console.error("Error loading dropship_transfers for container contents", dropshipError);
  }

  const loosePiecesMap = new Map<string, number>();
  for (const row of dropshipRows || []) {
    const pid = (row as any).product_id as string;
    const qty = Number((row as any).quantity) || 0;
    if (!pid || qty <= 0) continue;
    loosePiecesMap.set(pid, (loosePiecesMap.get(pid) || 0) + qty);
  }

  // Load units_per and pallet config for conversions and palletization
  const { data: dims, error: dimsError } = await supabase
    .from("product_dimensions")
    .select("product_id, kind, units_per, cartons_per_layer, number_of_layers, cartons_per_pallet")
    .in("product_id", productIds);

  if (dimsError) {
    console.error("Error loading product dimensions for container contents", dimsError);
  }

  const unitsPerMap = new Map<string, number>();
  const palletDimsMap = new Map<
    string,
    { cartons_per_layer: number | null; number_of_layers: number | null; cartons_per_pallet: number | null }
  >();

  for (const d of dims || []) {
    const row = d as any;
    const pid = row.product_id as string;
    const kind = row.kind as string;

    const units = Number(row.units_per) || 0;
    if (units > 0 && !unitsPerMap.has(pid)) unitsPerMap.set(pid, units);

    if (kind === "pallet" && !palletDimsMap.has(pid)) {
      const cpl = row.cartons_per_layer != null ? Number(row.cartons_per_layer) : null;
      const nol = row.number_of_layers != null ? Number(row.number_of_layers) : null;
      const cppStored = row.cartons_per_pallet != null ? Number(row.cartons_per_pallet) : null;
      const cpp = cppStored ?? (cpl != null && nol != null ? cpl * nol : null);
      palletDimsMap.set(pid, {
        cartons_per_layer: cpl,
        number_of_layers: nol,
        cartons_per_pallet: cpp,
      });
    }
  }

  const rows: ContainerContentsRow[] = productIds.map((pid) => {
    const p = productMap.get(pid) as any | undefined;
    const expectedUnits = expectedMap.get(pid) || 0;
    const receivedCases = receivedCasesMap.get(pid) || 0;
    const unitsPer = unitsPerMap.get(pid) || 0;
    const expectedCases = unitsPer > 0 ? expectedUnits / unitsPer : null;
    const receivedUnits = unitsPer > 0 ? receivedCases * unitsPer : null;
    const loosePieces = loosePiecesMap.get(pid) || 0;

    let discrepancy: number | null = null;
    if (receivedUnits != null || loosePieces > 0) {
      const receivedTotal = (receivedUnits ?? 0) + loosePieces;
      // Positive discrepancy means over-received; negative means under-received.
      discrepancy = receivedTotal - expectedUnits;
    }

    const pallet = palletDimsMap.get(pid) || null;
    const remainingCases = expectedCases != null ? expectedCases - receivedCases : null;

    return {
      product_id: pid,
      sku: (p?.sku as string) || "",
      sku_var: (p?.sku_var as string) || null,
      product_name: (p?.product_name as string) || null,
      expected_units: expectedUnits,
      received_units: receivedUnits,
      received_cases: receivedCases,
      loose_pieces_received: loosePieces > 0 ? loosePieces : null,
      discrepancy,
      units_per_case: unitsPer > 0 ? unitsPer : null,
      expected_cases: expectedCases,
      cartons_per_layer: pallet?.cartons_per_layer ?? null,
      number_of_layers: pallet?.number_of_layers ?? null,
      cartons_per_pallet: pallet?.cartons_per_pallet ?? null,
      remaining_cases: remainingCases,
    };
  });

  return {
    ok: true,
    containerId,
    containerCode: code,
    rows,
  };
}
