import assert from 'node:assert/strict'
import test from 'node:test'
import { computeLogisticsConnectivityComponents } from './computeLogisticsConnectivityComponents.js'

function flatLandDoc(width, height) {
  return {
    gridWidth: width,
    gridHeight: height,
    fields: {
      elevation: new Float32Array(width * height).fill(0.6),
      movementCost: new Float32Array(width * height).fill(1),
    },
    lakeMask: new Uint8Array(width * height),
    riverCorridorMask: new Uint8Array(width * height),
  }
}

test('isolated settlements with no haul-shed overlap form separate components', () => {
  const doc = flatLandDoc(40, 40)
  const result = computeLogisticsConnectivityComponents({
    settlements: [
      { id: 'a', x: 2, y: 2, population: 10, status: 'living' },
      { id: 'b', x: 35, y: 35, population: 10, status: 'living' },
    ],
    worldDocument: doc,
    threeDayHaulDistance: 3,
    roads: [],
  })

  assert.strictEqual(result.components.length, 2)
  assert.deepStrictEqual(
    result.components.map((c) => c.settlementIds).sort((a, b) => a[0].localeCompare(b[0])),
    [['a'], ['b']],
  )
})

test('overlapping geometric haul-shed circles unify into one component', () => {
  const doc = flatLandDoc(20, 20)
  const result = computeLogisticsConnectivityComponents({
    settlements: [
      { id: 'a', x: 5, y: 5, population: 10, status: 'living' },
      { id: 'b', x: 8, y: 5, population: 10, status: 'living' },
    ],
    worldDocument: doc,
    threeDayHaulDistance: 3,
    roads: [],
  })

  assert.strictEqual(result.components.length, 1)
  assert.deepStrictEqual(result.components[0].settlementIds, ['a', 'b'])
  assert.strictEqual(result.components[0].key, 'a|b')
})

test('road within three-day haul unifies non-overlapping settlements', () => {
  const doc = flatLandDoc(40, 40)
  const result = computeLogisticsConnectivityComponents({
    settlements: [
      { id: 'a', x: 2, y: 2, population: 10, status: 'living' },
      { id: 'b', x: 20, y: 2, population: 10, status: 'living' },
    ],
    worldDocument: doc,
    threeDayHaulDistance: 3,
    roads: [
      {
        cells: Array.from({ length: 19 }, (_, i) => ({ x: 2 + i, y: 2 })),
        mode: 'land',
        settlementIds: ['a', 'b'],
      },
    ],
  })

  assert.strictEqual(result.components.length, 1)
  assert.deepStrictEqual(result.components[0].settlementIds, ['a', 'b'])
})

test('component keys are deterministic for the same membership set', () => {
  const doc = flatLandDoc(20, 20)
  const params = {
    settlements: [
      { id: 'b', x: 8, y: 5, population: 10, status: 'living' },
      { id: 'a', x: 5, y: 5, population: 10, status: 'living' },
    ],
    worldDocument: doc,
    threeDayHaulDistance: 3,
    roads: [],
  }
  const first = computeLogisticsConnectivityComponents(params)
  const second = computeLogisticsConnectivityComponents({
    ...params,
    settlements: [...params.settlements].reverse(),
  })
  assert.strictEqual(first.components[0].key, second.components[0].key)
  assert.strictEqual(first.components[0].key, 'a|b')
})
