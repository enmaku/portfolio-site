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
 *   bearings: number[],
 *   kinds: string[],
 * }}
 */
export function buildWindRosePreviewModel({
  geographySeed,
  prevailingWindDegrees,
  secondaryMaximumDegrees,
}) {
  const { bearings, kinds } = buildWindRoseSchedule({
    geographySeed,
    prevailingWindDegrees,
    secondaryMaximumDegrees,
  })
  const weights = new Array(WIND_ROSE_PREVIEW_BINS).fill(0)
  const sampleWeight = 1 / bearings.length
  for (const bearing of bearings) {
    const bin = Math.floor(normalizeWindDegrees(bearing) / (360 / WIND_ROSE_PREVIEW_BINS)) %
      WIND_ROSE_PREVIEW_BINS
    weights[bin] += sampleWeight
  }
  return {
    labels: Array.from({ length: WIND_ROSE_PREVIEW_BINS }, () => ''),
    weights,
    displayWeights: weights.map((weight) => Math.sqrt(weight)),
    bearings,
    kinds,
  }
}
