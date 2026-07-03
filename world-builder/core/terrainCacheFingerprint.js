import { omitColonizationSliceFields } from './colonization/createDefaultColonizationSlice.js'

/**
 * Stable identity for a generated landmass (seed + generation controls).
 * @param {{
 *   geographySeed: number,
 *   prevailingWindDegrees: number,
 *   generationOptions: Record<string, unknown>,
 * }} input
 * @returns {string}
 */
export function buildTerrainCacheFingerprint(input) {
  return JSON.stringify({
    geographySeed: input.geographySeed,
    prevailingWindDegrees: input.prevailingWindDegrees,
    generationOptions: input.generationOptions,
  })
}

/**
 * Geography-only document for terrain cache (colonization lives in session settings).
 * @param {import('./types.js').WorldDocument} doc
 * @returns {import('./types.js').WorldDocument}
 */
export function stripColonizationFromWorldDocument(doc) {
  return omitColonizationSliceFields(doc)
}
