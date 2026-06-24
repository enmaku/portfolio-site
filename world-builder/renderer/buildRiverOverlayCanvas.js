import { BIOMES } from '../core/biomeIds.js'
import { biomeColorForId } from './biomePalette.js'
import { computeRiverOverlayAlpha } from './smoothRiverBiomeEdgesInRgba.js'

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {Uint8ClampedArray | null}
 */
export function buildRiverOverlayRgba(worldDocument) {
  const { gridWidth, gridHeight, biomes } = worldDocument
  const alpha = computeRiverOverlayAlpha(biomes, gridWidth, gridHeight)
  if (!alpha.some((value) => value > 0)) {
    return null
  }

  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)
  const [riverR, riverG, riverB] = biomeColorForId(BIOMES.RIVER_CORRIDOR)

  for (let i = 0; i < alpha.length; i += 1) {
    const a = alpha[i]
    if (a <= 0) continue
    const offset = i * 4
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
