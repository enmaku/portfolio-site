import {
  claimedCellsHaveFreshwater,
  deriveFreshwaterAvailabilityFromDocument,
} from './freshwater/deriveFreshwaterAvailability.js'
import { settlementTierFromPopulation } from './settlementTierFromPopulation.js'

/** People supported per unit of arable productivity (implementation tuning). */
export const PEOPLE_PER_ARABLE_UNIT = 100
/** People supported per unit of timber productivity when timber binds (implementation tuning). */
export const PEOPLE_PER_TIMBER_UNIT = 80

/** @type {Readonly<Record<string, number>>} */
export const YIELD_MODIFIER_MULTIPLIERS = Object.freeze({
  marginal: 0.7,
  typical: 1,
  bountiful: 1.3,
})

/**
 * @typedef {Object} SurvivalTriadResult
 * @property {number} foodProduction
 * @property {number} timberSum
 * @property {boolean} hasFreshwater
 * @property {number} populationCeiling
 * @property {number} foodConsumption
 * @property {number} foodSurplus
 * @property {number} population
 * @property {string | null} tier
 * @property {boolean} canSustain
 */

/**
 * @param {string} yieldModifier
 * @returns {number}
 */
export function yieldModifierMultiplier(yieldModifier) {
  return YIELD_MODIFIER_MULTIPLIERS[yieldModifier] ?? YIELD_MODIFIER_MULTIPLIERS.typical
}

/**
 * @param {Float32Array | null | undefined} raster
 * @param {ReadonlyArray<{ x: number, y: number }>} cells
 * @param {number} gridWidth
 * @returns {number}
 */
export function sumRasterOnCells(raster, cells, gridWidth) {
  if (!raster) return 0
  let sum = 0
  for (const cell of cells) {
    const index = cell.y * gridWidth + cell.x
    const value = raster[index]
    if (Number.isFinite(value) && value > 0) {
      sum += value
    }
  }
  return sum
}

/**
 * @param {{
 *   claimedCells: ReadonlyArray<{ x: number, y: number }>,
 *   gridWidth: number,
 *   arableRaster?: Float32Array | null,
 *   timberRaster?: Float32Array | null,
 *   yieldModifier: string,
 *   freshwaterClassification: Uint8Array | null,
 *   population: number,
 *   saltSpoilageMultiplier?: number,
 * }} params
 * @returns {SurvivalTriadResult}
 */
export function resolveSurvivalTriad(params) {
  const {
    claimedCells,
    gridWidth,
    arableRaster,
    timberRaster,
    yieldModifier,
    freshwaterClassification,
    population,
    saltSpoilageMultiplier = 1,
  } = params

  const yieldMult = yieldModifierMultiplier(yieldModifier)
  const arableSum = sumRasterOnCells(arableRaster, claimedCells, gridWidth)
  const foodProduction = arableSum * yieldMult
  const timberSum = sumRasterOnCells(timberRaster, claimedCells, gridWidth)

  const hasFreshwater =
    freshwaterClassification != null &&
    claimedCellsHaveFreshwater(freshwaterClassification, claimedCells, gridWidth)

  const foodCap = Math.floor(foodProduction * PEOPLE_PER_ARABLE_UNIT)
  const timberCap = Math.floor(timberSum * PEOPLE_PER_TIMBER_UNIT)
  let populationCeiling = Math.min(foodCap, timberCap)
  if (!hasFreshwater) {
    populationCeiling = 0
  }

  const canSustain = hasFreshwater && populationCeiling > 0
  const clampedPopulation = Math.max(0, Math.min(Math.floor(population), populationCeiling))
  const effectiveFoodCapacity =
    foodProduction * PEOPLE_PER_ARABLE_UNIT * clampSpoilage(saltSpoilageMultiplier)
  const foodConsumption = clampedPopulation
  const foodSurplus = effectiveFoodCapacity - foodConsumption

  return {
    foodProduction,
    timberSum,
    hasFreshwater,
    populationCeiling,
    foodConsumption,
    foodSurplus,
    population: clampedPopulation,
    tier: settlementTierFromPopulation(clampedPopulation),
    canSustain,
  }
}

/**
 * Apply one survival triad resolve to a living settlement using claim cells.
 *
 * @param {{
 *   settlement: { id: string, x: number, y: number, population: number, status?: string },
 *   claimedCells: ReadonlyArray<{ x: number, y: number }>,
 *   colonistSettings: { yieldModifier: string },
 *   worldDocument: import('../types.js').WorldDocument,
 *   saltSpoilageMultiplier?: number,
 * }} params
 * @returns {{ settlement: object, survival: SurvivalTriadResult }}
 */
export function applySurvivalResolveToSettlement(params) {
  const { settlement, claimedCells, colonistSettings, worldDocument, saltSpoilageMultiplier } =
    params
  const freshwaterClassification = deriveFreshwaterAvailabilityFromDocument(worldDocument)
  const survival = resolveSurvivalTriad({
    claimedCells,
    gridWidth: worldDocument.gridWidth,
    arableRaster: worldDocument.arableRaster,
    timberRaster: worldDocument.timberRaster,
    yieldModifier: colonistSettings.yieldModifier,
    freshwaterClassification,
    population: settlement.population,
    saltSpoilageMultiplier,
  })

  return {
    settlement: {
      ...settlement,
      population: survival.population,
      tier: survival.tier,
    },
    survival,
  }
}

/**
 * @param {number} multiplier
 * @returns {number}
 */
function clampSpoilage(multiplier) {
  if (!Number.isFinite(multiplier)) return 1
  return Math.max(0, Math.min(1, multiplier))
}
