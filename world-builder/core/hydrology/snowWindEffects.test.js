import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeSnowWindAccumFactor,
  snowMeltOutletCell,
} from './snowWindEffects.js'

test('computeSnowWindAccumFactor favors leeward cap cells over windward edges', () => {
  const width = 12
  const height = 7
  const snowCapMask = new Uint8Array(width * height)
  for (let y = 2; y <= 4; y += 1) {
    for (let x = 4; x <= 7; x += 1) {
      snowCapMask[y * width + x] = 1
    }
  }

  // Wind from the west (270): the west cap edge is scoured, the east edge is sheltered.
  const factor = computeSnowWindAccumFactor({
    snowCapMask,
    width,
    height,
    prevailingWindDegrees: 270,
  })

  const row = 3
  const westEdge = row * width + 4
  const eastEdge = row * width + 7

  assert.ok(factor[eastEdge] > factor[westEdge])
  assert.ok(factor[westEdge] < 1)
  assert.ok(factor[eastEdge] > 1)
})

test('computeSnowWindAccumFactor leaves non-cap cells at unity', () => {
  const width = 5
  const height = 5
  const snowCapMask = new Uint8Array(width * height)
  snowCapMask[2 * width + 2] = 1

  const factor = computeSnowWindAccumFactor({
    snowCapMask,
    width,
    height,
    prevailingWindDegrees: 0,
  })

  assert.equal(factor[0], 1)
})

test('snowMeltOutletCell returns the steepest downhill non-cap neighbor', () => {
  const width = 3
  const height = 3
  const elevation = new Float32Array([
    0.9, 0.9, 0.9,
    0.9, 0.8, 0.2,
    0.9, 0.5, 0.9,
  ])
  const snowCapMask = new Uint8Array(width * height)
  snowCapMask[1 * width + 1] = 1

  const outlet = snowMeltOutletCell(elevation, snowCapMask, width, height, 1, 1)

  assert.equal(outlet, 1 * width + 2)
})
