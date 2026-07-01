import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { coastalProximityMaxDistanceForGrid } from '../resourcePlacementScaling.js'
import {
  COASTAL_PROXIMITY_MAX_DISTANCE,
  computeCoastalProximityOnLand,
} from './computeCoastalProximity.js'

test('computeCoastalProximityOnLand is zero on ocean cells', () => {
  const width = 8
  const height = 8
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL - 0.1)
  const proximity = computeCoastalProximityOnLand({ elevation, width, height })

  assert.ok(proximity.every((value) => value === 0))
})

test('computeCoastalProximityOnLand peaks on shoreline land cells', () => {
  const width = 8
  const height = 8
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL + 0.2)
  for (let x = 0; x < width; x += 1) {
    elevation[3 * width + x] = SEA_LEVEL - 0.1
  }

  const proximity = computeCoastalProximityOnLand({ elevation, width, height })
  const shorelineIdx = 4 * width + 4
  const inlandIdx = 7 * width + 4

  assert.strictEqual(proximity[3 * width + 4], 0)
  assert.ok(proximity[shorelineIdx] > proximity[inlandIdx])
  assert.ok(proximity[shorelineIdx] >= 0.9)
})

test('computeCoastalProximityOnLand decays with distance from coast', () => {
  const width = 20
  const height = 20
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL + 0.2)
  for (let x = 1; x < width - 1; x += 1) {
    elevation[10 * width + x] = SEA_LEVEL - 0.1
  }

  const proximity = computeCoastalProximityOnLand({
    elevation,
    width,
    height,
    maxDistance: COASTAL_PROXIMITY_MAX_DISTANCE,
  })

  const nearIdx = 9 * width + 10
  const farIdx = 5 * width + 10
  assert.ok(proximity[nearIdx] > proximity[farIdx])
  assert.ok(proximity[farIdx] > 0)
})

test('computeCoastalProximityOnLand scaled maxDistance reaches proportionally further inland', () => {
  const offsetFromShore = 11

  /**
   * @param {number} gridSize
   * @param {number} maxDistance
   */
  function shorelineProximityAtFixedShoreOffset(gridSize, maxDistance) {
    const oceanRow = Math.floor(gridSize / 2)
    const elevation = new Float32Array(gridSize * gridSize).fill(SEA_LEVEL + 0.2)
    for (let x = 0; x < gridSize; x += 1) {
      elevation[oceanRow * gridSize + x] = SEA_LEVEL - 0.1
    }
    const proximity = computeCoastalProximityOnLand({
      elevation,
      width: gridSize,
      height: gridSize,
      maxDistance,
    })
    const inlandRow = oceanRow - 1 - offsetFromShore
    const inlandIdx = inlandRow * gridSize + Math.floor(gridSize / 2)
    return proximity[inlandIdx]
  }

  const referenceReach = shorelineProximityAtFixedShoreOffset(
    256,
    COASTAL_PROXIMITY_MAX_DISTANCE,
  )
  const scaledReach = shorelineProximityAtFixedShoreOffset(
    1024,
    coastalProximityMaxDistanceForGrid(1024),
  )

  assert.strictEqual(referenceReach, 0)
  assert.ok(scaledReach > 0)
})
