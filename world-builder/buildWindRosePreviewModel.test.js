import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWindRosePreviewModel, WIND_ROSE_PREVIEW_BINS } from './buildWindRosePreviewModel.js'

test('buildWindRosePreviewModel bins schedule bearings into polar weights', () => {
  const model = buildWindRosePreviewModel({
    geographySeed: 42,
    prevailingWindDegrees: 90,
    secondaryMaximumDegrees: 180,
  })
  assert.equal(model.weights.length, WIND_ROSE_PREVIEW_BINS)
  assert.equal(model.displayWeights.length, WIND_ROSE_PREVIEW_BINS)
  assert.equal(model.bearings.length, 20)
  assert.ok(model.weights.some((weight) => weight > 0))
  const weightSum = model.weights.reduce((sum, weight) => sum + weight, 0)
  assert.ok(Math.abs(weightSum - 1) < 1e-9)
})

test('buildWindRosePreviewModel changes when secondary maximum changes', () => {
  const a = buildWindRosePreviewModel({
    geographySeed: 7,
    prevailingWindDegrees: 270,
    secondaryMaximumDegrees: 0,
  })
  const b = buildWindRosePreviewModel({
    geographySeed: 7,
    prevailingWindDegrees: 270,
    secondaryMaximumDegrees: 90,
  })
  assert.notDeepEqual(a.weights, b.weights)
})
