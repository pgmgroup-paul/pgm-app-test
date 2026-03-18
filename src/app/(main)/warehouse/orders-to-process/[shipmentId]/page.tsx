import React from "react";

import { redirect } from "next/navigation";

import { serverSupabase } from "@/lib/serverSupabase";
import { getCurrentUserProfile } from "@/server/auth/current-user";

import { markShipmentReady } from "../mark-order-ready";

export const dynamic = "force-dynamic";

interface PageParams {
  params: Promise<{
    shipmentId: string;
  }>;
}

async function loadShipmentWithOrder(shipmentId: string) {
  const { data, error } = await serverSupabase
    .from("so_shipments")
    .select(
      `id,
       sales_order_id,
       shipment_sequence,
       status,
       sales_orders!inner(order_number, customer_name, requested_ship_date)`,
    )
    .eq("id", shipmentId)
    .maybeSingle();

  if (error || !data) {
    console.error("Error loading shipment for /warehouse/orders-to-process/[shipmentId]", error);
    return null;
  }

  const so = (data as any).sales_orders as any | null;

  return {
    shipment: data,
    salesOrder: so,
  };
}

export default async function WarehouseOrderLocationsPage({ params }: PageParams) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "staff")) {
    redirect("/auth/v1/login");
  }

  const { shipmentId } = await params;

  if (!shipmentId) {
    redirect("/warehouse/orders-to-process");
  }

  const data = await loadShipmentWithOrder(shipmentId);

  if (!data) {
    return <div className="p-6 text-destructive text-sm">Shipment not found.</div>;
  }

  const { shipment, salesOrder } = data as any;

  const soNumber = (salesOrder?.order_number as string) || shipment.sales_order_id;
  const customerName = (salesOrder?.customer_name as string) || null;
  const requestedShipDate = (salesOrder?.requested_ship_date as string) || null;

  return (
    <div className="max-w-4xl space-y-4 p-6">
      <div className="space-y-1">
        <h1 className="font-semibold text-2xl tracking-tight">Order Locations</h1>
        <p className="text-muted-foreground text-sm">Warehouse picking locations for this sales order shipment.</p>
        <p className="text-sm">
          Order:{" "}
          <span className="font-mono text-[13px]">
            {soNumber}-{shipment.shipment_sequence}
          </span>{" "}
          <span className="ml-2 text-muted-foreground">
            Ship date: {requestedShipDate ? new Date(requestedShipDate).toLocaleDateString() : "-"}
          </span>
        </p>
      </div>

      <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
        <div className="font-medium text-[11px]">Shipment details</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Sales order</div>
            <div className="font-mono text-[11px]">{soNumber}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Customer</div>
            <div className="text-[11px]">{customerName ?? "-"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Requested ship date</div>
            <div className="text-[11px]">{requestedShipDate || "-"}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Shipment</div>
            <div className="text-[11px]">
              Shipment {shipment.shipment_sequence} •<span className="ml-1 capitalize">{shipment.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Products in this shipment (quantities + locations) */}
      <ShipmentProductsTable shipmentId={shipmentId} orderNumber={soNumber} />
    </div>
  );
}

async function loadShipmentProducts(shipmentId: string, orderNumber?: string) {
  const { data, error } = await serverSupabase
    .from("so_shipment_lines")
    .select(
      `id,
       product_id,
       quantity_shipped_units,
       products!inner(sku, sku_var, product_name)`,
    )
    .eq("so_shipment_id", shipmentId);

  if (error) {
    console.error("Error loading shipment products for /warehouse/orders-to-process/[shipmentId]", error);
    return [] as any[];
  }

  const rows = (data || []) as any[];

  // Load warehouse locations and case-pack info for each product in the shipment
  const productIds = Array.from(new Set(rows.map((r) => (r.product_id as string) || "").filter(Boolean)));

  const locationsByProduct = new Map<string, { location_code: string; quantity: number; available_cases: number }[]>();
  const unitsPerCaseByProduct = new Map<string, number>();
  const casesPickedByProduct = new Map<string, number>();

  if (productIds.length > 0) {
    const { data: locRows, error: locError } = await serverSupabase
      .from("inventory_location")
      .select(
        `product_id,
         quantity_cases,
         locations ( code )`,
      )
      .in("product_id", productIds)
      .gt("quantity_cases", 0);

    if (locError) {
      console.error("Error loading inventory locations for /warehouse/orders-to-process/[shipmentId]", locError);
    }

    for (const r of locRows || []) {
      const pid = (r as any).product_id as string;
      const code = ((r as any).locations?.code as string) || "";
      const qtyCases = Number((r as any).quantity_cases) || 0;
      if (!pid || !code || qtyCases <= 0) continue;
      const arr = locationsByProduct.get(pid) || [];
      arr.push({ location_code: code, quantity: qtyCases, available_cases: qtyCases });
      locationsByProduct.set(pid, arr);
    }

    // Load units_per (units per case) from product_dimensions (package/case rows)
    const { data: dims, error: dimsError } = await serverSupabase
      .from("product_dimensions")
      .select("product_id, kind, units_per")
      .in("product_id", productIds);

    if (dimsError) {
      console.error("Error loading product_dimensions for /warehouse/orders-to-process/[shipmentId]", dimsError);
    }

    for (const d of dims || []) {
      const pid = (d as any).product_id as string;
      const kind = (d as any).kind as string | undefined;
      const u = Number((d as any).units_per) || 0;
      if (!pid || u <= 0) continue;

      const isCaseLike = kind === "case" || kind === "package" || kind === "carton";
      const existing = unitsPerCaseByProduct.get(pid) || 0;

      if (existing <= 0 || (isCaseLike && existing !== u)) {
        unitsPerCaseByProduct.set(pid, u);
      }
    }

    // Load cases already picked for this shipment/product via inventory_movements
    if (orderNumber) {
      const { data: moves, error: movesError } = await serverSupabase
        .from("inventory_movements")
        .select("product_id, quantity_cases, movement_type, reason, order_number")
        .in("product_id", productIds)
        .eq("order_number", orderNumber)
        .eq("movement_type", "deduct")
        .eq("reason", "order");

      if (movesError) {
        console.error("Error loading inventory_movements for /warehouse/orders-to-process/[shipmentId]", movesError);
      }

      for (const m of moves || []) {
        const pid = (m as any).product_id as string;
        const qtyCases = Number((m as any).quantity_cases) || 0;
        if (!pid || qtyCases <= 0) continue;
        casesPickedByProduct.set(pid, (casesPickedByProduct.get(pid) || 0) + qtyCases);
      }
    }
  }

  // Attach locations + case-pack info to each shipment product row
  for (const row of rows) {
    const pid = row.product_id as string;
    row.locations = locationsByProduct.get(pid) || [];
    row.units_per_case = unitsPerCaseByProduct.get(pid) || 0;
    row.cases_picked = casesPickedByProduct.get(pid) || 0;
  }

  return rows;
}

async function ShipmentProductsTable({ shipmentId, orderNumber }: { shipmentId: string; orderNumber?: string }) {
  const rows = await loadShipmentProducts(shipmentId, orderNumber);

  const totalItems = rows.length;
  const pickedItems = rows.reduce((acc, row: any) => {
    const qtyUnits = Number(row.quantity_shipped_units) || 0;
    const unitsPerCase = Number((row as any).units_per_case) || 0;
    const casesRequired = unitsPerCase > 0 ? Math.ceil(qtyUnits / unitsPerCase) : 0;
    const casesPicked = Number((row as any).cases_picked) || 0;
    const casesRemaining = Math.max(casesRequired - casesPicked, 0);
    return acc + (casesRemaining <= 0 ? 1 : 0);
  }, 0);

  return (
    <div className="space-y-2 rounded-md border px-3 py-3 text-xs">
      <div className="font-medium text-[11px]">Products in this shipment</div>

      {/* Picking progress */}
      {totalItems > 0 && (
        <div className="mb-1 text-[11px]">
          <span className="font-medium">Progress</span>{" "}
          <span>
            {pickedItems} / {totalItems} items picked
          </span>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No products have been allocated to this shipment yet.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">SKU/Var</th>
                  <th className="px-2 py-1">Product name</th>
                  <th className="px-2 py-1 text-right">Pieces requested</th>
                  <th className="px-2 py-1 text-right">Cases</th>
                  <th className="px-2 py-1 text-right">Cases remaining to pick</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => {
                  const p = row.products as any;
                  const sku = (p?.sku as string) || "";
                  const skuVar = (p?.sku_var as string) || null;
                  const productName = (p?.product_name as string) || "";
                  const qtyUnits = Number(row.quantity_shipped_units) || 0;
                  const unitsPerCase = Number((row as any).units_per_case) || 0;
                  const casesRequired = unitsPerCase > 0 ? Math.ceil(qtyUnits / unitsPerCase) : 0;
                  const casesPicked = Number((row as any).cases_picked) || 0;
                  const casesRemaining = Math.max(casesRequired - casesPicked, 0);
                  const locations: { location_code: string; quantity: number; available_cases: number }[] =
                    (row.locations as any[]) || [];

                  const canPickMore = casesRemaining > 0;

                  return (
                    <React.Fragment key={row.id as string}>
                      <tr className="border-b last:border-none">
                        <td className="py-1 pr-2 pl-3 font-mono text-[11px]">
                          {sku}
                          {skuVar ? `-${skuVar}` : ""}
                        </td>
                        <td className="px-2 py-1 text-[11px]">{productName}</td>
                        <td className="px-2 py-1 text-right text-[11px]">{qtyUnits}</td>
                        <td className="px-2 py-1 text-right text-[11px]">{casesRequired}</td>
                        <td className="px-2 py-1 text-right text-[11px]">{casesRemaining}</td>
                      </tr>

                      {locations.map((loc, idx) => (
                        <tr
                          key={`${row.id as string}-loc-${loc.location_code}-${idx}`}
                          className="border-b last:border-none"
                        >
                          <td className="py-1 pr-2 pl-6 font-mono text-[11px] text-muted-foreground">
                            {canPickMore ? (
                              <a
                                href={`/warehouse/deduct?product_id=${encodeURIComponent(row.product_id as string)}&shipment_id=${encodeURIComponent(shipmentId)}&location=${encodeURIComponent(loc.location_code)}&reason=order`}
                                className="text-primary hover:underline"
                              >
                                {loc.location_code}
                              </a>
                            ) : (
                              <span className="cursor-default text-muted-foreground">
                                {loc.location_code}
                                <span className="ml-1 align-middle text-[10px]">(Fully picked)</span>
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1 text-[11px] text-muted-foreground">&nbsp;</td>
                          <td className="px-2 py-1 text-right text-[11px] text-muted-foreground">&nbsp;</td>
                          <td className="px-2 py-1 text-right text-[11px] text-muted-foreground">&nbsp;</td>
                          <td className="px-2 py-1 text-right text-[11px] text-muted-foreground">{loc.quantity}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile pick cards */}
          <div className="space-y-2 md:hidden">
            {rows.map((row: any) => {
              const p = row.products as any;
              const sku = (p?.sku as string) || "";
              const skuVar = (p?.sku_var as string) || null;
              const productName = (p?.product_name as string) || "";
              const qtyUnits = Number(row.quantity_shipped_units) || 0;
              const unitsPerCase = Number((row as any).units_per_case) || 0;
              const casesRequired = unitsPerCase > 0 ? Math.ceil(qtyUnits / unitsPerCase) : 0;
              const casesPicked = Number((row as any).cases_picked) || 0;
              const casesRemaining = Math.max(casesRequired - casesPicked, 0);
              const locations: { location_code: string; quantity: number; available_cases: number }[] =
                (row.locations as any[]) || [];

              const canPickMore = casesRemaining > 0;
              const completed = !canPickMore;

              return locations.map((loc, idx) => {
                const lowStock = loc.available_cases < casesRemaining;

                return (
                  <div
                    key={`${row.id as string}-card-${loc.location_code}-${idx}`}
                    className="rounded-lg border bg-white p-3 shadow-sm"
                  >
                    <div className="font-mono font-semibold text-sm">
                      {sku}
                      {skuVar ? `-${skuVar}` : ""}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{productName}</div>
                    <div className="mt-1 text-[11px]">
                      Location: <span className="font-mono">{loc.location_code}</span>
                    </div>
                    <div className="mt-1 text-[11px]">
                      Available:{" "}
                      <span className={lowStock ? "font-medium text-red-600" : ""}>{loc.available_cases} cases</span>
                      {lowStock && <span className="ml-1 align-middle text-[10px] text-red-600">(Low stock)</span>}
                    </div>
                    <div className="mt-1 text-[11px]">
                      Cases remaining: {casesRemaining} {completed && <span className="text-emerald-600">✓</span>}
                    </div>

                    {canPickMore ? (
                      <a
                        href={`/warehouse/deduct?product_id=${encodeURIComponent(
                          row.product_id as string,
                        )}&shipment_id=${encodeURIComponent(
                          shipmentId,
                        )}&location=${encodeURIComponent(loc.location_code)}&reason=order`}
                        className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-1.5 font-medium text-[11px] text-primary-foreground hover:bg-primary/90"
                      >
                        Pick from this location
                      </a>
                    ) : (
                      <div className="mt-2 text-center text-[11px] text-muted-foreground">✓ Picked</div>
                    )}
                  </div>
                );
              });
            })}
          </div>

          {/* Mark order Ready button */}
          <form action={markShipmentReady} className="pt-3">
            <input type="hidden" name="shipment_id" value={shipmentId} />
            <button
              type="submit"
              disabled={pickedItems < totalItems}
              className={`inline-flex items-center rounded-md px-3 py-1.5 font-medium text-[11px] transition-colors ${
                pickedItems < totalItems
                  ? "cursor-not-allowed bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              Mark order Ready
            </button>
          </form>
        </>
      )}
    </div>
  );
}
