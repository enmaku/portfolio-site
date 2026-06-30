import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LANDMASS_PIPELINE_STAGE_CONTRACTS,
  LANDMASS_PIPELINE_STEP_IDS,
  pickLandmassStageInput,
} from './landmassPipelineStageContracts.js'
import {
  createInitialPipelineState,
  runPipelineStep,
} from './derivedGeographyPipeline.js'

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
