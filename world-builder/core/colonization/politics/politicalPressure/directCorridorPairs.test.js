import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDirectPressureCorridorPairSet } from './directCorridorPairs.js'

test('includes road and inland sail pairs; excludes open sea', () => {
  const pairs = buildDirectPressureCorridorPairSet({
    roads: [
      { settlementIds: ['a', 'b'], mode: 'land', cells: [] },
      { settlementIds: ['b', 'c'], mode: 'inland_sail', cells: [] },
      { settlementIds: ['c', 'd'], mode: 'open_sea', cells: [] },
    ],
    tradeGraphEdges: [
      { a: { id: 'e' }, b: { id: 'f' }, mode: 'road' },
      { a: { id: 'f' }, b: { id: 'g' }, mode: 'overland' },
      { a: { id: 'g' }, b: { id: 'h' }, mode: 'inlandWater' },
      { a: { id: 'h' }, b: { id: 'i' }, mode: 'openSea' },
    ],
  })
  assert.equal(pairs.has('a|b'), true)
  assert.equal(pairs.has('b|c'), true)
  assert.equal(pairs.has('c|d'), false)
  assert.equal(pairs.has('e|f'), true)
  assert.equal(pairs.has('f|g'), true)
  assert.equal(pairs.has('g|h'), true)
  assert.equal(pairs.has('h|i'), false)
})
