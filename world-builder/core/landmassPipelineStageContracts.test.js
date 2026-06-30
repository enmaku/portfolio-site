import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LANDMASS_PIPELINE_STAGE_CONTRACTS,
  LANDMASS_PIPELINE_STEP_IDS,
  assertLandmassStageOutputs,
  buildPipelineStateForHydrologySubsteps,
  pickLandmassStageInput,
} from './landmassPipelineStageContracts.js'
import {
  createInitialPipelineState,
  runPipelineStep,
} from './derivedGeographyPipeline.js'
import { LandmassPipelineCancelledError } from './landmassPipelineTypes.js'

const params = {
  geographySeed: 12345,
  prevailingWindDegrees: 90,
  width: 32,
  height: 32,
}

test('LANDMASS_PIPELINE_STEP_IDS matches derived geography stage order', () => {
  assert.deepStrictEqual(LANDMASS_PIPELINE_STEP_IDS, [
    'physicalTerrainBaseline',
    'erosion',
    'hydrology',
    'fieldRefresh',
    'coastAndResources',
    'validation',
  ])
})

test('each landmass stage contract declares narrow input and output keys', () => {
  for (const stepId of LANDMASS_PIPELINE_STEP_IDS) {
    const contract = LANDMASS_PIPELINE_STAGE_CONTRACTS[stepId]
    assert.ok(contract, `missing contract for ${stepId}`)
    assert.strictEqual(contract.id, stepId)
    assert.ok(contract.label.length > 0)
    assert.ok(contract.inputKeys.length > 0, `${stepId} inputKeys`)
    assert.ok(contract.outputKeys.length > 0, `${stepId} outputKeys`)
    assert.ok(
      contract.outputKeys.includes('lastCompletedStep'),
      `${stepId} must declare lastCompletedStep output`,
    )
  }
})

test('pickLandmassStageInput rejects erosion without physical terrain baseline', () => {
  const state = createInitialPipelineState(params)
  assert.throws(
    () => pickLandmassStageInput('erosion', state),
    /physicalTerrainBaseline/,
  )
})

test('pickLandmassStageInput rejects hydrology without erosion', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  assert.throws(
    () => pickLandmassStageInput('hydrology', state),
    /erosion/,
  )
})

test('pickLandmassStageInput rejects field refresh without hydrology outputs', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  assert.throws(
    () => pickLandmassStageInput('fieldRefresh', state),
    /hydrology/,
  )
})

test('pickLandmassStageInput rejects coast and resources before field refresh', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = runPipelineStep(state, 'hydrology')
  assert.throws(
    () => pickLandmassStageInput('coastAndResources', state),
    /fieldRefresh/,
  )
})

test('pickLandmassStageInput rejects validation before coast and resources', () => {
  let state = createInitialPipelineState(params)
  for (const stepId of [
    'physicalTerrainBaseline',
    'erosion',
    'hydrology',
    'fieldRefresh',
  ]) {
    state = runPipelineStep(state, stepId)
  }
  assert.throws(
    () => pickLandmassStageInput('validation', state),
    /coastAndResources/,
  )
})

test('pickLandmassStageInput returns only contract input keys for each stage', () => {
  let state = createInitialPipelineState(params)
  for (const stepId of LANDMASS_PIPELINE_STEP_IDS) {
    const input = pickLandmassStageInput(stepId, state)
    const contract = LANDMASS_PIPELINE_STAGE_CONTRACTS[stepId]
    assert.deepStrictEqual(Object.keys(input).sort(), [...contract.inputKeys].sort())
    state = runPipelineStep(state, stepId)
  }
})

test('assertLandmassStageOutputs rejects missing erosion output at seam', () => {
  assert.throws(
    () => assertLandmassStageOutputs('erosion', { lastCompletedStep: 'erosion' }),
    /erosion missing output erodedElevation/,
  )
})

test('assertLandmassStageOutputs rejects missing hydrology output at seam', () => {
  assert.throws(
    () => assertLandmassStageOutputs('hydrology', { lastCompletedStep: 'hydrology' }),
    /hydrology missing output lakeMask/,
  )
})

test('assertLandmassStageOutputs rejects missing validation output at seam', () => {
  assert.throws(
    () => assertLandmassStageOutputs('validation', { lastCompletedStep: 'validation' }),
    /validation missing output generationReport/,
  )
})

test('assertLandmassStageOutputs rejects missing physical terrain baseline output at seam', () => {
  assert.throws(
    () =>
      assertLandmassStageOutputs('physicalTerrainBaseline', {
        lastCompletedStep: 'physicalTerrainBaseline',
      }),
    /physicalTerrainBaseline missing output baselineDoc/,
  )
})

test('assertLandmassStageOutputs rejects missing coast and resources output at seam', () => {
  assert.throws(
    () =>
      assertLandmassStageOutputs('coastAndResources', { lastCompletedStep: 'coastAndResources' }),
    /coastAndResources missing output coastNavigability/,
  )
})

test('buildPipelineStateForHydrologySubsteps seeds minimal erosion-complete state', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  state = {
    ...state,
    coastalNodes: [{ cellIndex: 0, navigability: 1 }],
    metalsRaster: new Float32Array(4),
  }

  const input = pickLandmassStageInput('hydrology', state)
  const hydrologyState = buildPipelineStateForHydrologySubsteps(input)

  assert.strictEqual(hydrologyState.coastalNodes, null)
  assert.strictEqual(hydrologyState.metalsRaster, null)
  assert.strictEqual(hydrologyState.generationReport, null)
  assert.strictEqual(hydrologyState.lastCompletedStep, 'erosion')
  assert.ok(hydrologyState.erodedElevation)
  assert.ok(hydrologyState.baselineDoc)
})

test('runPipelineStep asserts contracted outputs after erosion, hydrology, and validation', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')
  assert.ok(state.erodedElevation)
  state = runPipelineStep(state, 'hydrology')
  assert.ok(state.lakeMask)
  for (const stepId of ['fieldRefresh', 'coastAndResources']) {
    state = runPipelineStep(state, stepId)
  }
  state = runPipelineStep(state, 'validation')
  assert.ok(state.generationReport)
})

test('runPipelineStep hydrology cancellation throws LandmassPipelineCancelledError', () => {
  let state = createInitialPipelineState(params)
  state = runPipelineStep(state, 'physicalTerrainBaseline')
  state = runPipelineStep(state, 'erosion')

  let completedSubsteps = 0
  assert.throws(
    () => {
      runPipelineStep(state, 'hydrology', {
        onSubstepComplete() {
          completedSubsteps += 1
        },
        shouldCancel() {
          return completedSubsteps >= 2
        },
      })
    },
    (error) => error instanceof LandmassPipelineCancelledError,
  )
})
