import assert from 'node:assert/strict'
import test from 'node:test'
import { createEmptyVisitRaster, markCellVisited } from '../core/colonization/visitStatus/visitRaster.js'
import {
  EXPLORATION_FOG_ALPHA,
  buildExplorationFogOverlayRgba,
} from './buildExplorationFogOverlayRgba.js'

test('buildExplorationFogOverlayRgba tints unvisited cells and leaves visited transparent', () => {
  const gridWidth = 3
  const gridHeight = 3
  const visitRaster = createEmptyVisitRaster(gridWidth, gridHeight)
  markCellVisited(visitRaster, 1, 1, gridWidth)

  const rgba = buildExplorationFogOverlayRgba({
    gridWidth,
    gridHeight,
    visitedCells: visitRaster,
  })
  assert.ok(rgba)

  const visitedIndex = (1 * gridWidth + 1) * 4
  assert.strictEqual(rgba[visitedIndex + 3], 0)

  const unvisitedIndex = (0 * gridWidth + 0) * 4
  assert.strictEqual(rgba[unvisitedIndex + 3], Math.round(EXPLORATION_FOG_ALPHA * 255))
})

test('buildExplorationFogOverlayRgba returns null when all cells visited', () => {
  const gridWidth = 2
  const gridHeight = 2
  const visitRaster = createEmptyVisitRaster(gridWidth, gridHeight)
  visitRaster.fill(1)
  const rgba = buildExplorationFogOverlayRgba({
    gridWidth,
    gridHeight,
    visitedCells: visitRaster,
  })
  assert.strictEqual(rgba, null)
})
