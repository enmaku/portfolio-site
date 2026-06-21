import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildFlowWeightedRiverCorridorMask,
  riverCorridorRadiusForDrainage,
} from './riverCorridorDisplay.js'

test('riverCorridorRadiusForDrainage grows with drainage and caps at max radius', () => {
  assert.strictEqual(riverCorridorRadiusForDrainage(0), 0)
  assert.strictEqual(riverCorridorRadiusForDrainage(0.02), 0)
  assert.ok(riverCorridorRadiusForDrainage(0.2) >= 1)
  assert.strictEqual(riverCorridorRadiusForDrainage(1), 2)
})

test('buildFlowWeightedRiverCorridorMask widens high-flow reaches more than headwaters', () => {
  const width = 7
  const height = 3
  const riverNetworkMask = new Uint8Array(width * height)
  const drainage = new Float32Array(width * height)

  for (let x = 1; x < 3; x += 1) {
    const idx = 1 * width + x
    riverNetworkMask[idx] = 1
    drainage[idx] = 0.05
  }
  for (let x = 4; x < 6; x += 1) {
    const idx = 1 * width + x
    riverNetworkMask[idx] = 1
    drainage[idx] = 0.9
  }

  const mask = buildFlowWeightedRiverCorridorMask(
    riverNetworkMask,
    drainage,
    width,
    height,
  )

  let headwaterWidth = 0
  let mouthWidth = 0
  for (let dy = -2; dy <= 2; dy += 1) {
    if (mask[(1 + dy) * width + 1]) headwaterWidth += 1
    if (mask[(1 + dy) * width + 5]) mouthWidth += 1
  }

  assert.ok(mouthWidth > headwaterWidth)
})
