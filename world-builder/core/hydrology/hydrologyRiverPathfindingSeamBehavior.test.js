import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInitialPipelineState,
  runPipelineStep,
} from '../derivedGeographyPipeline.js'
import { generateDerivedGeography } from '../generateDerivedGeography.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'
import { DEFAULT_GEOGRAPHY_SEED } from '../../core/worldGenerationOptions.js'
import { runHydrologySubsteps } from './hydrologySubsteps.js'
import { HYDROLOGY_SUBSTEP_CONTRACTS } from './hydrologySubstepContracts.js'
import {
  RIVER_MASK_SKIP_REFINE_TRANSITION,
  riverMaskContractKey,
} from './riverMaskLifecycle.js'

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

test('Option A defaults keep legacy presentation heuristics off', () => {
  assert.strictEqual(DEFAULT_WORLD_GENERATION_OPTIONS.riverAttractionRadiusScale, 0)
  assert.strictEqual(DEFAULT_WORLD_GENERATION_OPTIONS.enableMeanderRefine, false)
})

test('default generation exports simulation centerline and presentation corridor mask', () => {
  const doc = generateDerivedGeography({
    geographySeed: DEFAULT_GEOGRAPHY_SEED,
    prevailingWindDegrees: 90,
    width: 64,
    height: 64,
  })

  assert.ok(doc.simulationRiverMask)
  assert.ok(doc.riverNetworkMask)
  assert.ok(doc.riverCorridorMask)

  const simulationCount = doc.simulationRiverMask.reduce((sum, value) => sum + value, 0)
  const centerlineCount = doc.riverNetworkMask.reduce((sum, value) => sum + value, 0)
  const corridorCount = doc.riverCorridorMask.reduce((sum, value) => sum + value, 0)

  assert.ok(simulationCount > 0, 'default simulation path should produce river centerline cells')
  assert.ok(
    corridorCount >= centerlineCount,
    'presentation corridor should cover at least the centerline',
  )
  assert.notStrictEqual(doc.riverCorridorMask, doc.riverNetworkMask)
  assert.deepStrictEqual(doc.simulationRiverMask, doc.riverNetworkMask)
})
