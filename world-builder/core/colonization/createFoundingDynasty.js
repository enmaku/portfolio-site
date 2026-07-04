import { BIOMES } from '../biomeIds.js'

/** @type {Readonly<Record<number, string>>} */
const BIOME_LABEL_KEYS = Object.freeze({
  [BIOMES.OCEAN]: 'ocean',
  [BIOMES.COAST]: 'coast',
  [BIOMES.GRASSLAND]: 'grassland',
  [BIOMES.SAVANNA]: 'savanna',
  [BIOMES.TEMPERATE_FOREST]: 'temperate_forest',
  [BIOMES.TROPICAL_RAINFOREST]: 'tropical_rainforest',
  [BIOMES.TAIGA]: 'taiga',
  [BIOMES.TUNDRA]: 'tundra',
  [BIOMES.DESERT]: 'desert',
  [BIOMES.SCRUBLAND]: 'scrubland',
  [BIOMES.SWAMP]: 'swamp',
  [BIOMES.HILLS]: 'hills',
  [BIOMES.MOUNTAIN]: 'mountain',
  [BIOMES.GLACIER]: 'glacier',
  [BIOMES.FRESHWATER_LAKE]: 'freshwater_lake',
  [BIOMES.RIVER_CORRIDOR]: 'river_corridor',
})

/**
 * Landing geography heuristic key for dynasty labeling (not display prose).
 *
 * @param {{ x: number, y: number }} landing
 * @param {import('../types.js').WorldDocument} worldDocument
 * @returns {string}
 */
export function landingGeographyHeuristicKey(landing, worldDocument) {
  const index = landing.y * worldDocument.gridWidth + landing.x
  const biome = worldDocument.biomes?.[index]
  if (biome != null && BIOME_LABEL_KEYS[biome]) {
    return BIOME_LABEL_KEYS[biome]
  }
  if (worldDocument.riverCorridorMask?.[index]) {
    return 'river_corridor'
  }
  if (worldDocument.lakeMask?.[index]) {
    return 'freshwater_lake'
  }
  return 'land'
}

/**
 * Founding dynasty notable-figure seat (flavor only; no per-epoch mechanics).
 *
 * @param {{
 *   settlementId: string,
 *   landing: { x: number, y: number },
 *   worldDocument: import('../types.js').WorldDocument,
 * }} params
 * @returns {{
 *   id: string,
 *   kind: 'dynasty',
 *   settlementId: string,
 *   role: 'founder',
 *   labelKey: string,
 * }}
 */
export function createFoundingDynasty(params) {
  const { settlementId, landing, worldDocument } = params
  const geographyKey = landingGeographyHeuristicKey(landing, worldDocument)
  return {
    id: `dynasty-${settlementId}`,
    kind: 'dynasty',
    settlementId,
    role: 'founder',
    labelKey: `${geographyKey}_dynasty`,
  }
}
