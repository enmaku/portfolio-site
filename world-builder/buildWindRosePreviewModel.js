import { buildWindRoseSchedule } from './core/fields/buildWindRoseSchedule.js'
import { normalizeWindDegrees } from './core/fields/prevailingWindField.js'

/** Polar bins for the sidebar wind-rose preview. */
export const WIND_ROSE_PREVIEW_BINS = 36

/**
 * Aggregate a wind-rose schedule into polar-area weights for Chart.js.
 *
 * @param {{
 *   geographySeed: number,
 *   prevailingWindDegrees: number,
 *   secondaryMaximumDegrees: number,
 * }} params
 * @returns {{
 *   labels: string[],
 *   weights: number[],
 *   displayWeights: number[],
 *   lobes: import('./core/fields/buildWindRoseSchedule.js').WindRoseLobe[],
 * }}
 */
export function buildWindRosePreviewModel({
  geographySeed,
  prevailingWindDegrees,
  secondaryMaximumDegrees,
}) {
  const { lobes } = buildWindRoseSchedule({
    geographySeed,
    prevailingWindDegrees,
    secondaryMaximumDegrees,
  })
  const weights = new Array(WIND_ROSE_PREVIEW_BINS).fill(0)
  for (const lobe of lobes) {
    const bin =
      Math.floor(normalizeWindDegrees(lobe.bearing) / (360 / WIND_ROSE_PREVIEW_BINS)) %
      WIND_ROSE_PREVIEW_BINS
    weights[bin] += lobe.weight
  }
  return {
    labels: Array.from({ length: WIND_ROSE_PREVIEW_BINS }, () => ''),
    weights,
    displayWeights: weights.map((weight) => Math.sqrt(weight)),
    lobes,
  }
}
