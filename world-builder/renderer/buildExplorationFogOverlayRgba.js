import {
  incrementResourceRasterOverlayRgbaBuildCount,
  resourceRasterOverlayCanvasFromRgba,
} from './buildResourceRasterOverlayRgba.js'
import { resolveVisitRaster } from '../core/colonization/visitStatus/visitRaster.js'

/** Semi-transparent fog tint on unvisited cells. */
export const EXPLORATION_FOG_RGB = [30, 30, 45]

/** Fog alpha on unvisited cells; visited cells are transparent. */
export const EXPLORATION_FOG_ALPHA = 0.55

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildExplorationFogOverlayRgba(worldDocument) {
  incrementResourceRasterOverlayRgbaBuildCount()
  const { gridWidth, gridHeight } = worldDocument
  if (!gridWidth || !gridHeight) {
    return null
  }

  const visitRaster = resolveVisitRaster(
    worldDocument.visitedCells,
    gridWidth,
    gridHeight,
  )
  let hasUnvisited = false
  for (let i = 0; i < visitRaster.length; i += 1) {
    if (visitRaster[i] === 0) {
      hasUnvisited = true
      break
    }
  }
  if (!hasUnvisited) {
    return null
  }

  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)
  const alphaByte = Math.round(EXPLORATION_FOG_ALPHA * 255)
  for (let i = 0; i < visitRaster.length; i += 1) {
    if (visitRaster[i] === 1) continue
    const base = i * 4
    rgba[base] = EXPLORATION_FOG_RGB[0]
    rgba[base + 1] = EXPLORATION_FOG_RGB[1]
    rgba[base + 2] = EXPLORATION_FOG_RGB[2]
    rgba[base + 3] = alphaByte
  }
  return rgba
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildExplorationFogOverlayCanvas(worldDocument) {
  const rgba = buildExplorationFogOverlayRgba(worldDocument)
  if (!rgba) {
    return null
  }
  const { gridWidth, gridHeight } = worldDocument
  return resourceRasterOverlayCanvasFromRgba(rgba, gridWidth, gridHeight)
}
