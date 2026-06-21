/** @enum {number} */
export const BIOMES = {
  OCEAN: 0,
  COAST: 1,
  GRASSLAND: 2,
  SAVANNA: 3,
  TEMPERATE_FOREST: 4,
  TROPICAL_RAINFOREST: 5,
  TAIGA: 6,
  TUNDRA: 7,
  DESERT: 8,
  SCRUBLAND: 9,
  SWAMP: 10,
  HILLS: 11,
  MOUNTAIN: 12,
  GLACIER: 13,
  FRESHWATER_LAKE: 14,
  RIVER_CORRIDOR: 15,
}

export const BIOMES_COUNT = 16

/** Normalized elevation below this value is ocean. */
export const SEA_LEVEL = 0.38

/** Normalized elevation at or above which cold cells gain a snow cap (glacier). */
export const SNOW_CAP_ELEVATION_MIN = 0.82

/** Normalized temperature at or below which high cells gain a snow cap (glacier). */
export const SNOW_CAP_TEMPERATURE_MAX = 0.28
