import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import { isValidFoundingLandingCell } from './isValidFoundingLandingCell.js'

const WIDTH = 8
const HEIGHT = 8

function fixtureDoc({ elevation, lakeMask, riverCorridorMask, coastalNodes }) {
  return {
    gridWidth: WIDTH,
    gridHeight: HEIGHT,
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
