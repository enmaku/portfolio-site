import assert from 'node:assert/strict'
import test from 'node:test'
import { SEA_LEVEL } from '../biomeIds.js'
import {
  FOUNDING_LANDING_SNAP_RADIUS,
  createFoundingLandingValidityContext,
  isValidFoundingLandingCell,
  snapFoundingLandingCell,
  snapFoundingLandingCellInContext,
} from './isValidFoundingLandingCell.js'

const WIDTH = 8
const HEIGHT = 8

function coastalDoc() {
  const elevation = new Float32Array(WIDTH * HEIGHT).fill(SEA_LEVEL + 0.2)
  for (let y = 2; y < 6; y += 1) {
    elevation[y * WIDTH + 2] = SEA_LEVEL - 0.2
  }
  return {
    gridWidth: WIDTH,
    gridHeight: HEIGHT,
    fields: { elevation },
  }
}

test('snapFoundingLandingCell returns the clicked cell when it is already valid', () => {
  const doc = coastalDoc()
  assert.deepStrictEqual(snapFoundingLandingCell(doc, 3, 3), { x: 3, y: 3 })
})

test('snapFoundingLandingCell snaps a nearby inland click to the nearest valid landing', () => {
  const doc = coastalDoc()
  assert.strictEqual(isValidFoundingLandingCell(doc, 4, 3), false)

  const snapped = snapFoundingLandingCell(doc, 4, 3)
  assert.ok(snapped)
  assert.strictEqual(isValidFoundingLandingCell(doc, snapped.x, snapped.y), true)
  assert.ok(Math.abs(snapped.x - 4) + Math.abs(snapped.y - 3) <= FOUNDING_LANDING_SNAP_RADIUS)
})

test('snapFoundingLandingCell returns null when no valid landing is within the snap radius', () => {
  const width = 32
  const height = 32
  const elevation = new Float32Array(width * height).fill(SEA_LEVEL - 0.2)
  for (let y = 4; y <= 6; y += 1) {
    for (let x = 4; x <= 6; x += 1) {
      elevation[y * width + x] = SEA_LEVEL + 0.2
    }
  }
  const doc = {
    gridWidth: width,
    gridHeight: height,
    fields: { elevation },
  }

  assert.strictEqual(snapFoundingLandingCell(doc, 24, 24), null)
})

test('snapFoundingLandingCell prefers the nearest valid cell when several are in range', () => {
  const doc = coastalDoc()
  const snapped = snapFoundingLandingCell(doc, 4, 3, 3)
  assert.deepStrictEqual(snapped, { x: 3, y: 3 })
})

test('snapFoundingLandingCellInContext matches snapFoundingLandingCell for the same context', () => {
  const doc = coastalDoc()
  const ctx = createFoundingLandingValidityContext(doc)
  assert.ok(ctx)

  for (const [x, y] of [
    [3, 3],
    [4, 3],
    [0, 0],
    [7, 7],
  ]) {
    assert.deepStrictEqual(
      snapFoundingLandingCellInContext(ctx, x, y),
      snapFoundingLandingCell(doc, x, y),
    )
  }
})
