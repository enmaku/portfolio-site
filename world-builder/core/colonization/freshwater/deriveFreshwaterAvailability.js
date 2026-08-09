import { BIOMES, SEA_LEVEL } from '../../biomeIds.js'

/** No drinkable water access. */
export const FRESHWATER_NONE = 0
/** Surface freshwater: river, lake, or coast. */
export const FRESHWATER_SURFACE = 1
/** Well-viable land (groundwater heuristic). */
export const FRESHWATER_WELL_VIABLE = 2

/** Minimum rainfall for well-viable land (implementation tuning). */
export const WELL_VIABLE_MIN_RAINFALL = 0.4
/** Maximum drainage for well-viable land (implementation tuning). */
export const WELL_VIABLE_MAX_DRAINAGE = 0.45
/** Maximum salinity for well-viable land (implementation tuning). */
export const WELL_VIABLE_MAX_SALINITY = 0.35

/** Biomes that never count as well-viable. */
export const WELL_VIABLE_EXCLUDED_BIOMES = new Set([
  BIOMES.OCEAN,
  BIOMES.DESERT,
  BIOMES.SCRUBLAND,
  BIOMES.GLACIER,
  BIOMES.MOUNTAIN,
])

/**
 * @typedef {Object} FreshwaterCellSample
 * @property {number} rainfall
 * @property {number} drainage
 * @property {number} salinity
 * @property {number} biome
 * @property {number} elevation
 * @property {boolean} lake
 * @property {boolean} river
 * @property {number} [seaLevel]
 */

/**
 * @param {FreshwaterCellSample} sample
 * @returns {typeof FRESHWATER_NONE | typeof FRESHWATER_SURFACE | typeof FRESHWATER_WELL_VIABLE}
 */
export function classifyFreshwaterCell(sample) {
  const seaLevel = sample.seaLevel ?? SEA_LEVEL
  if (sample.biome === BIOMES.OCEAN || sample.elevation < seaLevel) {
    return FRESHWATER_NONE
  }

  if (
    sample.river ||
    sample.lake ||
    sample.biome === BIOMES.COAST ||
    sample.biome === BIOMES.FRESHWATER_LAKE ||
    sample.biome === BIOMES.RIVER_CORRIDOR ||
    sample.biome === BIOMES.SWAMP
  ) {
    return FRESHWATER_SURFACE
  }

  if (WELL_VIABLE_EXCLUDED_BIOMES.has(sample.biome)) {
    return FRESHWATER_NONE
  }

  if (
    sample.rainfall >= WELL_VIABLE_MIN_RAINFALL &&
    sample.drainage <= WELL_VIABLE_MAX_DRAINAGE &&
    sample.salinity <= WELL_VIABLE_MAX_SALINITY
  ) {
    return FRESHWATER_WELL_VIABLE
  }

  return FRESHWATER_NONE
}

/**
 * On-demand freshwater classification raster (not persisted on the world document).
 *
 * @param {{
 *   gridWidth: number,
 *   gridHeight: number,
 *   rainfall: Float32Array,
 *   drainage: Float32Array,
 *   salinity: Float32Array,
 *   biomes: Uint8Array,
 *   elevation: Float32Array,
 *   lakeMask?: Uint8Array | null,
 *   riverCorridorMask?: Uint8Array | null,
 *   seaLevel?: number,
 * }} params
 * @returns {Uint8Array}
 */
export function deriveFreshwaterAvailability(params) {
  const {
    gridWidth,
    gridHeight,
    rainfall,
    drainage,
    salinity,
    biomes,
    elevation,
    lakeMask,
    riverCorridorMask,
    seaLevel = SEA_LEVEL,
  } = params
  const cellCount = gridWidth * gridHeight
  const classification = new Uint8Array(cellCount)

  for (let i = 0; i < cellCount; i += 1) {
    classification[i] = classifyFreshwaterCell({
      rainfall: rainfall[i] ?? 0,
      drainage: drainage[i] ?? 0,
      salinity: salinity[i] ?? 0,
      biome: biomes[i] ?? BIOMES.OCEAN,
      elevation: elevation[i] ?? 0,
      lake: Boolean(lakeMask?.[i]),
      river: Boolean(riverCorridorMask?.[i]),
      seaLevel,
    })
  }

  return classification
}

/**
 * Shared freshwater gate for colonization survival triad.
 *
 * @param {Uint8Array} classification
 * @param {ReadonlyArray<{ x: number, y: number }>} claimCells
 * @param {number} gridWidth
 * @returns {boolean}
 */
export function claimedCellsHaveFreshwater(classification, claimCells, gridWidth) {
  for (const cell of claimCells) {
    const index = cell.y * gridWidth + cell.x
    const value = classification[index]
    if (value === FRESHWATER_SURFACE || value === FRESHWATER_WELL_VIABLE) {
      return true
    }
  }
  return false
}

/**
 * @param {import('../../types.js').WorldDocument} worldDocument
 * @returns {Uint8Array | null}
 */
export function deriveFreshwaterAvailabilityFromDocument(worldDocument) {
  const { gridWidth, gridHeight, fields, biomes, lakeMask, riverCorridorMask } = worldDocument
  if (!fields?.rainfall || !fields?.drainage || !fields?.salinity || !fields?.elevation || !biomes) {
    return null
  }

  return deriveFreshwaterAvailability({
    gridWidth,
    gridHeight,
    rainfall: fields.rainfall,
    drainage: fields.drainage,
    salinity: fields.salinity,
    biomes,
    elevation: fields.elevation,
    lakeMask,
    riverCorridorMask,
  })
}
