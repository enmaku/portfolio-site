import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCorridorCells, densifyRouteCells, rasterizeGridLine } from './expeditionRouting.js'

test('rasterizeGridLine fills horizontal gaps between waypoints', () => {
  const line = rasterizeGridLine({ x: 1, y: 2 }, { x: 4, y: 2 })
  assert.deepEqual(line, [
    { x: 1, y: 2 },
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 4, y: 2 },
  ])
})

test('densifyRouteCells connects sparse route waypoints', () => {
  const dense = densifyRouteCells([
    { x: 0, y: 0 },
    { x: 3, y: 0 },
  ])
  assert.strictEqual(dense.length, 4)
  assert.deepEqual(dense[2], { x: 2, y: 0 })
})

test('buildCorridorCells covers cells between sparse waypoints', () => {
  const corridor = buildCorridorCells([{ x: 1, y: 2 }, { x: 4, y: 2 }], 6, 6)
  assert.ok(corridor.some((cell) => cell.x === 3 && cell.y === 2))
})
