import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isNodePlacementCellAllowed,
  NODE_MAP_EDGE_MARGIN,
} from './nodePlacementBounds.js'

test('isNodePlacementCellAllowed rejects cells within the map edge margin', () => {
  const width = 64
  const height = 64
  const margin = NODE_MAP_EDGE_MARGIN

  assert.strictEqual(isNodePlacementCellAllowed(9, 20, width, height), false)
  assert.strictEqual(isNodePlacementCellAllowed(20, 9, width, height), false)
  assert.strictEqual(isNodePlacementCellAllowed(width - margin, 20, width, height), false)
  assert.strictEqual(isNodePlacementCellAllowed(20, height - margin, width, height), false)
  assert.strictEqual(isNodePlacementCellAllowed(margin, margin, width, height), true)
  assert.strictEqual(
    isNodePlacementCellAllowed(width - margin - 1, height - margin - 1, width, height),
    true,
  )
})

test('isNodePlacementCellAllowed rejects all cells when the map is too small', () => {
  assert.strictEqual(isNodePlacementCellAllowed(5, 5, 18, 18), false)
})
