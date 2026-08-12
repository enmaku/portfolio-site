import assert from 'node:assert/strict'
import test from 'node:test'
import { generateRainfall } from '../fields/generateRainfall.js'
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

test('computeSnowWindAccumFactor ignores secondary maximum (prevailing only)', () => {
  const width = 12
  const height = 7
  const snowCapMask = new Uint8Array(width * height)
  for (let y = 2; y <= 4; y += 1) {
    for (let x = 4; x <= 7; x += 1) {
      snowCapMask[y * width + x] = 1
    }
  }
  const elevation = new Float32Array(width * height).fill(0.5)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      elevation[y * width + x] = Math.max(0.3, 0.9 - Math.abs(x - 6) * 0.1)
    }
  }

  const snowA = computeSnowWindAccumFactor({
    snowCapMask,
    width,
    height,
    prevailingWindDegrees: 270,
  })
  const snowB = computeSnowWindAccumFactor({
    snowCapMask,
    width,
    height,
    prevailingWindDegrees: 270,
    secondaryMaximumDegrees: 90,
  })
  assert.deepEqual(Array.from(snowA), Array.from(snowB))

  const rainA = generateRainfall({
    geographySeed: 7,
    width,
    height,
    elevation,
    prevailingWindDegrees: 270,
    secondaryMaximumDegrees: 0,
  })
  const rainB = generateRainfall({
    geographySeed: 7,
    width,
    height,
    elevation,
    prevailingWindDegrees: 270,
    secondaryMaximumDegrees: 90,
  })
  let rainDiff = 0
  for (let i = 0; i < rainA.length; i += 1) {
    rainDiff += Math.abs(rainA[i] - rainB[i])
  }
  assert.ok(rainDiff > 0.25)
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
