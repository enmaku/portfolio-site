import { BIOMES, SEA_LEVEL } from '../core/biomeIds.js'
import { classifyBiomeFromSample } from '../core/classifyBiomesFromFields.js'
import { biomeColorForId } from './biomePalette.js'

/**
 * Terrain colors with river corridors replaced by underlying land biomes.
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @param {number} [seaLevel]
 * @returns {Uint8ClampedArray}
 */
export function buildLandTerrainRgba(worldDocument, seaLevel = SEA_LEVEL) {
  const { gridWidth, gridHeight, biomes, fields } = worldDocument
  const { elevation, temperature, rainfall, drainage, salidity } = fields
  const rgba = new Uint8ClampedArray(gridWidth * gridHeight * 4)

  for (let i = 0; i < biomes.length; i += 1) {
    let biomeId = biomes[i]
    if (biomeId === BIOMES.RIVER_CORRIDOR) {
      biomeId = classifyBiomeFromSample(
        {
          elevation: elevation[i],
          temperature: temperature[i],
          rainfall: rainfall[i],
          drainage: drainage[i],
          salidity: salidity[i],
        },
        seaLevel,
      )
    }

    const [r, g, b, a] = biomeColorForId(biomeId)
    const offset = i * 4
    rgba[offset] = r
    rgba[offset + 1] = g
    rgba[offset + 2] = b
    rgba[offset + 3] = a
  }

  return rgba
}
