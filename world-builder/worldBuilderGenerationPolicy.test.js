import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generationProgressValue,
  shouldApplyStepPreviewToMap,
} from './worldBuilderGenerationPolicy.js'

/** @type {import('./core/types.js').WorldDocument} */
const SAMPLE_DOC = {
  gridWidth: 2,
  gridHeight: 2,
  biomes: new Uint8Array(4),
  fields: { elevation: new Float32Array(4) },
}

test('generationProgressValue scales by completed steps', () => {
  assert.strictEqual(generationProgressValue(0, 6), 17)
  assert.strictEqual(generationProgressValue(5, 6), 100)
})

test('generationProgressValue returns zero when step count is non-positive', () => {
  assert.strictEqual(generationProgressValue(0, 0), 0)
  assert.strictEqual(generationProgressValue(2, -1), 0)
})

test('shouldApplyStepPreviewToMap rejects step-complete without world document', () => {
  assert.strictEqual(
    shouldApplyStepPreviewToMap({ delivery: 'step-complete', stepId: 'validation' }),
    false,
  )
  assert.strictEqual(
    shouldApplyStepPreviewToMap({
      delivery: 'step-complete',
      stepId: 'validation',
      worldDocument: null,
    }),
    false,
  )
})

test('shouldApplyStepPreviewToMap accepts validation step-complete with world document', () => {
  assert.strictEqual(
    shouldApplyStepPreviewToMap({
      delivery: 'step-complete',
      stepId: 'validation',
      worldDocument: SAMPLE_DOC,
    }),
    true,
  )
})

test('shouldApplyStepPreviewToMap rejects non-validation step-complete even with world document', () => {
  for (const stepId of ['physicalTerrainBaseline', 'erosion', 'hydrology', 'fieldRefresh', 'coastAndResources']) {
    assert.strictEqual(
      shouldApplyStepPreviewToMap({
        delivery: 'step-complete',
        stepId,
        worldDocument: SAMPLE_DOC,
      }),
      false,
      stepId,
    )
  }
})

test('shouldApplyStepPreviewToMap accepts exhausted terminal with world document', () => {
  assert.strictEqual(
    shouldApplyStepPreviewToMap({
      delivery: 'exhausted',
      worldDocument: {
        ...SAMPLE_DOC,
        generationReport: { shouldReject: true },
      },
    }),
    true,
  )
})

test('shouldApplyStepPreviewToMap rejects exhausted terminal without world document', () => {
  assert.strictEqual(shouldApplyStepPreviewToMap({ delivery: 'exhausted' }), false)
  assert.strictEqual(
    shouldApplyStepPreviewToMap({ delivery: 'exhausted', worldDocument: null }),
    false,
  )
})

test('shouldApplyStepPreviewToMap rejects unknown delivery kinds', () => {
  assert.strictEqual(
    shouldApplyStepPreviewToMap({
      delivery: /** @type {'step-complete'} */ (/** @type {unknown} */ ('complete')),
      worldDocument: SAMPLE_DOC,
    }),
    false,
  )
})
