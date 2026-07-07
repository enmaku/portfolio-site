import assert from 'node:assert/strict'
import test from 'node:test'
import { computeFrontierBoundaryEdges } from './computeFrontierBoundaryEdges.js'
import { computeMaritimeExplorationFrontierEdges } from './computeMaritimeExplorationFrontierEdges.js'

test('computeMaritimeExplorationFrontierEdges is zero when all sail is unvisited and land is too', () => {
  const gridWidth = 5
  const gridHeight = 5
  const cellCount = gridWidth * gridHeight
  const visitRaster = new Uint8Array(cellCount)
  const sailMask = new Uint8Array(cellCount)
  sailMask[2 * gridWidth + 2] = 1

  assert.strictEqual(
    computeMaritimeExplorationFrontierEdges(visitRaster, sailMask, gridWidth, gridHeight),
    0,
  )
  assert.strictEqual(
    computeFrontierBoundaryEdges(visitRaster, sailMask, gridWidth, gridHeight),
    0,
  )
})

test('computeMaritimeExplorationFrontierEdges counts explored land touching unvisited sail', () => {
  const gridWidth = 5
  const gridHeight = 5
  const cellCount = gridWidth * gridHeight
  const visitRaster = new Uint8Array(cellCount)
  const sailMask = new Uint8Array(cellCount)

  visitRaster[2 * gridWidth + 1] = 1
  sailMask[2 * gridWidth + 2] = 1

  const edges = computeMaritimeExplorationFrontierEdges(
    visitRaster,
    sailMask,
    gridWidth,
    gridHeight,
  )

  assert.ok(edges > 0)
  assert.strictEqual(computeFrontierBoundaryEdges(visitRaster, sailMask, gridWidth, gridHeight), 0)
})

test('computeMaritimeExplorationFrontierEdges counts visited sail meeting unvisited sail', () => {
  const gridWidth = 5
  const gridHeight = 5
  const cellCount = gridWidth * gridHeight
  const visitRaster = new Uint8Array(cellCount)
  const sailMask = new Uint8Array(cellCount).fill(1)

  visitRaster[2 * gridWidth + 2] = 1

  const edges = computeMaritimeExplorationFrontierEdges(
    visitRaster,
    sailMask,
    gridWidth,
    gridHeight,
  )

  assert.ok(edges > 0)
  assert.ok(edges === computeFrontierBoundaryEdges(visitRaster, sailMask, gridWidth, gridHeight))
})
