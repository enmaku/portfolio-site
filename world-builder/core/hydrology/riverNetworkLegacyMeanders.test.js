import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'
import {
  RIVER_LEGACY_MEANDER_STAGES,
  applyRefineStageMeanderPresentation,
  applyRouteStageCorridorAttraction,
  isCorridorAttractionEnabled,
  isMeanderRefineEnabled,
} from './riverNetworkLegacyMeanders.js'

test('RIVER_LEGACY_MEANDER_STAGES maps heuristics to hydrology substeps', () => {
  assert.strictEqual(RIVER_LEGACY_MEANDER_STAGES.corridorAttraction.substepId, 'hydrologyRoute')
  assert.strictEqual(RIVER_LEGACY_MEANDER_STAGES.meanderRefine.substepId, 'hydrologyRefine')
})

test('isCorridorAttractionEnabled is false when radius scale is zero', () => {
  assert.equal(isCorridorAttractionEnabled(64, 0), false)
  assert.equal(isCorridorAttractionEnabled(64, 6), true)
})

test('isMeanderRefineEnabled follows enableMeanderRefine option', () => {
  assert.equal(isMeanderRefineEnabled(DEFAULT_WORLD_GENERATION_OPTIONS), false)
  assert.equal(
    isMeanderRefineEnabled({ ...DEFAULT_WORLD_GENERATION_OPTIONS, enableMeanderRefine: false }),
    false,
  )
  assert.equal(
    isMeanderRefineEnabled({ ...DEFAULT_WORLD_GENERATION_OPTIONS, enableMeanderRefine: true }),
    true,
  )
})

test('DEFAULT_WORLD_GENERATION_OPTIONS disables corridor attraction (Option A)', () => {
  assert.equal(
    isCorridorAttractionEnabled(64, DEFAULT_WORLD_GENERATION_OPTIONS.riverAttractionRadiusScale),
    false,
  )
})

test('applyRouteStageCorridorAttraction is a no-op when radius scale is zero', () => {
  const width = 6
  const height = 6
  const mask = new Uint8Array(width * height)
  mask[10] = 1
  const elevation = new Float32Array(width * height).fill(0.6)
  const ocean = new Array(width * height).fill(false)
  const flowDirection = new Int16Array(width * height).fill(-1)

  const result = applyRouteStageCorridorAttraction({
    baseRiverNetworkMask: mask,
    elevation,
    ocean,
    width,
    height,
    geographySeed: 1,
    flowDirection,
    riverAttractionRadiusScale: 0,
  })

  assert.equal(result, mask)
})

test('applyRefineStageMeanderPresentation returns empty mask for empty sketch', () => {
  const width = 8
  const height = 8
  const cellCount = width * height
  const sketchMask = new Uint8Array(cellCount)
  const elevation = new Float32Array(cellCount).fill(0.6)
  const ocean = new Array(cellCount).fill(false)
  const flowDirection = new Int16Array(cellCount).fill(-1)
  const flowAccumulation = new Float32Array(cellCount)
  const lakeMask = new Uint8Array(cellCount)

  const result = applyRefineStageMeanderPresentation({
    sketchMask,
    elevation,
    ocean,
    flowDirection,
    flowAccumulation,
    lakeMask,
    width,
    height,
    geographySeed: 1,
    options: {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enableMeanderRefine: true,
      riverSettlementSteps: 0,
    },
  })

  assert.ok(result.riverNetworkMask.every((value) => value === 0))
})
