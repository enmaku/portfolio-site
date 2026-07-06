import assert from 'node:assert/strict'
import test from 'node:test'
import { appendRoadSegment, buildLandRouteCellMask, buildRoadCellMask, resolveRoadSegments } from './roadNetwork.js'

test('buildRoadCellMask marks road segment cells', () => {
  const roads = appendRoadSegment([], [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ])
  const mask = buildRoadCellMask(roads, 4, 4)
  assert.strictEqual(mask[1 * 4 + 1], 1)
  assert.strictEqual(mask[1 * 4 + 2], 1)
  assert.strictEqual(mask[0], 0)
})

test('buildLandRouteCellMask ignores sail route segments', () => {
  const roads = [
    { cells: [{ x: 0, y: 0 }], mode: 'land' },
    { cells: [{ x: 1, y: 0 }], mode: 'sail' },
  ]
  const allMask = buildRoadCellMask(roads, 4, 4)
  const landMask = buildLandRouteCellMask(roads, 4, 4)
  assert.strictEqual(allMask[0], 1)
  assert.strictEqual(allMask[1], 1)
  assert.strictEqual(landMask[0], 1)
  assert.strictEqual(landMask[1], 0)
})

test('resolveRoadSegments treats missing mode as land route', () => {
  const resolved = resolveRoadSegments([{ cells: [{ x: 0, y: 0 }] }])
  assert.strictEqual(resolved[0].mode, 'land')
})

test('resolveRoadSegments preserves sail mode', () => {
  const resolved = resolveRoadSegments([{ cells: [{ x: 0, y: 0 }], mode: 'sail' }])
  assert.strictEqual(resolved[0].mode, 'sail')
})

test('appendRoadSegment preserves prior segments', () => {
  const first = appendRoadSegment([], [{ x: 0, y: 0 }], ['a'])
  const second = appendRoadSegment(first, [{ x: 1, y: 0 }], ['a', 'b'])
  assert.strictEqual(second.length, 2)
  assert.deepStrictEqual(second[1].settlementIds, ['a', 'b'])
})
