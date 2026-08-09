import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveWorldGenerationOptions } from '../worldGenerationOptions.js'
import { simulateSeasonalHydrology } from './simulateSeasonalHydrology.js'
import {
  applyAnnualLargestLakeBankCrumble,
  findLowestBankOutlet,
  findLargestSeasonalLakeIds,
} from './lakeBankCrumble.js'

function makeTwoLakeScenario() {
  const width = 15
  const height = 15
  const elevation = new Float32Array(width * height).fill(0.95)

  const smallCells = []
  for (let y = 2; y <= 4; y += 1) {
    for (let x = 2; x <= 4; x += 1) {
      const idx = y * width + x
      elevation[idx] = 0.3
      smallCells.push(idx)
    }
  }
  elevation[3 * width + 1] = 0.75

  const largeCells = []
  for (let y = 6; y <= 10; y += 1) {
    for (let x = 5; x <= 11; x += 1) {
      const idx = y * width + x
      elevation[idx] = 0.28
      largeCells.push(idx)
    }
  }
  elevation[8 * width + 4] = 0.72
  elevation[8 * width + 12] = 0.41

  const lakeMask = new Uint8Array(width * height)
  const lakeIdByCell = new Int32Array(width * height).fill(-1)
  for (const idx of smallCells) {
    lakeMask[idx] = 1
    lakeIdByCell[idx] = 0
  }
  for (const idx of largeCells) {
    lakeMask[idx] = 1
    lakeIdByCell[idx] = 1
  }

  const lakes = [
    { id: 0, area: smallCells.length, endorheic: true },
    { id: 1, area: largeCells.length, endorheic: true },
  ]
  const lakeMeta = [
    {
      endorheic: true,
      surfaceElevation: 0.3,
      floorElevation: 0.3,
      spillElevation: 0.75,
      waterLevel: 0.3,
    },
    {
      endorheic: true,
      surfaceElevation: 0.28,
      floorElevation: 0.28,
      spillElevation: 0.72,
      waterLevel: 0.28,
    },
  ]

  const filledElevation = new Float32Array(elevation)
  for (const idx of smallCells) filledElevation[idx] = 0.3
  for (const idx of largeCells) filledElevation[idx] = 0.28

  return {
    width,
    height,
    elevation,
    filledElevation,
    rainfall: new Float32Array(width * height).fill(0.6),
    temperature: new Float32Array(width * height).fill(0.4),
    snowCapMask: new Uint8Array(width * height),
    lakeMask,
    lakes,
    lakeMeta,
    catchmentCellsByLake: [smallCells, largeCells],
    lakeIdByCell,
    ocean: Array.from({ length: width * height }, () => false),
  }
}

test('findLargestSeasonalLakeIds prefers the largest lakes without outlets', () => {
  const scenario = makeTwoLakeScenario()
  assert.deepEqual(
    findLargestSeasonalLakeIds(scenario.lakes, scenario.lakeMeta, 2),
    [1, 0],
  )
})

test('findLowestBankOutlet picks the lowest exterior rim cell', () => {
  const scenario = makeTwoLakeScenario()
  const { outletIdx, outletElev } = findLowestBankOutlet(
    1,
    scenario.lakeIdByCell,
    scenario.lakeMask,
    scenario.elevation,
    scenario.width,
    scenario.height,
  )

  assert.ok(Math.abs(outletElev - 0.41) < 0.001)
  assert.equal(outletIdx, 8 * scenario.width + 12)
})

test('applyAnnualLargestLakeBankCrumble opens the largest lake at its lowest bank', () => {
  const scenario = makeTwoLakeScenario()
  const lakes = scenario.lakes.map((lake) => ({ ...lake }))
  const lakeMeta = scenario.lakeMeta.map((meta) => ({ ...meta }))
  const workingElevation = new Float32Array(scenario.filledElevation)
  const effectiveRunoff = new Float32Array(scenario.width * scenario.height)
  const waterLevelByLake = new Float64Array([0.3, 0.28])
  const overflowLakeIds = new Set()

  const crumbled = applyAnnualLargestLakeBankCrumble({
    lakes,
    lakeMeta,
    lakeIdByCell: scenario.lakeIdByCell,
    lakeMask: scenario.lakeMask,
    elevation: scenario.elevation,
    workingElevation,
    effectiveRunoff,
    waterLevelByLake,
    overflowLakeIds,
    width: scenario.width,
    height: scenario.height,
    runoffToDepth: 0.0004,
  })

  assert.equal(crumbled, 1)
  assert.equal(overflowLakeIds.has(1), true)
  assert.ok(Math.abs(lakeMeta[1].spillElevation - 0.41) < 0.001)
  assert.equal(lakeMeta[1].overflowOutletIdx, 8 * scenario.width + 12)
})

test('simulateSeasonalHydrology crumbles the largest lake again when it stays largest', () => {
  const scenario = makeTwoLakeScenario()
  const options = resolveWorldGenerationOptions({
    seasonalYearCount: 2,
    lakeBankCrumblePerYear: 1,
    wetRainMult: 0.6,
    dryRainMult: 0.1,
    lakeEvaporationScale: 0.5,
  })

  const result = simulateSeasonalHydrology({
    ...scenario,
    lakes: scenario.lakes.map((lake) => ({ ...lake })),
    lakeMeta: scenario.lakeMeta.map((meta) => ({ ...meta })),
    soilDrainage: new Float32Array(scenario.width * scenario.height).fill(0.4),
    geographySeed: 42,
    options,
  })

  assert.equal(result.seasonalStats.bankCrumbleCount, 2)
  assert.deepEqual(result.lakeMeta[1].bankCrumbleOutletIdxs, [
    8 * scenario.width + 12,
    8 * scenario.width + 4,
  ])
  assert.equal(result.lakeMeta[0].overflowOutletIdx, undefined)
})

test('applyAnnualLargestLakeBankCrumble crumbles the n largest lakes when crumbleCount > 1', () => {
  const scenario = makeTwoLakeScenario()
  const lakes = scenario.lakes.map((lake) => ({ ...lake }))
  const lakeMeta = scenario.lakeMeta.map((meta) => ({ ...meta }))
  const workingElevation = new Float32Array(scenario.filledElevation)
  const effectiveRunoff = new Float32Array(scenario.width * scenario.height)
  const waterLevelByLake = new Float64Array([0.3, 0.28])
  const overflowLakeIds = new Set()

  const crumbled = applyAnnualLargestLakeBankCrumble({
    lakes,
    lakeMeta,
    lakeIdByCell: scenario.lakeIdByCell,
    lakeMask: scenario.lakeMask,
    elevation: scenario.elevation,
    workingElevation,
    effectiveRunoff,
    waterLevelByLake,
    overflowLakeIds,
    width: scenario.width,
    height: scenario.height,
    runoffToDepth: 0.0004,
    crumbleCount: 2,
  })

  assert.equal(crumbled, 2)
  assert.equal(overflowLakeIds.size, 2)
  assert.deepEqual(lakeMeta[1].bankCrumbleOutletIdxs, [8 * scenario.width + 12])
  assert.deepEqual(lakeMeta[0].bankCrumbleOutletIdxs, [3 * scenario.width + 1])
})

test('applyAnnualLargestLakeBankCrumble opens the next bank on a repeat year', () => {
  const scenario = makeTwoLakeScenario()
  const lakes = scenario.lakes.map((lake) => ({ ...lake }))
  const lakeMeta = scenario.lakeMeta.map((meta) => ({ ...meta }))
  const workingElevation = new Float32Array(scenario.filledElevation)
  const effectiveRunoff = new Float32Array(scenario.width * scenario.height)
  const waterLevelByLake = new Float64Array([0.3, 0.28])
  const overflowLakeIds = new Set()
  const common = {
    lakes,
    lakeMeta,
    lakeIdByCell: scenario.lakeIdByCell,
    lakeMask: scenario.lakeMask,
    elevation: scenario.elevation,
    workingElevation,
    effectiveRunoff,
    waterLevelByLake,
    overflowLakeIds,
    width: scenario.width,
    height: scenario.height,
    runoffToDepth: 0.0004,
    crumbleCount: 1,
  }

  assert.equal(applyAnnualLargestLakeBankCrumble(common), 1)
  assert.equal(applyAnnualLargestLakeBankCrumble(common), 1)
  assert.deepEqual(lakeMeta[1].bankCrumbleOutletIdxs, [
    8 * scenario.width + 12,
    8 * scenario.width + 4,
  ])
})
