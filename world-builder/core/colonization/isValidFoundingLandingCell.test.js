import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import {
  MIN_COLONIZABLE_LANDMASS_CELLS,
  isValidFoundingLandingCell,
} from './isValidFoundingLandingCell.js'

const WIDTH = 8
const HEIGHT = 8

function fixtureDoc({
  elevation,
  lakeMask,
  riverCorridorMask,
  coastalNodes,
  gridWidth = WIDTH,
  gridHeight = HEIGHT,
}) {
  return {
    gridWidth,
    gridHeight,
    fields: { elevation },
    lakeMask,
    riverCorridorMask,
    coastalNodes,
  }
}

function landElevation() {
  return new Float32Array(WIDTH * HEIGHT).fill(SEA_LEVEL + 0.2)
}

test('isValidFoundingLandingCell accepts sail-reachable coastal land', () => {
  const elevation = landElevation()
  // Interior ocean column (not map rim).
  for (let y = 2; y < 6; y += 1) {
    elevation[y * WIDTH + 2] = SEA_LEVEL - 0.2
  }

  const doc = fixtureDoc({ elevation })
  assert.strictEqual(isValidFoundingLandingCell(doc, 3, 3), true)
  assert.strictEqual(isValidFoundingLandingCell(doc, 5, 5), false)
})

test('isValidFoundingLandingCell rejects open ocean and inland cells', () => {
  const elevation = landElevation()
  for (let y = 2; y < 6; y += 1) {
    elevation[y * WIDTH + 2] = SEA_LEVEL - 0.2
  }

  const doc = fixtureDoc({ elevation })
  assert.strictEqual(isValidFoundingLandingCell(doc, 2, 3), false)
  assert.strictEqual(isValidFoundingLandingCell(doc, 5, 5), false)
})

test('isValidFoundingLandingCell accepts river mouth coastal nodes on land', () => {
  const elevation = landElevation()
  elevation[3 * WIDTH + 2] = SEA_LEVEL - 0.2
  const doc = fixtureDoc({
    elevation,
    coastalNodes: [{ id: 'm1', x: 3, y: 3, kind: 'mouth' }],
  })

  assert.strictEqual(isValidFoundingLandingCell(doc, 3, 3), true)
})

test('isValidFoundingLandingCell rejects coastal cells on tiny sandbar landmasses', () => {
  const width = 24
  const height = 24
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL - 0.2)
  // 3x3 offshore wisp — sail-adjacent coast, but below colonizable landmass size.
  for (let y = 10; y <= 12; y += 1) {
    for (let x = 10; x <= 12; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.2
    }
  }
  const doc = fixtureDoc({ elevation, gridWidth: width, gridHeight: height })

  assert.ok(9 < MIN_COLONIZABLE_LANDMASS_CELLS)
  assert.strictEqual(isValidFoundingLandingCell(doc, 10, 10), false)
  assert.strictEqual(isValidFoundingLandingCell(doc, 11, 11), false)
})

test('isValidFoundingLandingCell accepts coast on a landmass at the minimum size', () => {
  const width = 24
  const height = 24
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL - 0.2)
  const side = Math.ceil(Math.sqrt(MIN_COLONIZABLE_LANDMASS_CELLS))
  for (let y = 4; y < 4 + side; y += 1) {
    for (let x = 4; x < 4 + side; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.2
    }
  }
  const doc = fixtureDoc({ elevation, gridWidth: width, gridHeight: height })

  assert.ok(side * side >= MIN_COLONIZABLE_LANDMASS_CELLS)
  assert.strictEqual(isValidFoundingLandingCell(doc, 4, 4), true)
})

test('isValidFoundingLandingCell rejects mouths on undersized landmasses', () => {
  const width = 16
  const height = 16
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL - 0.2)
  elevation[5 * width + 5] = SEA_LEVEL + 0.2
  elevation[5 * width + 6] = SEA_LEVEL + 0.2
  const doc = fixtureDoc({
    elevation,
    gridWidth: width,
    gridHeight: height,
    coastalNodes: [{ id: 'm1', x: 5, y: 5, kind: 'mouth' }],
  })

  assert.strictEqual(isValidFoundingLandingCell(doc, 5, 5), false)
})
