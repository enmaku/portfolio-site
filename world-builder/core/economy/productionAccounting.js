/**
 * Convert claimed production into commodity catalog units (lb / gems).
 * Domain: world-builder/CONTEXT.md — annual commodity flow, mineral deposit.
 */

import { yieldModifierMultiplier } from '../colonization/resolveSurvivalTriad.js'

/** Food productivity unit → edible lb per epoch (100 people × 365 lb). */
export const FOOD_LB_PER_PRODUCTIVITY_UNIT = 36500
/** Salt pin: score × this many lb per claimed pin per epoch. */
export const SALT_LB_PER_SCORE = 10000
/** Timber productivity unit → lb per epoch. */
export const TIMBER_LB_PER_PRODUCTIVITY_UNIT = 16000
/** Metals potential unit → base metals lb per epoch. */
export const BASE_METALS_LB_PER_PRODUCTIVITY_UNIT = 800
/** Typed Cu/Ag/Au claimed deposit → lb per epoch. */
export const PRECIOUS_METAL_LB_PER_EXTRACTION = 1
/** Typed diamond claimed deposit → gems (0.1 lb cargo each) per epoch. */
export const DIAMOND_GEMS_PER_EXTRACTION = 1
/** Salt lb consumed per lb of fish exported (curing at origin). */
export const FISH_CURING_SALT_PER_FISH_LB = 3

/**
 * @typedef {import('./commodityCatalog.js').CommodityId} CommodityId
 */

/**
 * @typedef {Object} SettlementProduction
 * @property {string} settlementId
 * @property {Record<CommodityId, number>} amounts Catalog units (lb or gems).
 */

/**
 * Empty production bag for every catalog commodity.
 * @returns {Record<CommodityId, number>}
 */
export function emptyCommodityAmounts() {
  return {
    grain: 0,
    fish: 0,
    salt: 0,
    timber: 0,
    baseMetals: 0,
    copper: 0,
    silver: 0,
    gold: 0,
    diamonds: 0,
  }
}

/** Map a typed mineral deposit kind to its extracted commodity and per-epoch amount. */
const MINERAL_EXTRACTION_BY_KIND = Object.freeze({
  copper: Object.freeze({ commodity: 'copper', amount: PRECIOUS_METAL_LB_PER_EXTRACTION }),
  silver: Object.freeze({ commodity: 'silver', amount: PRECIOUS_METAL_LB_PER_EXTRACTION }),
  gold: Object.freeze({ commodity: 'gold', amount: PRECIOUS_METAL_LB_PER_EXTRACTION }),
  diamond: Object.freeze({ commodity: 'diamonds', amount: DIAMOND_GEMS_PER_EXTRACTION }),
})

/**
 * @param {import('../types.js').MineralKind} kind
 * @returns {{ commodity: CommodityId, amount: number }}
 */
export function mineralDepositExtraction(kind) {
  return MINERAL_EXTRACTION_BY_KIND[kind]
}

/**
 * Sum one extraction unit per claimed deposit per epoch; unclaimed deposits
 * yield nothing. Copper/silver/gold contribute 1 lb each; diamonds 1 gem.
 *
 * @param {ReadonlyArray<import('../types.js').MetalNode>} deposits
 * @param {(deposit: import('../types.js').MetalNode) => boolean} isClaimed
 * @returns {Record<CommodityId, number>}
 */
export function extractClaimedMineralDeposits(deposits, isClaimed) {
  const amounts = emptyCommodityAmounts()
  if (!deposits) {
    return amounts
  }
  for (const deposit of deposits) {
    if (!isClaimed(deposit)) {
      continue
    }
    const extraction = MINERAL_EXTRACTION_BY_KIND[deposit.kind]
    if (extraction) {
      amounts[extraction.commodity] += extraction.amount
    }
  }
  return amounts
}

/**
 * Sum positive raster values over an exclusive set of claimed cell indices.
 *
 * @param {Float32Array | null | undefined} raster
 * @param {Set<number>} claimedIndices
 * @returns {number}
 */
function sumRasterOnClaimedIndices(raster, claimedIndices) {
  if (!raster) {
    return 0
  }
  let sum = 0
  for (const index of claimedIndices) {
    const value = raster[index]
    if (Number.isFinite(value) && value > 0) {
      sum += value
    }
  }
  return sum
}

/**
 * Convert a settlement's primary-claim rasters and pins into per-epoch commodity
 * amounts. Only cells and pins inside `claimedCells` contribute, keeping
 * production exclusive to the primary claim. Fish is derived elsewhere (no
 * persisted raster), so its productivity arrives precomputed and converts on the
 * same food scale as grain.
 *
 * @param {{
 *   settlementId: string,
 *   claimedCells?: ReadonlyArray<{ x: number, y: number }>,
 *   gridWidth: number,
 *   arableRaster?: Float32Array | null,
 *   timberRaster?: Float32Array | null,
 *   metalsRaster?: Float32Array | null,
 *   yieldModifier?: string,
 *   fishProductivity?: number,
 *   saltNodes?: ReadonlyArray<import('../types.js').SaltNode>,
 *   metalNodes?: ReadonlyArray<import('../types.js').MetalNode>,
 * }} params
 * @returns {SettlementProduction}
 */
export function computeSettlementProduction(params) {
  const {
    settlementId,
    claimedCells = [],
    gridWidth,
    arableRaster = null,
    timberRaster = null,
    metalsRaster = null,
    yieldModifier = 'typical',
    fishProductivity = 0,
    saltNodes = [],
    metalNodes = [],
  } = params

  const amounts = emptyCommodityAmounts()
  const yieldMult = yieldModifierMultiplier(yieldModifier)

  const claimedIndices = new Set()
  for (const cell of claimedCells) {
    claimedIndices.add(cell.y * gridWidth + cell.x)
  }

  const cropProductivity = sumRasterOnClaimedIndices(arableRaster, claimedIndices) * yieldMult
  amounts.grain = cropProductivity * FOOD_LB_PER_PRODUCTIVITY_UNIT
  amounts.fish = Math.max(0, fishProductivity) * FOOD_LB_PER_PRODUCTIVITY_UNIT
  amounts.timber =
    sumRasterOnClaimedIndices(timberRaster, claimedIndices) * TIMBER_LB_PER_PRODUCTIVITY_UNIT
  amounts.baseMetals =
    sumRasterOnClaimedIndices(metalsRaster, claimedIndices) * BASE_METALS_LB_PER_PRODUCTIVITY_UNIT

  for (const pin of saltNodes) {
    if (claimedIndices.has(pin.y * gridWidth + pin.x)) {
      amounts.salt += Math.max(0, pin.score) * SALT_LB_PER_SCORE
    }
  }

  const minerals = extractClaimedMineralDeposits(metalNodes, (deposit) =>
    claimedIndices.has(deposit.y * gridWidth + deposit.x),
  )
  amounts.copper += minerals.copper
  amounts.silver += minerals.silver
  amounts.gold += minerals.gold
  amounts.diamonds += minerals.diamonds

  return { settlementId, amounts }
}
