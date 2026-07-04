import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import {
  PEOPLE_PER_ARABLE_UNIT,
  PEOPLE_PER_TIMBER_UNIT,
  applySurvivalResolveToSettlement,
  resolveSurvivalTriad,
  sumRasterOnCells,
} from './resolveSurvivalTriad.js'
import {
  FRESHWATER_NONE,
  FRESHWATER_SURFACE,
  FRESHWATER_WELL_VIABLE,
} from './freshwater/deriveFreshwaterAvailability.js'

/**
 * @param {Partial<{
 *   claimedCells: Array<{ x: number, y: number }>,
 *   arable: number[],
 *   timber: number[],
 *   freshwater: number[],
 *   yieldModifier: string,
 *   population: number,
 *   saltSpoilageMultiplier: number,
 * }>} overrides
 */
function triadParams(overrides = {}) {
  const gridWidth = 3
  const claimedCells = overrides.claimedCells ?? [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]
  return {
    claimedCells,
    gridWidth,
    arableRaster: Float32Array.from(overrides.arable ?? [1, 1, 0]),
    timberRaster: Float32Array.from(overrides.timber ?? [1, 1, 0]),
    yieldModifier: overrides.yieldModifier ?? 'typical',
    freshwaterClassification: Uint8Array.from(
      overrides.freshwater ?? [FRESHWATER_SURFACE, FRESHWATER_NONE, FRESHWATER_NONE],
    ),
    population: overrides.population ?? 50,
    saltSpoilageMultiplier: overrides.saltSpoilageMultiplier ?? 1,
  }
}

test('sumRasterOnCells sums only claimed cells', () => {
  const raster = Float32Array.from([2, 3, 4])
  assert.strictEqual(sumRasterOnCells(raster, [{ x: 0, y: 0 }, { x: 2, y: 0 }], 3), 6)
})

test('resolveSurvivalTriad food production equals arable sum times yield modifier', () => {
  const result = resolveSurvivalTriad(triadParams({ arable: [2, 1, 0], yieldModifier: 'typical' }))
  assert.strictEqual(result.foodProduction, 3)
  assert.strictEqual(result.populationCeiling, Math.min(3 * PEOPLE_PER_ARABLE_UNIT, 2 * PEOPLE_PER_TIMBER_UNIT))
})

test('resolveSurvivalTriad applies yield modifier to food production and ceiling input', () => {
  const typical = resolveSurvivalTriad(
    triadParams({ arable: [2, 0, 0], timber: [10, 0, 0], yieldModifier: 'typical' }),
  )
  const bountiful = resolveSurvivalTriad(
    triadParams({ arable: [2, 0, 0], timber: [10, 0, 0], yieldModifier: 'bountiful' }),
  )
  assert.ok(bountiful.foodProduction > typical.foodProduction)
  assert.ok(bountiful.populationCeiling > typical.populationCeiling)
})

test('resolveSurvivalTriad freshwater gate uses shared classification', () => {
  const watered = resolveSurvivalTriad(
    triadParams({ freshwater: [FRESHWATER_WELL_VIABLE, FRESHWATER_NONE, FRESHWATER_NONE] }),
  )
  const dry = resolveSurvivalTriad(
    triadParams({ freshwater: [FRESHWATER_NONE, FRESHWATER_NONE, FRESHWATER_NONE] }),
  )
  assert.strictEqual(watered.hasFreshwater, true)
  assert.strictEqual(dry.hasFreshwater, false)
  assert.strictEqual(dry.populationCeiling, 0)
  assert.strictEqual(dry.canSustain, false)
  assert.strictEqual(dry.population, 0)
})

test('resolveSurvivalTriad timber scarcity binds ceiling below food', () => {
  const result = resolveSurvivalTriad(
    triadParams({
      arable: [10, 10, 0],
      timber: [0.1, 0, 0],
      population: 1000,
    }),
  )
  const foodCap = 20 * PEOPLE_PER_ARABLE_UNIT
  const timberCap = 0.1 * PEOPLE_PER_TIMBER_UNIT
  assert.ok(timberCap < foodCap)
  assert.strictEqual(result.populationCeiling, Math.floor(timberCap))
  assert.strictEqual(result.population, Math.floor(timberCap))
})

test('resolveSurvivalTriad clamps starting population and sets tier from absolute bands', () => {
  const result = resolveSurvivalTriad(
    triadParams({ population: 10_000, arable: [0.2, 0, 0], timber: [0.2, 0, 0] }),
  )
  assert.ok(result.population <= result.populationCeiling)
  assert.ok(result.population < 10_000)
  assert.strictEqual(result.tier, 'outpost')
  assert.ok(result.population >= 1)
})

test('resolveSurvivalTriad is deterministic for identical inputs', () => {
  const a = resolveSurvivalTriad(triadParams({ population: 80 }))
  const b = resolveSurvivalTriad(triadParams({ population: 80 }))
  assert.deepStrictEqual(a, b)
})

test('applySurvivalResolveToSettlement uses document rasters and freshwater derive', () => {
  const cellCount = 4
  const worldDocument = {
    gridWidth: 2,
    gridHeight: 2,
    arableRaster: Float32Array.from([1, 1, 0, 0]),
    timberRaster: Float32Array.from([1, 1, 0, 0]),
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.6),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array([BIOMES.GRASSLAND, BIOMES.GRASSLAND, BIOMES.GRASSLAND, BIOMES.GRASSLAND]),
    riverCorridorMask: Uint8Array.from([1, 0, 0, 0]),
    lakeMask: new Uint8Array(cellCount),
  }

  const { settlement, survival } = applySurvivalResolveToSettlement({
    settlement: { id: 's1', x: 0, y: 0, population: 500, status: 'living' },
    claimedCells: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    colonistSettings: { yieldModifier: 'typical' },
    worldDocument,
  })

  assert.strictEqual(survival.hasFreshwater, true)
  assert.ok(settlement.population <= survival.populationCeiling)
  assert.ok(settlement.tier != null)
})
