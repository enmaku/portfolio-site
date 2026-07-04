import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../../biomeIds.js'
import {
  advanceExplorationProgress,
  buildSimpleExplorationRoute,
  routeCellsEnteredSince,
} from './buildSimpleExplorationRoute.js'

function flatLandDoc(width, height) {
  const cellCount = width * height
  return {
    gridWidth: width,
    gridHeight: height,
    fields: {
      elevation: new Float32Array(cellCount).fill(0.6),
    },
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
  }
}

test('buildSimpleExplorationRoute walks land toward the bearing target', () => {
  const doc = flatLandDoc(32, 32)
  const route = buildSimpleExplorationRoute(doc, { x: 16, y: 16 }, { x: 26, y: 16 }, 20)
  assert.ok(route)
  assert.strictEqual(route.mode, 'land')
  assert.ok(route.cells.length >= 2)
  const last = route.cells[route.cells.length - 1]
  assert.ok(Math.hypot(last.x - 16, last.y - 16) > 5)
})

test('advanceExplorationProgress moves a fixed number of cells per epoch', () => {
  const route = Array.from({ length: 40 }, (_, index) => ({ x: index, y: 0 }))
  assert.strictEqual(advanceExplorationProgress(route, 0, 8), 8)
  assert.strictEqual(advanceExplorationProgress(route, 35, 8), 39)
})

test('routeCellsEnteredSince returns only newly walked cells', () => {
  const route = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ]
  assert.deepEqual(routeCellsEnteredSince(route, 0, 2), [
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ])
})
