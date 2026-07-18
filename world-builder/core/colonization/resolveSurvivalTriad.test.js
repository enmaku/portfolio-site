import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES, SEA_LEVEL } from '../biomeIds.js'
import {
  PEOPLE_PER_ARABLE_UNIT,
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
 *   peoplePerHabitableCell: number,
 *   populationDensity: number,
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
    elevation: new Float32Array(3).fill(SEA_LEVEL + 0.1),
    lakeMask: new Uint8Array(3),
    riverCorridorMask: new Uint8Array(3),
    biomes: new Uint8Array([BIOMES.GRASSLAND, BIOMES.GRASSLAND, BIOMES.GRASSLAND]),
    yieldModifier: overrides.yieldModifier ?? 'typical',
    freshwaterClassification: Uint8Array.from(
      overrides.freshwater ?? [FRESHWATER_SURFACE, FRESHWATER_NONE, FRESHWATER_NONE],
    ),
    population: overrides.population ?? 50,
    // High default so food-ceiling tests are not accidentally land-bound.
    peoplePerHabitableCell: overrides.peoplePerHabitableCell ?? 100_000,
    populationDensity: overrides.populationDensity ?? 1,
    saltSpoilageMultiplier: overrides.saltSpoilageMultiplier ?? 1,
  }
}

test('sumRasterOnCells sums only claimed cells', () => {
  const raster = Float32Array.from([2, 3, 4])
  assert.strictEqual(sumRasterOnCells(raster, [{ x: 0, y: 0 }, { x: 2, y: 0 }], 3), 6)
})

test('resolveSurvivalTriad food production equals arable sum times yield modifier', () => {
  const result = resolveSurvivalTriad(triadParams({ arable: [2, 1, 0], yieldModifier: 'typical' }))
  assert.strictEqual(result.cropProduction, 3)
  assert.strictEqual(result.fishProduction, 0)
  assert.strictEqual(result.foodProduction, 3)
  assert.strictEqual(result.populationCeiling, 3 * PEOPLE_PER_ARABLE_UNIT)
})

test('resolveSurvivalTriad applies yield modifier to crop production only', () => {
  const typical = resolveSurvivalTriad(
    triadParams({ arable: [2, 0, 0], timber: [10, 0, 0], yieldModifier: 'typical' }),
  )
  const bountiful = resolveSurvivalTriad(
    triadParams({ arable: [2, 0, 0], timber: [10, 0, 0], yieldModifier: 'bountiful' }),
  )
  assert.ok(bountiful.cropProduction > typical.cropProduction)
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

test('resolveSurvivalTriad timber scarcity no longer binds the population ceiling', () => {
  const scarceTimber = resolveSurvivalTriad(
    triadParams({
      arable: [10, 10, 0],
      timber: [0.1, 0, 0],
      population: 1000,
    }),
  )
  const abundantTimber = resolveSurvivalTriad(
    triadParams({
      arable: [10, 10, 0],
      timber: [1000, 1000, 0],
      population: 1000,
    }),
  )
  const foodCap = 20 * PEOPLE_PER_ARABLE_UNIT
  assert.strictEqual(scarceTimber.populationCeiling, foodCap)
  assert.strictEqual(scarceTimber.populationCeiling, abundantTimber.populationCeiling)
  assert.strictEqual(scarceTimber.population, foodCap)
  assert.ok(scarceTimber.timberSum > 0)
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

test('resolveSurvivalTriad sustains zero-arable ocean shore claims from fish', () => {
  const elevation = Float32Array.from([
    SEA_LEVEL - 0.05,
    SEA_LEVEL + 0.1,
    SEA_LEVEL + 0.1,
    SEA_LEVEL + 0.1,
    SEA_LEVEL + 0.1,
    SEA_LEVEL + 0.1,
  ])
  const result = resolveSurvivalTriad({
    claimedCells: [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
    gridWidth: 3,
    gridHeight: 2,
    arableRaster: new Float32Array(6),
    timberRaster: Float32Array.from([1, 1, 1, 1, 1, 1]),
    elevation,
    lakeMask: new Uint8Array(6),
    riverCorridorMask: new Uint8Array(6),
    biomes: new Uint8Array(6).fill(BIOMES.GRASSLAND),
    yieldModifier: 'typical',
    peoplePerHabitableCell: 100_000,
    freshwaterClassification: Uint8Array.from([
      FRESHWATER_NONE,
      FRESHWATER_SURFACE,
      FRESHWATER_NONE,
      FRESHWATER_NONE,
      FRESHWATER_SURFACE,
      FRESHWATER_NONE,
    ]),
    population: 200,
  })
  assert.strictEqual(result.cropProduction, 0)
  assert.ok(result.fishProduction > 0)
  assert.strictEqual(result.foodProduction, result.fishProduction)
  assert.ok(result.populationCeiling > 0)
  assert.strictEqual(result.canSustain, true)
  assert.ok(result.population > 0)
})

test('resolveSurvivalTriad adds fish to crop food production', () => {
  const elevation = Float32Array.from([
    SEA_LEVEL - 0.05,
    SEA_LEVEL + 0.1,
    SEA_LEVEL + 0.1,
  ])
  const withFish = resolveSurvivalTriad({
    claimedCells: [{ x: 1, y: 0 }],
    gridWidth: 3,
    gridHeight: 1,
    arableRaster: Float32Array.from([0, 1, 0]),
    timberRaster: Float32Array.from([0, 10, 0]),
    elevation,
    lakeMask: new Uint8Array(3),
    riverCorridorMask: new Uint8Array(3),
    biomes: new Uint8Array(3).fill(BIOMES.GRASSLAND),
    yieldModifier: 'typical',
    peoplePerHabitableCell: 100_000,
    freshwaterClassification: Uint8Array.from([
      FRESHWATER_NONE,
      FRESHWATER_SURFACE,
      FRESHWATER_NONE,
    ]),
    population: 50,
  })
  const cropsOnly = resolveSurvivalTriad(
    triadParams({
      claimedCells: [{ x: 1, y: 0 }],
      arable: [0, 1, 0],
      timber: [0, 10, 0],
      freshwater: [FRESHWATER_NONE, FRESHWATER_SURFACE, FRESHWATER_NONE],
      population: 50,
    }),
  )
  assert.strictEqual(withFish.cropProduction, cropsOnly.cropProduction)
  assert.ok(withFish.fishProduction > 0)
  assert.strictEqual(withFish.foodProduction, cropsOnly.foodProduction + withFish.fishProduction)
})

test('resolveSurvivalTriad salt spoilage taxes total food including fish for surplus only', () => {
  const elevation = Float32Array.from([SEA_LEVEL - 0.05, SEA_LEVEL + 0.1])
  const base = {
    claimedCells: [{ x: 1, y: 0 }],
    gridWidth: 2,
    gridHeight: 1,
    arableRaster: Float32Array.from([0, 1]),
    timberRaster: Float32Array.from([0, 10]),
    elevation,
    lakeMask: new Uint8Array(2),
    riverCorridorMask: new Uint8Array(2),
    biomes: new Uint8Array(2).fill(BIOMES.GRASSLAND),
    yieldModifier: 'typical',
    peoplePerHabitableCell: 100_000,
    freshwaterClassification: Uint8Array.from([FRESHWATER_NONE, FRESHWATER_SURFACE]),
    population: 10,
  }
  const fullSalt = resolveSurvivalTriad({ ...base, saltSpoilageMultiplier: 1 })
  const weakSalt = resolveSurvivalTriad({ ...base, saltSpoilageMultiplier: 0.35 })
  assert.strictEqual(fullSalt.populationCeiling, weakSalt.populationCeiling)
  assert.ok(weakSalt.foodSurplus < fullSalt.foodSurplus)
})

test('resolveSurvivalTriad land ceiling binds below food on tiny claims', () => {
  const result = resolveSurvivalTriad(
    triadParams({
      claimedCells: [{ x: 0, y: 0 }],
      arable: [50, 0, 0],
      timber: [1, 0, 0],
      peoplePerHabitableCell: 100,
      population: 10_000,
    }),
  )
  assert.strictEqual(result.foodProduction, 50)
  assert.ok(50 * PEOPLE_PER_ARABLE_UNIT > 100)
  assert.strictEqual(result.populationCeiling, 100)
  assert.strictEqual(result.population, 100)
})

test('resolveSurvivalTriad food ceiling still binds when land is ample', () => {
  const ampleLand = resolveSurvivalTriad(
    triadParams({
      claimedCells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      arable: [1, 0, 0],
      timber: [1, 0, 0],
      freshwater: [FRESHWATER_SURFACE, FRESHWATER_NONE, FRESHWATER_NONE],
      peoplePerHabitableCell: 100,
      population: 10_000,
    }),
  )
  // Three habitable cells × 100 = 300; food = 1 × 100 = 100 → food binds.
  assert.strictEqual(ampleLand.foodProduction, 1)
  assert.strictEqual(ampleLand.populationCeiling, PEOPLE_PER_ARABLE_UNIT)
})

test('resolveSurvivalTriad population density scales food and land ceilings', () => {
  const landBound = resolveSurvivalTriad(
    triadParams({
      claimedCells: [{ x: 0, y: 0 }],
      arable: [50, 0, 0],
      peoplePerHabitableCell: 40,
      populationDensity: 1,
      population: 10_000,
    }),
  )
  const landBoundDense = resolveSurvivalTriad(
    triadParams({
      claimedCells: [{ x: 0, y: 0 }],
      arable: [50, 0, 0],
      peoplePerHabitableCell: 40,
      populationDensity: 2,
      population: 10_000,
    }),
  )
  assert.strictEqual(landBound.populationCeiling, 40)
  assert.strictEqual(landBoundDense.populationCeiling, 80)

  const foodBound = resolveSurvivalTriad(
    triadParams({
      claimedCells: [{ x: 0, y: 0 }],
      arable: [2, 0, 0],
      peoplePerHabitableCell: 100_000,
      populationDensity: 1.5,
      population: 10_000,
    }),
  )
  assert.strictEqual(foodBound.populationCeiling, Math.floor(2 * PEOPLE_PER_ARABLE_UNIT * 1.5))
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
    colonistSettings: { yieldModifier: 'typical', peoplePerHabitableCell: 100 },
    worldDocument,
  })

  assert.strictEqual(survival.hasFreshwater, true)
  assert.ok(survival.fishProduction > 0)
  assert.ok(settlement.population <= survival.populationCeiling)
  assert.ok(settlement.tier != null)
})
