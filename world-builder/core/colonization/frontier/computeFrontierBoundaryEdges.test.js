import assert from 'node:assert/strict'
import test from 'node:test'
import { computeFrontierBoundaryEdges } from './computeFrontierBoundaryEdges.js'

test('computeFrontierBoundaryEdges counts perimeter not interior area', () => {
  const gridWidth = 5
  const gridHeight = 5
  const cellCount = gridWidth * gridHeight
  const traversable = new Uint8Array(cellCount).fill(1)
  const visitRaster = new Uint8Array(cellCount)

  for (let y = 1; y <= 3; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      visitRaster[y * gridWidth + x] = 1
    }
  }

  const smallBlobEdges = computeFrontierBoundaryEdges(
    visitRaster,
    traversable,
    gridWidth,
    gridHeight,
  )

  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      visitRaster[y * gridWidth + x] = 1
    }
  }
  visitRaster[0] = 0
  visitRaster[4] = 0
  visitRaster[20] = 0
  visitRaster[24] = 0

  const largeInteriorEdges = computeFrontierBoundaryEdges(
    visitRaster,
    traversable,
    gridWidth,
    gridHeight,
  )

  assert.ok(smallBlobEdges > 0)
  assert.ok(largeInteriorEdges < smallBlobEdges)
})
