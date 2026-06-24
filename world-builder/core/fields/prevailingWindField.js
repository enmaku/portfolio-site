/**
 * Shared prevailing-wind geometry used by rainfall advection, orographic moisture,
 * and seasonal snow. Bearing is meteorological: 0 = north, 90 = east, naming the
 * direction the wind originates from. The returned vector points upwind (toward
 * that source), matching the convention long used by the rain-shadow pass.
 * @param {number} prevailingWindDegrees
 * @returns {{ upwindX: number, upwindY: number }}
 */
export function prevailingWindUpwindVector(prevailingWindDegrees) {
  const radians = (prevailingWindDegrees * Math.PI) / 180
  return {
    upwindX: Math.sin(radians),
    upwindY: -Math.cos(radians),
  }
}

/** Number of discrete samples marched along the wind ray for orographic barrier checks. */
export const WIND_OROGRAPHIC_SAMPLE_STEPS = 6

/**
 * Spacing in cells between successive wind-ray samples, scaled so the physical
 * reach is grid-independent (≈6 cells at the 256² reference grid).
 * @param {number} width
 * @returns {number}
 */
export function windRayStepSizeForGrid(width) {
  return Math.max(1, Math.round(width / 256))
}
