import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generationProgressValue,
  shouldApplyStepPreviewToMap,
} from './worldBuilderGenerationPolicy.js'

test('generationProgressValue scales by completed steps', () => {
  assert.strictEqual(generationProgressValue(0, 6), 17)
  assert.strictEqual(generationProgressValue(5, 6), 100)
})

test('generationProgressValue returns zero when step count is non-positive', () => {
  assert.strictEqual(generationProgressValue(0, 0), 0)
  assert.strictEqual(generationProgressValue(2, -1), 0)
})

test('shouldApplyStepPreviewToMap is false when step-complete omits world document', () => {
  assert.strictEqual(shouldApplyStepPreviewToMap(undefined), false)
  assert.strictEqual(shouldApplyStepPreviewToMap(null), false)
})

test('shouldApplyStepPreviewToMap is true when a world document is present', () => {
  assert.strictEqual(
    shouldApplyStepPreviewToMap({
      gridWidth: 2,
      gridHeight: 2,
      biomes: new Uint8Array(4),
      fields: { elevation: new Float32Array(4) },
    }),
    true,
  )
})

test('exhausted last candidate remains eligible for map preview', () => {
  const lastCandidate = {
    gridWidth: 2,
    gridHeight: 2,
    biomes: new Uint8Array(4),
    fields: { elevation: new Float32Array(4) },
    generationReport: { shouldReject: true },
  }

  assert.strictEqual(shouldApplyStepPreviewToMap(lastCandidate), true)
})
