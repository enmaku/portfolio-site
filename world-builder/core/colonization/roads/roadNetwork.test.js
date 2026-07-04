import assert from 'node:assert/strict'
import test from 'node:test'
import { appendRoadSegment, buildRoadCellMask } from './roadNetwork.js'

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

test('appendRoadSegment preserves prior segments', () => {
  const first = appendRoadSegment([], [{ x: 0, y: 0 }], ['a'])
  const second = appendRoadSegment(first, [{ x: 1, y: 0 }], ['a', 'b'])
  assert.strictEqual(second.length, 2)
  assert.deepStrictEqual(second[1].settlementIds, ['a', 'b'])
})
