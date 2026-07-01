import assert from 'node:assert/strict'
import test from 'node:test'
import { generateDerivedGeography } from '../generateDerivedGeography.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../../core/worldGenerationOptions.js'
import {
  createInitialPipelineState,
  runPipelineStep,
} from '../derivedGeographyPipeline.js'
import { runHydrologySubsteps } from './hydrologySubsteps.js'
import { HYDROLOGY_SUBSTEP_CONTRACTS } from './hydrologySubstepContracts.js'
import {
  fallbackCorridorLine,
  fractalCorridorDepthForSpan,
  routeFractalCorridorPath,
} from './riverPathfinding.js'
import {
  RIVER_MASK_SKIP_REFINE_TRANSITION,
  riverMaskContractKey,
} from './riverMaskLifecycle.js'

/**
 * @param {number} seed
 * @returns {() => number}
 */
function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

/**
 * @param {number} width
 * @param {number} height
 */
function flatRouterTerrain(width, height) {
  return {
    elevation: new Float32Array(width * height).fill(0.5),
    ocean: new Array(width * height).fill(false),
  }
}

test('routeFractalCorridorPath connects endpoints for the legacy attraction profile', () => {
  const width = 24
  const height = 24
  const { elevation, ocean } = flatRouterTerrain(width, height)
  const toIdx = (height - 1) * width + (width - 1)

  const path = routeFractalCorridorPath({
    fromIdx: 0,
    toIdx,
    elevation,
    ocean,
    width,
    height,
    random: seededRandom(7),
    profile: 'legacyAttraction',
  })

  assert.ok(Array.isArray(path) && path.length > 2)
  assert.strictEqual(path[0], 0)
  assert.strictEqual(path.at(-1), toIdx)
})

test('routeFractalCorridorPath connects endpoints for the meander refine profile', () => {
  const width = 24
  const height = 24
  const { elevation, ocean } = flatRouterTerrain(width, height)
  const toIdx = (height - 1) * width + (width - 1)

  const path = routeFractalCorridorPath({
    fromIdx: 0,
    toIdx,
    elevation,
    ocean,
    width,
    height,
    random: seededRandom(7),
    profile: 'meanderRefine',
  })

  assert.ok(Array.isArray(path) && path.length > 2)
  assert.strictEqual(path[0], 0)
  assert.strictEqual(path.at(-1), toIdx)
})

test('routeFractalCorridorPath is deterministic for a fixed random stream', () => {
  const width = 20
  const height = 20
  const { elevation, ocean } = flatRouterTerrain(width, height)
  const toIdx = (height - 1) * width + (width - 1)

  const args = (random) => ({
    fromIdx: 0,
    toIdx,
    elevation,
    ocean,
    width,
    height,
    random,
    profile: /** @type {'legacyAttraction'} */ ('legacyAttraction'),
  })

  assert.deepStrictEqual(
    routeFractalCorridorPath(args(seededRandom(42))),
    routeFractalCorridorPath(args(seededRandom(42))),
  )
})

test('fractal corridor depth profiles diverge between attraction and meander routing', () => {
  assert.notStrictEqual(
    fractalCorridorDepthForSpan(40, 'legacyAttraction'),
    fractalCorridorDepthForSpan(40, 'meanderRefine'),
  )
})

test('fallbackCorridorLine produces a contiguous straight corridor between endpoints', () => {
  const width = 10
  const line = fallbackCorridorLine(0, 4 * width + 4, width)

  assert.strictEqual(line[0], 0)
  assert.strictEqual(line.at(-1), 4 * width + 4)
  for (let i = 1; i < line.length; i += 1) {
    const prev = { x: line[i - 1] % width, y: Math.floor(line[i - 1] / width) }
    const next = { x: line[i] % width, y: Math.floor(line[i] / width) }
    assert.ok(Math.abs(next.x - prev.x) <= 1 && Math.abs(next.y - prev.y) <= 1)
  }
})

test('hydrology substeps drive the river mask lifecycle through the shared pipeline', () => {
  let state = createInitialPipelineState({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 64,
    height: 64,
    options: { ...DEFAULT_WORLD_GENERATION_OPTIONS, enableMeanderRefine: false },
  })
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  /** @type {Map<string, Partial<Record<string, Uint8Array | null>>>} */
  const snapshots = new Map()
  /** @type {string[]} */
  const transitions = []
  runHydrologySubsteps(state, {
    onSubstepComplete({ substepId, maskLifecycle, transition }) {
      if (maskLifecycle) snapshots.set(substepId, maskLifecycle)
      if (transition) transitions.push(transition)
    },
  })

  assert.ok(snapshots.get('hydrologyRoute')?.sketch?.some((value) => value === 1))
  assert.ok(snapshots.get('hydrologyExtract')?.settled?.some((value) => value === 1))

  const refine = snapshots.get('hydrologyRefine')
  assert.equal(refine?.presentation, refine?.settled)

  assert.ok(snapshots.get('hydrologyPaint')?.painted?.some((value) => value === 1))
  assert.deepStrictEqual(transitions, [RIVER_MASK_SKIP_REFINE_TRANSITION])
})

test('hydrology substep contracts expose explicit river mask lifecycle stages', () => {
  assert.ok(
    HYDROLOGY_SUBSTEP_CONTRACTS.hydrologyRoute.outputKeys.includes(riverMaskContractKey('sketch')),
  )
  assert.ok(
    HYDROLOGY_SUBSTEP_CONTRACTS.hydrologyIncise.outputKeys.includes(riverMaskContractKey('incised')),
  )
  assert.strictEqual(riverMaskContractKey('sketch'), 'riverMask.sketch')
  assert.strictEqual(riverMaskContractKey('incised'), 'riverMask.incised')
  assert.strictEqual(RIVER_MASK_SKIP_REFINE_TRANSITION, 'skipRefine')
})

test('issue #345 Option A defaults keep legacy presentation heuristics off', () => {
  assert.strictEqual(DEFAULT_WORLD_GENERATION_OPTIONS.riverAttractionRadiusScale, 0)
  assert.strictEqual(DEFAULT_WORLD_GENERATION_OPTIONS.enableMeanderRefine, false)
})

test('default generation exports simulation centerline and presentation corridor mask', () => {
  const width = 64
  const height = 64
  const doc = generateDerivedGeography({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width,
    height,
  })

  assert.ok(doc.simulationRiverMask)
  assert.strictEqual(doc.simulationRiverMask.length, width * height)
  const simulationCenterlineCount = doc.simulationRiverMask.reduce((sum, value) => sum + value, 0)
  assert.ok(
    simulationCenterlineCount > 0,
    'default generation should populate simulationRiverMask for logistics consumers',
  )

  assert.ok(doc.riverNetworkMask)
  assert.ok(doc.riverCorridorMask)

  const presentationCenterlineCount = doc.riverNetworkMask.reduce((sum, value) => sum + value, 0)
  const corridorCount = doc.riverCorridorMask.reduce((sum, value) => sum + value, 0)

  assert.ok(
    presentationCenterlineCount > 0,
    'default generation should produce presentation centerline cells',
  )
  assert.ok(
    corridorCount >= presentationCenterlineCount,
    'presentation corridor should cover at least the centerline',
  )
  assert.notStrictEqual(doc.riverCorridorMask, doc.riverNetworkMask)

  // Option A defaults skip meander refine; bytes may match, but validation/logistics must bind simulationRiverMask.
  assert.deepStrictEqual(doc.simulationRiverMask, doc.riverNetworkMask)
})
