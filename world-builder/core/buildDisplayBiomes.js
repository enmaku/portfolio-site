import { BIOMES, SEA_LEVEL } from './biomeIds.js'
import { classifyBiomeFromSample } from './classifyBiomesFromFields.js'

/**
 * Biome indices for terrain tinting: river corridors show underlying land cover.
 * @param {Uint8Array} biomes simulation biomes (may include river corridor overlay)
 * @param {import('./types.js').ScalarFields} fields
 * @param {number} [seaLevel]
 * @returns {Uint8Array}
 */
export function buildDisplayBiomes(biomes, fields, seaLevel = SEA_LEVEL) {
  const { elevation, temperature, rainfall, drainage, salinity } = fields
  const displayBiomes = new Uint8Array(biomes.length)

  for (let i = 0; i < biomes.length; i += 1) {
    if (biomes[i] === BIOMES.RIVER_CORRIDOR) {
      displayBiomes[i] = classifyBiomeFromSample(
        {
          elevation: elevation[i],
          temperature: temperature[i],
          rainfall: rainfall[i],
          drainage: drainage[i],
          salinity: salinity[i],
        },
        seaLevel,
      )
      continue
    }

    displayBiomes[i] = biomes[i]
  }

  return displayBiomes
}
