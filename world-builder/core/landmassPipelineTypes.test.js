import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LANDMASS_PIPELINE_STEP_IDS,
  LandmassPipelineCancelledError,
  isLandmassPipelineCancelledError,
} from './landmassPipelineTypes.js'
import { createInitialPipelineState } from './derivedGeographyPipeline.js'

test('LANDMASS_PIPELINE_STEP_IDS is defined in the neutral types module', () => {
  assert.deepStrictEqual(LANDMASS_PIPELINE_STEP_IDS, [
    'physicalTerrainBaseline',
    'erosion',
    'hydrology',
    'fieldRefresh',
    'coastAndResources',
    'validation',
  ])
})

test('LandmassPipelineCancelledError carries pipeline state for finalize', () => {
  const state = createInitialPipelineState({
    geographySeed: 1,
    prevailingWindDegrees: 0,
    width: 8,
    height: 8,
  })
  const error = new LandmassPipelineCancelledError(state)

  assert.strictEqual(error.message, 'Landmass pipeline cancelled')
  assert.strictEqual(error.name, 'LandmassPipelineCancelledError')
  assert.strictEqual(error.state, state)
})

test('isLandmassPipelineCancelledError recognizes unified cancellation errors', () => {
  const state = createInitialPipelineState({
    geographySeed: 1,
    prevailingWindDegrees: 0,
    width: 8,
    height: 8,
  })

  assert.strictEqual(isLandmassPipelineCancelledError(new LandmassPipelineCancelledError(state)), true)
  assert.strictEqual(isLandmassPipelineCancelledError(new Error('Landmass pipeline cancelled')), false)
  assert.strictEqual(isLandmassPipelineCancelledError(null), false)
})
