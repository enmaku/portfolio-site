import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createEmptyVisitRaster,
  deserializeVisitRaster,
  isCellVisited,
  markCellVisited,
  markCellsVisited,
  markVisitDisc,
  seedHaulShedVisited,
  serializeVisitRaster,
} from './visitRaster.js'

test('createEmptyVisitRaster starts with all cells unvisited', () => {
  const raster = createEmptyVisitRaster(4, 4)
  assert.strictEqual(raster.length, 16)
  assert.strictEqual(raster.every((v) => v === 0), true)
})

test('markCellsVisited and isCellVisited track individual cells', () => {
  const raster = createEmptyVisitRaster(4, 4)
  markCellsVisited(raster, [{ x: 1, y: 2 }, { x: 3, y: 0 }], 4)
  assert.strictEqual(isCellVisited(raster, 1, 2, 4), true)
  assert.strictEqual(isCellVisited(raster, 3, 0, 4), true)
  assert.strictEqual(isCellVisited(raster, 0, 0, 4), false)
})

test('seedHaulShedVisited marks isochrone cells within budget', () => {
  const raster = createEmptyVisitRaster(5, 5)
  seedHaulShedVisited(raster, {
    origin: { x: 2, y: 2 },
    budget: 1.5,
    gridWidth: 5,
    gridHeight: 5,
  })
  assert.strictEqual(isCellVisited(raster, 2, 2, 5), true)
  assert.strictEqual(isCellVisited(raster, 3, 2, 5), true)
  assert.strictEqual(isCellVisited(raster, 4, 4, 5), false)
})

test('markVisitDisc clears a local neighborhood', () => {
  const raster = createEmptyVisitRaster(5, 5)
  markVisitDisc(raster, 2, 2, 5, 5, 1)
  assert.strictEqual(isCellVisited(raster, 1, 1, 5), true)
  assert.strictEqual(isCellVisited(raster, 0, 0, 5), false)
})

test('serialize and deserialize round-trip visit raster', () => {
  const raster = createEmptyVisitRaster(3, 3)
  markCellVisited(raster, 1, 1, 3)
  const serialized = serializeVisitRaster(raster)
  const restored = deserializeVisitRaster(serialized, 3, 3)
  assert.strictEqual(isCellVisited(restored, 1, 1, 3), true)
  assert.strictEqual(isCellVisited(restored, 0, 0, 3), false)
})
