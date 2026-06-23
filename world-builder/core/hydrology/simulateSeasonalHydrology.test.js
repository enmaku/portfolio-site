import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveWorldGenerationOptions } from '../worldGenerationOptions.js'
import { simulateSeasonalHydrology } from './simulateSeasonalHydrology.js'

function makeClosedBasinScenario(includeUphill = true) {
  const width = 9
  const height = 9
  const elevation = new Float32Array(width * height).fill(0.9)
  for (let y = 2; y <= 6; y += 1) {
    for (let x = 2; x <= 6; x += 1) {
      elevation[y * width + x] = 0.25
    }
  }
  elevation[4 * width + 1] = 0.82

  const lakeMask = new Uint8Array(width * height)
  for (let y = 2; y <= 6; y += 1) {
    for (let x = 2; x <= 6; x += 1) {
      lakeMask[y * width + x] = 1
    }
  }

  const lakeIdByCell = new Int32Array(width * height).fill(-1)
  const basinCells = []
  for (let idx = 0; idx < lakeMask.length; idx += 1) {
    if (lakeMask[idx]) {
      lakeIdByCell[idx] = 0
      basinCells.push(idx)
    }
  }

  const uphillCells = []
  if (includeUphill) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x
        if (!lakeMask[idx] && elevation[idx] < 0.89) {
          uphillCells.push(idx)
        }
      }
    }
  }
  const catchmentCellsByLake = [[...new Set([...basinCells, ...uphillCells])]]
  const lakes = [{ id: 0, area: basinCells.length, endorheic: true }]
  const lakeMeta = [{
    endorheic: true,
    surfaceElevation: 0.25,
    floorElevation: 0.25,
    spillElevation: 0.82,
    waterLevel: 0.25,
  }]

  const filledElevation = new Float32Array(elevation)
  for (const idx of basinCells) {
    filledElevation[idx] = 0.25
  }

  return {
    width,
    height,
    elevation,
    filledElevation,
    rainfall: new Float32Array(width * height).fill(0.7),
    temperature: new Float32Array(width * height).fill(0.4),
    snowCapMask: new Uint8Array(width * height),
    lakeMask,
    lakes,
    lakeMeta,
    catchmentCellsByLake,
    lakeIdByCell,
    ocean: Array.from({ length: width * height }, () => false),
  }
}

test('simulateSeasonalHydrology can overtop a closed basin under heavy wet years', () => {
  const scenario = makeClosedBasinScenario()
  const options = resolveWorldGenerationOptions({
    seasonalYearCount: 8,
    lakeBankCrumblePerYear: 0,
    wetRainMult: 3,
    yearlyClimateNoiseScale: 0.5,
    lakeEvaporationScale: 0.2,
  })

  const result = simulateSeasonalHydrology({
    ...scenario,
    soilDrainage: new Float32Array(scenario.width * scenario.height).fill(0.2),
    geographySeed: 901,
    options,
  })

  assert.ok(result.effectiveRunoff.some((value) => value > 0))
  assert.ok(result.lakeMeta[0].waterLevel >= scenario.lakeMeta[0].floorElevation)
})

test('simulateSeasonalHydrology never raises lake surface above spill elevation', () => {
  const scenario = makeClosedBasinScenario()
  const options = resolveWorldGenerationOptions({
    seasonalYearCount: 8,
    lakeBankCrumblePerYear: 0,
    wetRainMult: 3,
    yearlyClimateNoiseScale: 0.5,
    lakeEvaporationScale: 0.2,
  })

  const result = simulateSeasonalHydrology({
    ...scenario,
    soilDrainage: new Float32Array(scenario.width * scenario.height).fill(0.2),
    geographySeed: 901,
    options,
  })

  for (const meta of result.lakeMeta) {
    const spill = meta.spillElevation ?? meta.surfaceElevation
    const waterLevel = meta.waterLevel ?? meta.surfaceElevation
    assert.ok(waterLevel <= spill + 0.01)
  }

  for (let idx = 0; idx < scenario.lakeIdByCell.length; idx += 1) {
    if (scenario.lakeIdByCell[idx] < 0) continue
    const spill = scenario.lakeMeta[scenario.lakeIdByCell[idx]].spillElevation
    assert.ok(result.filledElevation[idx] <= spill + 0.01)
  }
})

test('simulateSeasonalHydrology dry evaporation can keep endorheic lakes below spill', () => {
  const scenario = makeClosedBasinScenario(false)
  const options = resolveWorldGenerationOptions({
    seasonalYearCount: 2,
    lakeBankCrumblePerYear: 0,
    wetRainMult: 0.6,
    dryRainMult: 0.05,
    lakeEvaporationScale: 2.5,
  })

  const result = simulateSeasonalHydrology({
    ...scenario,
    soilDrainage: new Float32Array(scenario.width * scenario.height).fill(0.5),
    geographySeed: 17,
    options,
  })

  assert.equal(result.overflowLakeIds.size, 0)
  assert.ok(result.lakeMeta[0].waterLevel <= scenario.lakeMeta[0].spillElevation + 0.01)
})
