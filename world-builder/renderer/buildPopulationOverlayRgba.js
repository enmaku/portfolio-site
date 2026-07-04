import {
  incrementResourceRasterOverlayRgbaBuildCount,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'

/** Magenta population overlay tint. */
export const POPULATION_OVERLAY_RGB = [255, 64, 160]

/** Floor alpha for the sparsest occupied cell (still readable, not a solid disc). */
export const POPULATION_OVERLAY_MIN_ALPHA = 0.14

/** Max alpha for the densest population cell. */
export const POPULATION_OVERLAY_MAX_ALPHA = 0.9

/**
 * @param {number} value
 * @param {number} maxValue
 * @returns {number} alpha in 0..1
 */
export function populationOverlayAlphaForValue(value, maxValue) {
  if (!(value > 0) || !(maxValue > 0)) {
    return 0
  }
  const t = Math.min(1, value / maxValue)
  return (
    POPULATION_OVERLAY_MIN_ALPHA +
    (POPULATION_OVERLAY_MAX_ALPHA - POPULATION_OVERLAY_MIN_ALPHA) * Math.sqrt(t)
  )
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildPopulationOverlayRgba(worldDocument) {
  incrementResourceRasterOverlayRgbaBuildCount()
  const { gridWidth, gridHeight, populationCollapseRaster } = worldDocument
  if (!populationCollapseRaster || populationCollapseRaster.length !== gridWidth * gridHeight) {
    return null
  }

  let maxValue = 0
  for (let i = 0; i < populationCollapseRaster.length; i += 1) {
    if (populationCollapseRaster[i] > maxValue) {
      maxValue = populationCollapseRaster[i]
    }
  }
  if (maxValue <= 0) {
    return null
  }

  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)
  for (let i = 0; i < populationCollapseRaster.length; i += 1) {
    const value = populationCollapseRaster[i]
    if (value <= 0) continue
    const alphaByte = Math.round(populationOverlayAlphaForValue(value, maxValue) * 255)
    const base = i * 4
    rgba[base] = POPULATION_OVERLAY_RGB[0]
    rgba[base + 1] = POPULATION_OVERLAY_RGB[1]
    rgba[base + 2] = POPULATION_OVERLAY_RGB[2]
    rgba[base + 3] = alphaByte
  }
  return rgba
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildPopulationOverlayCanvas(worldDocument) {
  const rgba = buildPopulationOverlayRgba(worldDocument)
  if (!rgba) {
    return null
  }
  return resourceRasterOverlayCanvasFromRgba(rgba, worldDocument.gridWidth, worldDocument.gridHeight)
}
