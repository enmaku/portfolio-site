import { SEA_LEVEL } from '../biomeIds.js'
import { FOOD_LB_PER_PERSON, SALT_LB_PER_PERSON } from '../economy/tradeClearing/allocationTiers.js'
import {
  DEFAULT_PEOPLE_PER_HABITABLE_CELL,
  DEFAULT_POPULATION_DENSITY,
} from './createDefaultColonizationSlice.js'
import { isHabitablePopulationCell } from './collapsePopulation.js'
import {
  claimedCellsHaveFreshwater,
  deriveFreshwaterAvailabilityFromDocument,
} from './freshwater/deriveFreshwaterAvailability.js'
import { sumFishProductionOnCells } from './fish/sumFishProductionOnCells.js'
import { MIN_SALT_SPOILAGE_MULTIPLIER } from './saltSpoilageMultiplier.js'
import { settlementTierFromPopulation } from './settlementTierFromPopulation.js'

/** People supported per unit of arable / fish productivity (implementation tuning). */
export const PEOPLE_PER_ARABLE_UNIT = 10

/** @type {Readonly<Record<string, number>>} */
export const YIELD_MODIFIER_MULTIPLIERS = Object.freeze({
  marginal: 0.7,
  typical: 1,
  bountiful: 1.3,
})

/**
 * @typedef {Object} SurvivalTriadResult
 * @property {number} cropProduction
 * @property {number} fishProduction
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
 * Count dry claimed cells that can host people (same filters as population collapse).
 *
 * @param {{
 *   claimedCells: ReadonlyArray<{ x: number, y: number }>,
 *   gridWidth: number,
 *   elevation?: Float32Array | null,
 *   lakeMask?: Uint8Array | null,
 *   riverCorridorMask?: Uint8Array | null,
 *   simulationRiverMask?: Uint8Array | null,
 *   biomes?: Uint8Array | null,
 *   seaLevel?: number,
 * }} params
 * @returns {number}
 */
export function countHabitableClaimCells(params) {
  const {
    claimedCells,
    gridWidth,
    elevation,
    lakeMask,
    riverCorridorMask,
    simulationRiverMask,
    biomes,
    seaLevel = SEA_LEVEL,
  } = params
  let count = 0
  for (const cell of claimedCells) {
    if (
      isHabitablePopulationCell({
        x: cell.x,
        y: cell.y,
        gridWidth,
        elevation,
        lakeMask,
        riverCorridorMask,
        simulationRiverMask,
        biomes,
        seaLevel,
      })
    ) {
      count += 1
    }
  }
  return count
}

/**
 * @param {{
 *   claimedCells: ReadonlyArray<{ x: number, y: number }>,
 *   gridWidth: number,
 *   gridHeight?: number,
 *   arableRaster?: Float32Array | null,
 *   timberRaster?: Float32Array | null,
 *   elevation?: Float32Array | null,
 *   lakeMask?: Uint8Array | null,
 *   riverCorridorMask?: Uint8Array | null,
 *   simulationRiverMask?: Uint8Array | null,
 *   biomes?: Uint8Array | null,
 *   seaLevel?: number,
 *   yieldModifier: string,
 *   freshwaterClassification: Uint8Array | null,
 *   population: number,
 *   peoplePerHabitableCell?: number,
 *   populationDensity?: number,
 *   saltSpoilageMultiplier?: number,
 *   deliveredFoodLb?: number,
 *   deliveredSaltLb?: number,
 * }} params
 * @returns {SurvivalTriadResult}
 */
export function resolveSurvivalTriad(params) {
  const {
    claimedCells,
    gridWidth,
    gridHeight = 0,
    arableRaster,
    timberRaster,
    elevation,
    lakeMask,
    riverCorridorMask,
    simulationRiverMask,
    biomes,
    seaLevel = SEA_LEVEL,
    yieldModifier,
    freshwaterClassification,
    population,
    peoplePerHabitableCell = DEFAULT_PEOPLE_PER_HABITABLE_CELL,
    populationDensity = DEFAULT_POPULATION_DENSITY,
    saltSpoilageMultiplier = 1,
    deliveredFoodLb,
    deliveredSaltLb = 0,
  } = params

  const yieldMult = yieldModifierMultiplier(yieldModifier)
  const densityScale = resolvePopulationDensityScale(populationDensity)
  const peoplePerArable = PEOPLE_PER_ARABLE_UNIT * densityScale
  const arableSum = sumRasterOnCells(arableRaster, claimedCells, gridWidth)
  const cropProduction = arableSum * yieldMult
  const resolvedHeight =
    gridHeight > 0
      ? gridHeight
      : elevation
        ? Math.floor(elevation.length / gridWidth)
        : 0
  const fishProduction =
    resolvedHeight > 0
      ? sumFishProductionOnCells({
          claimedCells,
          gridWidth,
          gridHeight: resolvedHeight,
          elevation,
          lakeMask,
          riverCorridorMask,
          seaLevel,
        })
      : 0
  const foodProduction = cropProduction + fishProduction
  const timberSum = sumRasterOnCells(timberRaster, claimedCells, gridWidth)

  const hasFreshwater =
    freshwaterClassification != null &&
    claimedCellsHaveFreshwater(freshwaterClassification, claimedCells, gridWidth)

  const tradeDelivered = deliveredFoodLb !== undefined
  const effectiveFoodCapacityUngated = tradeDelivered
    ? postTradeEffectiveFoodCapacity(deliveredFoodLb, deliveredSaltLb, population)
    : foodProduction * peoplePerArable
  const ceilingFoodCapacity = tradeDelivered
    ? effectiveFoodCapacityUngated
    : foodProduction * peoplePerArable

  const packingPerCell =
    Number.isFinite(peoplePerHabitableCell) && peoplePerHabitableCell > 0
      ? peoplePerHabitableCell
      : DEFAULT_PEOPLE_PER_HABITABLE_CELL
  const habitableCount = countHabitableClaimCells({
    claimedCells,
    gridWidth,
    elevation,
    lakeMask,
    riverCorridorMask,
    simulationRiverMask,
    biomes,
    seaLevel,
  })
  const landCeiling = Math.floor(habitableCount * packingPerCell * densityScale)
  const foodCeiling = Math.floor(ceilingFoodCapacity)

  let populationCeiling = Math.min(foodCeiling, landCeiling)
  if (!hasFreshwater) {
    populationCeiling = 0
  }

  const canSustain = hasFreshwater && populationCeiling > 0
  const clampedPopulation = Math.max(0, Math.min(Math.floor(population), populationCeiling))
  const effectiveFoodCapacity = tradeDelivered
    ? effectiveFoodCapacityUngated
    : foodProduction * peoplePerArable * clampSpoilage(saltSpoilageMultiplier)
  const foodConsumption = clampedPopulation
  const foodSurplus = effectiveFoodCapacity - foodConsumption

  return {
    cropProduction,
    fishProduction,
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
 * Post-trade effective food capacity in people-units: delivered food converted to
 * people, then scaled by salt preservation `0.35 + 0.65 × fulfillment`.
 *
 * @param {number} deliveredFoodLb Food held after trade (local + imports − exports).
 * @param {number} deliveredSaltLb Household salt held after trade (local + imports).
 * @param {number} population Demand basis for household salt fulfillment.
 * @returns {number}
 */
export function postTradeEffectiveFoodCapacity(deliveredFoodLb, deliveredSaltLb, population) {
  const foodPeople = Math.max(0, deliveredFoodLb) / FOOD_LB_PER_PERSON
  const saltDemandLb = SALT_LB_PER_PERSON * Math.max(0, population)
  const saltFulfillment =
    saltDemandLb > 0 ? Math.min(1, Math.max(0, deliveredSaltLb) / saltDemandLb) : 1
  const saltMultiplier =
    MIN_SALT_SPOILAGE_MULTIPLIER + (1 - MIN_SALT_SPOILAGE_MULTIPLIER) * saltFulfillment
  return foodPeople * saltMultiplier
}

/**
 * Apply one survival triad resolve to a living settlement using claim cells.
 *
 * @param {{
 *   settlement: { id: string, x: number, y: number, population: number, status?: string },
 *   claimedCells: ReadonlyArray<{ x: number, y: number }>,
 *   colonistSettings: {
 *     yieldModifier: string,
 *     peoplePerHabitableCell?: number,
 *     populationDensity?: number,
 *   },
 *   worldDocument: import('../types.js').WorldDocument,
 *   saltSpoilageMultiplier?: number,
 *   deliveredFoodLb?: number,
 *   deliveredSaltLb?: number,
 * }} params
 * @returns {{ settlement: object, survival: SurvivalTriadResult }}
 */
export function applySurvivalResolveToSettlement(params) {
  const {
    settlement,
    claimedCells,
    colonistSettings,
    worldDocument,
    saltSpoilageMultiplier,
    deliveredFoodLb,
    deliveredSaltLb,
  } = params
  const freshwaterClassification = deriveFreshwaterAvailabilityFromDocument(worldDocument)
  const survival = resolveSurvivalTriad({
    claimedCells,
    gridWidth: worldDocument.gridWidth,
    gridHeight: worldDocument.gridHeight,
    arableRaster: worldDocument.arableRaster,
    timberRaster: worldDocument.timberRaster,
    elevation: worldDocument.fields?.elevation,
    lakeMask: worldDocument.lakeMask,
    riverCorridorMask: worldDocument.riverCorridorMask,
    simulationRiverMask: worldDocument.simulationRiverMask,
    biomes: worldDocument.biomes,
    yieldModifier: colonistSettings.yieldModifier,
    peoplePerHabitableCell: colonistSettings.peoplePerHabitableCell,
    populationDensity: colonistSettings.populationDensity,
    freshwaterClassification,
    population: settlement.population,
    saltSpoilageMultiplier,
    deliveredFoodLb,
    deliveredSaltLb,
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

/**
 * @param {number | undefined} populationDensity
 * @returns {number}
 */
function resolvePopulationDensityScale(populationDensity) {
  return Number.isFinite(populationDensity) && /** @type {number} */ (populationDensity) > 0
    ? /** @type {number} */ (populationDensity)
    : DEFAULT_POPULATION_DENSITY
}
