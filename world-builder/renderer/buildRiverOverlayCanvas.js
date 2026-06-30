import { BIOMES } from '../core/biomeIds.js'
import { readRiverNetworkFromWorldDocument } from '../core/hydrology/riverNetwork.js'
import { biomeColorForId } from './biomePalette.js'
import {
  computeRiverOutlineMask,
  computeRiverOverlayAlphaFromCorridor,
  WATER_BODY_OUTLINE_RGBA,
} from './riverCorridorOverlayRgba.js'

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildRiverOverlayRgba(worldDocument) {
  const { gridWidth, gridHeight } = worldDocument
  const network = readRiverNetworkFromWorldDocument(worldDocument)
  if (!network) return null

  const alpha = computeRiverOverlayAlphaFromCorridor(network.corridor, gridWidth, gridHeight)
  const outline = computeRiverOutlineMask(alpha, gridWidth, gridHeight)
  if (!alpha.some((value) => value > 0) && !outline.some((value) => value > 0)) {
    return null
  }

  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)
  const [riverR, riverG, riverB] = biomeColorForId(BIOMES.RIVER_CORRIDOR)
  const [outlineR, outlineG, outlineB, outlineA] = WATER_BODY_OUTLINE_RGBA

  for (let i = 0; i < alpha.length; i += 1) {
    const offset = i * 4
    if (outline[i]) {
      rgba[offset] = outlineR
      rgba[offset + 1] = outlineG
      rgba[offset + 2] = outlineB
      rgba[offset + 3] = outlineA
      continue
    }

    const a = alpha[i]
    if (a <= 0) continue
    rgba[offset] = riverR
    rgba[offset + 1] = riverG
    rgba[offset + 2] = riverB
    rgba[offset + 3] = Math.round(a * 255)
  }

  return rgba
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {HTMLCanvasElement | null}
 */
export function buildRiverOverlayCanvas(worldDocument) {
  const { gridWidth, gridHeight } = worldDocument
  const rgba = buildRiverOverlayRgba(worldDocument)
  if (!rgba) {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = gridWidth
  canvas.height = gridHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context for river overlay')
  }
  ctx.putImageData(new ImageData(rgba, gridWidth, gridHeight), 0, 0)
  return canvas
}
