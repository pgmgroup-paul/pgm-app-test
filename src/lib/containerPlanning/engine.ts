import { MAX_CONTAINER_VOLUME, MAX_CONTAINER_WEIGHT } from "./constants";
import { getPurchaseOrderLines } from "./data";
import { getDemandPerSku } from "./demand";
import { getStockPerSku } from "./stock";
import { getCartonMetrics } from "./dimensions";

export interface ContainerPlanItem {
  sku_id: string;
  purchase_order_line_id: string;
  cartons: number;
  units_per?: number | null;
}

export interface ContainerPlanContainer {
  temp_index: number;
  total_weight: number;
  total_volume: number;
  items: ContainerPlanItem[];
}

export interface ContainerPlanWarning {
  sku_id: string;
  reason: string;
}

export interface ContainerPlanResult {
  containers: ContainerPlanContainer[];
  warnings: ContainerPlanWarning[];
}

/**
 * Generate an in-memory container plan for carton-level planning.
 *
 * - Does NOT persist anything to the database.
 * - Uses existing data services for PO lines, demand, and stock.
 */
export async function generateContainerPlan(): Promise<ContainerPlanResult> {
  const [poLines, demandBySkuList, stockBySkuList] = await Promise.all([
    getPurchaseOrderLines(),
    getDemandPerSku(),
    getStockPerSku(),
  ]);

  const warnings: ContainerPlanWarning[] = [];

  // Index demand and stock by sku_id (product_id)
  const demandMap = new Map<string, number>();
  for (const d of demandBySkuList) {
    demandMap.set(d.sku_id, d.total_demand);
  }

  console.log("DEMAND DEBUG MAP", Array.from(demandMap.entries()).slice(0, 10));

  const stockMap = new Map<string, number>();
  for (const s of stockBySkuList) {
    stockMap.set(s.sku_id, s.total_stock);
  }

  // 2. Normalize data per SKU / PO line into a plannable pool
  type PoolEntry = {
    sku_id: string;
    purchase_order_line_id: string;
    plannable_cartons: number;
    demand_cartons: number;
    ship_date: string | null;
    carton_weight_kg: number;
    carton_volume_m3: number;
    units_per: number;
  };

  const pool: PoolEntry[] = [];

  for (const line of poLines) {
    const {
      purchase_order_line_id,
      sku_id,
      quantity,
      ship_date,
      length,
      width,
      height,
      weight,
      units_per,
    } = line as any;

    // Strict checks: units_per must exist and > 0; dimensions must exist.
    if (!units_per || units_per <= 0) {
      warnings.push({ sku_id, reason: "missing units_per for demand conversion" });
      continue;
    }

    if (length == null || width == null || height == null || weight == null) {
      warnings.push({ sku_id, reason: "missing carton dimensions" });
      continue;
    }

    const qty = Number(quantity) || 0;
    if (qty <= 0) {
      warnings.push({ sku_id, reason: "zero or negative quantity" });
      continue;
    }

    // Demand and stock
    const demandUnits = demandMap.get(sku_id) ?? 0;
    const stockRaw = stockMap.get(sku_id) ?? 0; // raw from inventory_location (cases or units)

    console.log("DEMAND DEBUG", {
      sku: sku_id,
      demand_units: demandUnits,
      stock_units: stockRaw,
      net_demand: demandUnits - stockRaw,
    });

    const demandCartons = Math.ceil(demandUnits / units_per);
    const stockCartons = stockRaw; // NOTE: currently assumes stock is already in cartons/cases

    const netDemandCartons = demandCartons - stockCartons;
    if (netDemandCartons <= 0) {
      warnings.push({ sku_id, reason: "no net demand after stock" });
      continue;
    }

    // Use cartons_floor from data layer; allow non-full cartons but do not inflate
    const cartonsFloor = (line as any).cartons_floor != null ? Number((line as any).cartons_floor) || 0 : 0;

    if (cartonsFloor <= 0) {
      warnings.push({ sku_id, reason: "no plannable cartons" });
      continue;
    }

    const isExact = !!(line as any).is_exact;
    if (!isExact) {
      warnings.push({ sku_id, reason: "not full cartons" });
    }

    const cartonsAvailable = cartonsFloor;

    const plannableCartons = Math.min(netDemandCartons, cartonsAvailable);
    if (plannableCartons <= 0) {
      warnings.push({ sku_id, reason: "no plannable cartons after demand" });
      continue;
    }

    // Attach carton-level metrics
    const metrics = getCartonMetrics({ length, width, height, weight, units_per });
    if (!metrics || metrics.carton_weight_kg == null || metrics.carton_volume_m3 == null) {
      warnings.push({ sku_id, reason: "missing or invalid carton dimensions" });
      continue;
    }

    pool.push({
      sku_id,
      purchase_order_line_id,
      plannable_cartons: plannableCartons,
      demand_cartons: demandCartons,
      ship_date,
      carton_weight_kg: metrics.carton_weight_kg,
      carton_volume_m3: metrics.carton_volume_m3,
      units_per,
    });
  }

  // 6. Sort SKU pool: demand_cartons DESC, ship_date ASC (nulls last)
  pool.sort((a, b) => {
    if (b.demand_cartons !== a.demand_cartons) {
      return b.demand_cartons - a.demand_cartons;
    }

    const aTime = a.ship_date ? new Date(a.ship_date).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.ship_date ? new Date(b.ship_date).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  // 7. Pack into containers
  const containers: ContainerPlanContainer[] = [];
  let currentIndex = 1;
  let currentWeight = 0;
  let currentVolume = 0;
  const currentItems = new Map<string, ContainerPlanItem>(); // key: sku_id + POL

  const flushContainer = () => {
    if (currentItems.size === 0) return;
    containers.push({
      temp_index: currentIndex++,
      total_weight: currentWeight,
      total_volume: currentVolume,
      items: Array.from(currentItems.values()),
    });
    currentWeight = 0;
    currentVolume = 0;
    currentItems.clear();
  };

  for (const entry of pool) {
    let remaining = entry.plannable_cartons;

    // Pre-compute full allocation impact for this PO line
    const fullWeight = entry.plannable_cartons * entry.carton_weight_kg;
    const fullVolume = entry.plannable_cartons * entry.carton_volume_m3;

    // 1) Try full allocation into current container
    if (
      remaining > 0 &&
      currentItems.size > 0 && // only treat as "current" if there's already content
      currentWeight + fullWeight <= MAX_CONTAINER_WEIGHT &&
      currentVolume + fullVolume <= MAX_CONTAINER_VOLUME
    ) {
      // Hard guard: do not create items with cartons < 2
      if (remaining < 2) {
        remaining = 0;
        continue;
      }

      const key = `${entry.sku_id}__${entry.purchase_order_line_id}`;
      const existing = currentItems.get(key);
      if (existing) {
        existing.cartons += remaining;
      } else {
        currentItems.set(key, {
          sku_id: entry.sku_id,
          purchase_order_line_id: entry.purchase_order_line_id,
          cartons: remaining,
        });
      }
      currentWeight += fullWeight;
      currentVolume += fullVolume;
      remaining = 0;
      continue;
    }

    // 2) Try full allocation into a new empty container
    if (
      remaining > 0 &&
      fullWeight <= MAX_CONTAINER_WEIGHT &&
      fullVolume <= MAX_CONTAINER_VOLUME
    ) {
      // Hard guard: do not create items with cartons < 2
      if (remaining < 2) {
        remaining = 0;
        continue;
      }

      // Close current container (if any content) before starting a dedicated one for this PO
      flushContainer();

      const key = `${entry.sku_id}__${entry.purchase_order_line_id}`;
      currentItems.set(key, {
        sku_id: entry.sku_id,
        purchase_order_line_id: entry.purchase_order_line_id,
        cartons: remaining,
      });
      currentWeight = fullWeight;
      currentVolume = fullVolume;
      remaining = 0;
      continue;
    }

    // 3) Fallback: split across containers, one carton at a time
    // If total plannable cartons for this PO line < 2, skip splitting entirely for this entry.
    if (remaining < 2) {
      continue;
    }

    while (remaining > 0) {
      if (remaining < 2) {
        // Do not allocate a trailing single carton
        break;
      }

      const key = `${entry.sku_id}__${entry.purchase_order_line_id}`;
      const existing = currentItems.get(key);

      // Prevent micro-filling: when mixing a new SKU into a non-empty container,
      // only allow if we can place at least 2 cartons in this container.
      if (!existing && currentItems.size > 0) {
        const remainingWeightCapacity = MAX_CONTAINER_WEIGHT - currentWeight;
        const remainingVolumeCapacity = MAX_CONTAINER_VOLUME - currentVolume;
        const maxByWeight = Math.floor(remainingWeightCapacity / entry.carton_weight_kg);
        const maxByVolume = Math.floor(remainingVolumeCapacity / entry.carton_volume_m3);
        const maxCartonsHere = Math.min(maxByWeight, maxByVolume);

        if (maxCartonsHere < 2) {
          // Skip this SKU for the current container; move to the next container
          flushContainer();
          continue;
        }
      }

      // If adding one more carton would exceed limits, close current container and start a new one
      if (
        currentWeight + entry.carton_weight_kg > MAX_CONTAINER_WEIGHT ||
        currentVolume + entry.carton_volume_m3 > MAX_CONTAINER_VOLUME
      ) {
        flushContainer();
        continue;
      }

      // Add one carton into the (possibly new) current container
      currentWeight += entry.carton_weight_kg;
      currentVolume += entry.carton_volume_m3;

      if (existing) {
        existing.cartons += 1;
      } else {
        // Hard guard: do not create a new item with only 1 carton
        currentItems.set(key, {
          sku_id: entry.sku_id,
          purchase_order_line_id: entry.purchase_order_line_id,
          cartons: 2,
          units_per: entry.units_per,
        });
        remaining -= 1; // we consumed an extra carton for the minimum allocation of 2
      }

      remaining -= 1;
    }
  }

  // Push the last container if it has content
  flushContainer();

  // Final safety: remove any items with cartons < 2 from all containers
  for (const container of containers) {
    container.items = container.items.filter((item) => item.cartons >= 2);
  }

  return { containers, warnings };
}
