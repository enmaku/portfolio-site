/** Scales normalized rainfall (0..1) into flow units expected by river cutoffs. */
export const RUNOFF_TO_FLOW_UNITS = 12

/** Minimum per-cell runoff so headwaters still participate in routing. */
export const RUNOFF_EPSILON = 1e-4

/**
 * @param {Float32Array} drainage
 * @param {number} idx
 * @param {number} [soilDrainageScale]
 * @returns {number}
 */
export function computeDrainageInfiltration(drainage, idx, soilDrainageScale = 1) {
  return Math.min(0.8, Math.max(0, drainage[idx]) * 0.55 * soilDrainageScale)
}

/**
 * Precipitation-weighted local runoff:
 * max(epsilon, rainfall × (1 − infiltration) + snow_melt)
 * @param {Object} params
 * @param {Float32Array} params.rainfall
 * @param {Float32Array} [params.meltContribution]
 * @param {Float32Array} [params.soilDrainage]
 * @param {number} [params.soilDrainageScale]
 * @param {boolean[]} [params.ocean]
 * @returns {Float32Array}
 */
export function computeCellRunoff({
  rainfall,
  meltContribution,
  soilDrainage,
  soilDrainageScale = 1,
  ocean,
}) {
  const runoff = new Float32Array(rainfall.length)
  for (let i = 0; i < runoff.length; i += 1) {
    if (ocean?.[i]) {
      runoff[i] = 0
      continue
    }
    const infiltration = soilDrainage
      ? computeDrainageInfiltration(soilDrainage, i, soilDrainageScale)
      : 0
    const rainfallRunoff = rainfall[i] * (1 - infiltration)
    const snowMelt = meltContribution?.[i] ?? 0
    runoff[i] = Math.max(
      RUNOFF_EPSILON,
      (rainfallRunoff + snowMelt) * RUNOFF_TO_FLOW_UNITS,
    )
  }
  return runoff
}
