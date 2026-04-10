"use client";

import { useEffect, useMemo, useState } from "react";

const MAX_WEIGHT_KG = 28000;
const MAX_VOLUME_M3 = 67;

interface ProductMeta {
  name: string | null;
  sku: string | null;
  variant: string | null;
}

interface AvailableItemApi {
  purchase_order_line_id: string;
  sku_id: string;
  product: ProductMeta | null;
  po_number: string | null;
  ship_date: string | null;
  cartons_total: number;
  cartons_remaining: number;
  units_per: number | null;
  demand_cartons?: number;
  shortage_cartons?: number;
  has_data_issue?: boolean;
  missing_units_per?: boolean;
  missing_carton_dims?: boolean;
  carton_weight_kg: number | null;
  carton_volume_m3: number | null;
}

interface ApiResponse {
  available_items?: AvailableItemApi[];
}

interface ContainerItem {
  purchase_order_line_id: string;
  sku_id: string;
  product: ProductMeta | null;
  po_number: string | null;
  cartons: number;
  units_per: number | null;
  carton_weight_kg: number | null;
  carton_volume_m3: number | null;
}

export default function ContainerPlanningPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [availableItems, setAvailableItems] = useState<AvailableItemApi[]>([]);
  const [containerItems, setContainerItems] = useState<ContainerItem[]>([]);
  const [allocatedMap, setAllocatedMap] = useState<Record<string, number>>({});
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: "asc" | "desc" }>({
    key: "ship_date",
    direction: "asc",
  });

  const getMaxCartons = (lineId: string) => {
    const line = availableItems.find((l) => l.purchase_order_line_id === lineId);
    return line?.cartons_total ?? 0;
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const handleCartonChange = (lineId: string, newValue: number) => {
    if (!Number.isFinite(newValue)) return;
    const max = getMaxCartons(lineId);
    const nextValue = Math.max(0, Math.min(newValue, max));

    setAllocatedMap((prev) => {
      const updated = { ...prev };
      if (nextValue === 0) {
        delete updated[lineId];
      } else {
        updated[lineId] = nextValue;
      }
      return updated;
    });
  };

  const handleRemove = (itemToRemove: ContainerItem) => {
    const lineId = itemToRemove.purchase_order_line_id;
    if (!lineId) return;

    // Optional confirm could be added here
    setAllocatedMap((prev) => {
      const updated = { ...prev };
      delete updated[lineId];
      return updated;
    });

    setContainerItems((prev) => prev.filter((i) => i.purchase_order_line_id !== lineId));
  };

  async function handleLoad() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/container-planning/debug", { method: "GET" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with status ${res.status}`);
      }

      const json = (await res.json()) as ApiResponse;
      const items = json.available_items ?? [];
      setAvailableItems(items);
      setContainerItems([]);
      setAllocatedMap({});
    } catch (err: any) {
      console.error("Error loading container planning data", err);
      setError(err?.message || "Failed to load container planning data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Auto-load PO lines on initial mount
    handleLoad();
  }, []);

  function handleAdd(lineId: string, item: AvailableItemApi, qty: number) {
    const allocated = allocatedMap[lineId] ?? 0;
    const remaining = Math.max((item.cartons_total || 0) - allocated, 0);
    const toAdd = Math.min(qty, remaining);
    if (toAdd <= 0) return;

    setContainerItems((prev) => {
      const existing = prev.find((i) => i.purchase_order_line_id === lineId);
      if (existing) {
        return prev.map((i) =>
          i.purchase_order_line_id === lineId
            ? { ...i, cartons: i.cartons + toAdd }
            : i,
        );
      }
      return [
        ...prev,
        {
          purchase_order_line_id: lineId,
          sku_id: item.sku_id,
          product: item.product ?? null,
          po_number: item.po_number ?? null,
          cartons: toAdd,
          units_per: item.units_per ?? null,
          carton_weight_kg: item.carton_weight_kg ?? null,
          carton_volume_m3: item.carton_volume_m3 ?? null,
        },
      ];
    });

    setAllocatedMap((prev) => ({
      ...prev,
      [lineId]: (prev[lineId] ?? 0) + toAdd,
    }));
  }

  const availableWithRemaining = availableItems
    .map((item) => {
      const lineId = item.purchase_order_line_id;
      const allocated = allocatedMap[lineId] ?? 0;
      const remaining = Math.max((item.cartons_total || 0) - allocated, 0);
      return { item, remaining };
    })
    .filter(({ remaining }) => remaining > 0);

  const sortedAvailableWithRemaining = useMemo(() => {
    const items = [...availableWithRemaining];
    if (!sortConfig.key) return items;

    items.sort((a, b) => {
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;

      switch (sortConfig.key) {
        case "ship_date": {
          aVal = a.item.ship_date ? new Date(a.item.ship_date).getTime() : 0;
          bVal = b.item.ship_date ? new Date(b.item.ship_date).getTime() : 0;
          break;
        }
        case "remaining_cartons": {
          aVal = a.remaining;
          bVal = b.remaining;
          break;
        }
        case "demand_cartons": {
          aVal = a.item.demand_cartons ?? 0;
          bVal = b.item.demand_cartons ?? 0;
          break;
        }
        case "shortage_cartons": {
          aVal = a.item.shortage_cartons ?? 0;
          bVal = b.item.shortage_cartons ?? 0;
          break;
        }
        default:
          return 0;
      }

      if (aVal == null) aVal = 0;
      if (bVal == null) bVal = 0;

      if (aVal < (bVal as any)) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > (bVal as any)) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return items;
  }, [availableWithRemaining, sortConfig]);

  const availableMap = useMemo(() => {
    const map = new Map<string, AvailableItemApi>();
    for (const item of availableItems) {
      map.set(item.purchase_order_line_id, item);
    }
    return map;
  }, [availableItems]);

  const { totalWeight, totalVolume } = useMemo(() => {
    let weight = 0;
    let volume = 0;
    for (const [lineId, cartons] of Object.entries(allocatedMap)) {
      if (!cartons || cartons <= 0) continue;
      const item = availableMap.get(lineId);
      if (!item) continue;
      const cartonWeight = item.carton_weight_kg || 0;
      const cartonVolume = item.carton_volume_m3 || 0;
      weight += cartons * cartonWeight;
      volume += cartons * cartonVolume;
    }
    return { totalWeight: weight, totalVolume: volume };
  }, [allocatedMap, availableMap]);

  const isWeightExceeded = totalWeight > MAX_WEIGHT_KG;
  const isVolumeExceeded = totalVolume > MAX_VOLUME_M3;

  const handleSaveContainer = async () => {
    try {
      const items = Object.entries(allocatedMap)
        .filter(([_, cartons]) => cartons && cartons > 0)
        .map(([lineId, cartons]) => {
          const item = availableItems.find((i) => i.purchase_order_line_id === lineId);
          if (!item) {
            throw new Error(`Missing available item for PO line ${lineId}`);
          }

          return {
            purchase_order_line_id: lineId,
            sku_id: item.sku_id,
            cartons,
            units_per: item.units_per,
            carton_weight_kg: item.carton_weight_kg,
            carton_volume_m3: item.carton_volume_m3,
          };
        });

      if (items.length === 0) {
        alert("No items to save in container.");
        return;
      }

      const res = await fetch("/api/containers-v2/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items,
          total_weight: totalWeight,
          total_volume: totalVolume,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Error saving container", data);
        alert("Error saving container");
        return;
      }

      window.location.href = "/shipment-planning";
    } catch (err) {
      console.error("Unexpected error saving container", err);
      alert("Unexpected error saving container");
    }
  };

  const weightPct = MAX_WEIGHT_KG > 0 ? (totalWeight / MAX_WEIGHT_KG) * 100 : 0;
  const volumePct = MAX_VOLUME_M3 > 0 ? (totalVolume / MAX_VOLUME_M3) * 100 : 0;

  return (
    <div className="max-w-5xl space-y-4 p-6 text-xs">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-semibold text-2xl tracking-tight">Container Planning</h1>
          <p className="text-muted-foreground text-sm">
            Single-container planning view. Purchase order lines load automatically; then add cartons into the container.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSaveContainer}
          className="inline-flex items-center rounded-md bg-black px-3 py-1.5 font-medium text-[11px] text-white hover:bg-black/80 disabled:opacity-50"
          disabled={Object.keys(allocatedMap).length === 0}
        >
          Save Container
        </button>
      </div>

      {error && <p className="text-[11px] text-destructive">{error}</p>}

      {/* SECTION 1: Container */}
      <div className="space-y-2 rounded-md border px-3 py-3">
        <div className="font-medium text-[11px] mb-1">Container</div>
        <div className="text-[11px] text-muted-foreground">
          Total weight:{" "}
          <span className={isWeightExceeded ? "text-red-600 font-semibold" : "font-mono"}>
            {totalWeight.toFixed(1)} kg ({Math.round(weightPct)}%)
          </span>
          {" "}· Total volume:{" "}
          <span className={isVolumeExceeded ? "text-red-600 font-semibold" : "font-mono"}>
            {totalVolume.toFixed(2)} m³ ({Math.round(volumePct)}%)
          </span>
        </div>
        <div style={{ marginTop: 12 }}>
          {/* WEIGHT */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Weight: {Math.round(weightPct)}%</div>
            <div
              style={{
                height: 10,
                background: "#eee",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(weightPct, 100)}%`,
                  height: "100%",
                  background: weightPct > 100 ? "red" : weightPct > 80 ? "#f0ad4e" : "green",
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          </div>
          {/* VOLUME */}
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Volume: {Math.round(volumePct)}%</div>
            <div
              style={{
                height: 10,
                background: "#eee",
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(volumePct, 100)}%`,
                  height: "100%",
                  background: volumePct > 100 ? "red" : volumePct > 80 ? "#f0ad4e" : "green",
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          </div>
        </div>
        {(isWeightExceeded || isVolumeExceeded) && (
          <div className="mt-1 text-[10px] text-red-600">
            Container exceeds recommended limits
          </div>
        )}
        {containerItems.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No items in container yet. Use the list below to add cartons.</p>
        ) : (
          <div className="mt-1 overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">SKU</th>
                  <th className="px-2 py-1">PO</th>
                  <th className="px-2 py-1 text-right">Cartons</th>
                  <th className="px-2 py-1 text-right">Pieces</th>
                  <th className="px-2 py-1 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {containerItems
                  .filter((item) => (allocatedMap[item.purchase_order_line_id] ?? 0) > 0)
                  .map((item) => {
                  const displaySku = item.product?.sku || item.sku_id;
                  const nameParts: string[] = [];
                  if (item.product?.name) nameParts.push(item.product.name);
                  if (item.product?.variant) nameParts.push(item.product.variant);
                  const displayName = nameParts.join(" — ");

                  return (
                    <tr
                      key={`${item.purchase_order_line_id}-${item.cartons}`}
                      className="border-b last:border-none"
                    >
                      <td className="py-1 pr-2 pl-3 text-[11px]">
                        <span className="font-mono">{displaySku}</span>
                        {displayName && (
                          <span className="ml-1 text-muted-foreground">— {displayName}</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-[11px]">{item.po_number ?? item.purchase_order_line_id}</td>
                      <td className="px-2 py-1 text-right text-[11px]">
                        <input
                          type="number"
                          min={0}
                          value={allocatedMap[item.purchase_order_line_id] ?? item.cartons}
                          onChange={(e) =>
                            handleCartonChange(item.purchase_order_line_id, Number(e.target.value))
                          }
                          style={{ width: 70, padding: "2px 6px" }}
                        />
                      </td>
                      <td className="px-2 py-1 text-right text-[11px]">
                        {item.units_per != null
                          ? (allocatedMap[item.purchase_order_line_id] ?? item.cartons) * item.units_per
                          : "-"}
                      </td>
                      <td className="px-2 py-1 text-right text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleRemove(item)}
                          className="text-[11px] font-semibold text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: Available to Add */}
      <div className="space-y-2 rounded-md border px-3 py-3">
        <div className="font-medium text-[11px] mb-1">Available to Add</div>
        {sortedAvailableWithRemaining.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No cartons available to add. Load PO lines or adjust allocations.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b bg-muted text-[11px] text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 pl-3">SKU</th>
                  <th className="px-2 py-1">PO</th>
                  <th
                    className="px-2 py-1"
                    style={{ cursor: "pointer" }}
                    onClick={() => handleSort("ship_date")}
                  >
                    Ship date
                    {sortConfig.key === "ship_date"
                      ? sortConfig.direction === "asc"
                        ? " ↑"
                        : " ↓"
                      : ""}
                  </th>
                  <th
                    className="px-2 py-1 text-right"
                    style={{ cursor: "pointer" }}
                    onClick={() => handleSort("remaining_cartons")}
                  >
                    Remaining cartons
                    {sortConfig.key === "remaining_cartons"
                      ? sortConfig.direction === "asc"
                        ? " ↑"
                        : " ↓"
                      : ""}
                  </th>
                  <th className="px-2 py-1 text-right">Pieces</th>
                  <th
                    className="px-2 py-1 text-right"
                    style={{ cursor: "pointer" }}
                    onClick={() => handleSort("demand_cartons")}
                  >
                    Demand (cases)
                    {sortConfig.key === "demand_cartons"
                      ? sortConfig.direction === "asc"
                        ? " ↑"
                        : " ↓"
                      : ""}
                  </th>
                  <th
                    className="px-2 py-1 text-right"
                    style={{ cursor: "pointer" }}
                    onClick={() => handleSort("shortage_cartons")}
                  >
                    Shortage (cases)
                    {sortConfig.key === "shortage_cartons"
                      ? sortConfig.direction === "asc"
                        ? " ↑"
                        : " ↓"
                      : ""}
                  </th>
                  <th className="px-2 py-1 text-right">Data Issues</th>
                  <th className="px-2 py-1 text-right">Allocate</th>
                  <th className="px-2 py-1 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedAvailableWithRemaining.map(({ item, remaining }) => {
                  const displaySku = item.product?.sku || item.sku_id;
                  const nameParts: string[] = [];
                  if (item.product?.name) nameParts.push(item.product.name);
                  if (item.product?.variant) nameParts.push(item.product.variant);
                  const displayName = nameParts.join(" — ");

                  return (
                    <tr
                      key={item.purchase_order_line_id}
                      className="border-b last:border-none"
                    >
                      <td className="py-1 pr-2 pl-3 text-[11px]">
                        <span className="font-mono">{displaySku}</span>
                        {displayName && (
                          <span className="ml-1 text-muted-foreground">— {displayName}</span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-[11px]">{item.po_number ?? item.purchase_order_line_id}</td>
                      <td className="px-2 py-1 text-[11px]">
                        {item.ship_date ? new Date(item.ship_date).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-2 py-1 text-right text-[11px]">{remaining}</td>
                      <td className="px-2 py-1 text-right text-[11px]">
                        {item.units_per != null ? remaining * item.units_per : "-"}
                      </td>
                      <td className="px-2 py-1 text-right text-[11px]">
                        <a
                          href={`/sales-shipments/demand?sku=${item.product?.sku ?? ""}`}
                          className="text-blue-600 underline"
                        >
                          {item.demand_cartons ?? 0}
                        </a>
                      </td>
                      <td className="px-2 py-1 text-right text-[11px]">
                        {(() => {
                          const shortage = item.shortage_cartons ?? 0;
                          return shortage > 0 ? (
                            <span className="text-red-600 font-semibold">{shortage}</span>
                          ) : (
                            shortage
                          );
                        })()}
                      </td>
                      <td className="px-2 py-1 text-right text-[11px]">
                        {item.has_data_issue && (
                          <a
                            href={`/products/${item.sku_id}/edit?tab=dimensions&missing_units_per=${item.missing_units_per}&missing_carton_dims=${item.missing_carton_dims}`}
                            style={{
                              color: "red",
                              fontWeight: 600,
                              textDecoration: "underline",
                              cursor: "pointer",
                            }}
                            title={[
                              item.missing_units_per ? "Missing units_per" : null,
                              item.missing_carton_dims ? "Missing carton dimensions" : null,
                            ]
                              .filter(Boolean)
                              .join(" | ")}
                          >
                            ⚠ Fix Data
                          </a>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right text-[11px]">
                        <input
                          type="number"
                          min={0}
                          max={remaining}
                          defaultValue={remaining}
                          className="w-16 rounded border px-1 py-0.5 text-right"
                          onChange={(e) => {
                            const value = Number(e.target.value) || 0;
                            (e.currentTarget as any)._plannedQty = value;
                          }}
                        />
                      </td>
                      <td className="px-2 py-1 text-right text-[11px]">
                        <button
                          type="button"
                          onClick={(e) => {
                            const inputEl = (e.currentTarget.parentElement?.previousElementSibling
                              ?.querySelector("input") ?? null) as HTMLInputElement | null;
                            const raw = inputEl ? Number(inputEl.value) : remaining;
                            const qty = Number.isFinite(raw) ? raw : remaining;
                            handleAdd(item.purchase_order_line_id, item, qty);
                          }}
                          className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] hover:bg-muted"
                        >
                          Add to container
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
