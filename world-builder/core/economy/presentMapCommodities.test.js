import assert from 'node:assert/strict'
import test from 'node:test'
import { presentMapCommodityIds, presentPinCommodityIds } from './presentMapCommodities.js'

test('presentPinCommodityIds matches resource-claim pin presence', () => {
  assert.deepEqual(
    presentPinCommodityIds({
      saltNodes: [],
      metalNodes: [{ id: 'c1', x: 0, y: 0, score: 1, kind: 'copper' }],
    }),
    ['copper'],
  )
  assert.deepEqual(
    presentPinCommodityIds({
      saltNodes: [{ id: 's1', x: 0, y: 0, score: 1 }],
      metalNodes: [
        { id: 'g1', x: 1, y: 0, score: 1, kind: 'gold' },
        { id: 'd1', x: 2, y: 0, score: 1, kind: 'diamond' },
      ],
    }),
    ['salt', 'gold', 'diamonds'],
  )
})

test('presentMapCommodityIds always includes grain fish timber baseMetals', () => {
  assert.deepEqual(presentMapCommodityIds({ saltNodes: [], metalNodes: [] }), [
    'grain',
    'fish',
    'timber',
    'baseMetals',
  ])
})

test('presentMapCommodityIds adds pin commodities when present', () => {
  assert.deepEqual(
    presentMapCommodityIds({
      saltNodes: [{ id: 's1', x: 0, y: 0, score: 1 }],
      metalNodes: [{ id: 'c1', x: 0, y: 0, score: 1, kind: 'copper' }],
    }),
    ['grain', 'fish', 'salt', 'timber', 'baseMetals', 'copper'],
  )
})
