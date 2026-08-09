import { biomeColorForId } from './biomePalette.js'

/**
 * Terrain colors from palette-ready display biomes on the world document.
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {Uint8ClampedArray}
 */
export function buildLandTerrainRgba(worldDocument) {
  const { gridWidth, gridHeight, displayBiomes } = worldDocument
  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)

  for (let i = 0; i < displayBiomes.length; i += 1) {
    const [r, g, b, a] = biomeColorForId(displayBiomes[i])
    const offset = i * 4
    rgba[offset] = r
    rgba[offset + 1] = g
    rgba[offset + 2] = b
    rgba[offset + 3] = a
  }

  return rgba
}
