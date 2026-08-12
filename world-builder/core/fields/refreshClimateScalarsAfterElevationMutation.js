import { refreshFieldsAfterErosion } from './refreshFieldsAfterErosion.js'

/**
 * Recompute climate scalar fields after elevation mutates (erosion, hydrology settle).
 * @param {Parameters<typeof refreshFieldsAfterErosion>[0]} params
 * @returns {ReturnType<typeof refreshFieldsAfterErosion>}
 */
export function refreshClimateScalarsAfterElevationMutation(params) {
  return refreshFieldsAfterErosion(params)
}
