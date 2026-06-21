import assert from 'node:assert/strict'
import test from 'node:test'
import { applyRainShadow } from './applyRainShadow.js'

test('applyRainShadow reduces rainfall leeward of a ridge for east wind', () => {
  const width = 5
  const height = 5
  const elevation = new Float32Array(width * height).fill(0.5)
  const rainfall = new Float32Array(width * height).fill(0.8)

  for (let y = 0; y < height; y += 1) {
    elevation[y * width + 2] = 0.95
  }

  const shadowed = applyRainShadow({
    rainfall,
    elevation,
    width,
    height,
    prevailingWindDegrees: 270,
  })

  const windwardIdx = 2 * width + 1
  const leewardIdx = 2 * width + 3

  assert.ok(shadowed[windwardIdx] >= rainfall[windwardIdx] * 0.95)
  assert.ok(shadowed[leewardIdx] < rainfall[leewardIdx] * 0.7)
})
