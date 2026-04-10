export interface CartonDimensionRow {
  // Raw dimensions in imperial units
  length: number | null; // inches
  width: number | null; // inches
  height: number | null; // inches
  weight: number | null; // pounds
  units_per: number | null;
}

export interface CartonMetrics {
  carton_weight_kg: number | null;
  carton_volume_m3: number | null;
  units_per: number;
}

/**
 * Convert raw carton-level dimensions into normalized metrics for planning.
 *
 * - Weight: lb → kg (factor 0.453592)
 * - Dimensions: inches → meters (factor 0.0254)
 * - Volume: length_m * width_m * height_m (m³)
 *
 * Validation:
 * - units_per must exist and be > 0, otherwise returns null
 *
 * Note: does NOT compute per-unit values; callers stay at carton level.
 */
export function getCartonMetrics(row: CartonDimensionRow | null | undefined): CartonMetrics | null {
  if (!row) return null;

  const unitsPer = row.units_per != null ? Number(row.units_per) : NaN;
  if (!Number.isFinite(unitsPer) || unitsPer <= 0) {
    return null;
  }

  const IN_TO_M = 0.0254;
  const LB_TO_KG = 0.453592;

  const lengthM = row.length != null ? Number(row.length) * IN_TO_M : null;
  const widthM = row.width != null ? Number(row.width) * IN_TO_M : null;
  const heightM = row.height != null ? Number(row.height) * IN_TO_M : null;
  const weightKg = row.weight != null ? Number(row.weight) * LB_TO_KG : null;

  let volumeM3: number | null = null;
  if (
    lengthM != null &&
    widthM != null &&
    heightM != null &&
    Number.isFinite(lengthM) &&
    Number.isFinite(widthM) &&
    Number.isFinite(heightM)
  ) {
    volumeM3 = lengthM * widthM * heightM;
  }

  return {
    carton_weight_kg: Number.isFinite(weightKg ?? NaN) ? (weightKg as number) : null,
    carton_volume_m3: volumeM3,
    units_per: unitsPer,
  };
}
