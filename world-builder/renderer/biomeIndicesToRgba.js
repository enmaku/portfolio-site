import { biomeColorForId } from './biomePalette.js'

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {Uint8ClampedArray}
 */
export function biomeIndicesToRgba(worldDocument) {
  const { gridWidth, gridHeight, biomes } = worldDocument
  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)

  for (let i = 0; i < biomes.length; i += 1) {
    const [r, g, b, a] = biomeColorForId(biomes[i])
    const offset = i * 4
    rgba[offset] = r
    rgba[offset + 1] = g
    rgba[offset + 2] = b
    rgba[offset + 3] = a
  }

  return rgba
}
