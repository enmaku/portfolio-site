import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateSupplyChainIndependence } from './evaluateSupplyChainIndependence.js'

function flatLandDoc(width, height, arableFill = 2) {
  const n = width * height
  return {
    gridWidth: width,
    gridHeight: height,
    arableRaster: new Float32Array(n).fill(arableFill),
    timberRaster: new Float32Array(n).fill(1),
    fields: {
      elevation: new Float32Array(n).fill(0.6),
      movementCost: new Float32Array(n).fill(1),
    },
    lakeMask: new Uint8Array(n),
    riverCorridorMask: new Uint8Array(n),
  }
}

test('land branch latches when two settlements are circle-isolated with no road or sail', () => {
  const doc = flatLandDoc(40, 40)
  const result = evaluateSupplyChainIndependence({
    settlements: [
      { id: 'a', x: 2, y: 2, population: 100, status: 'living', tier: 'village' },
      { id: 'b', x: 35, y: 35, population: 100, status: 'living', tier: 'village' },
    ],
    worldDocument: doc,
    threeDayHaulDistance: 3,
    roads: [],
    colonistSettings: { yieldModifier: 'typical', populationDensity: 1 },
    primaryClaim: {},
  })

  assert.strictEqual(result.latched, true)
  assert.strictEqual(result.landBranch, true)
  assert.strictEqual(result.maritimeBranch, false)
})

test('land branch does not latch when a road bridges non-overlapping sheds', () => {
  const doc = flatLandDoc(40, 40)
  const result = evaluateSupplyChainIndependence({
    settlements: [
      { id: 'a', x: 2, y: 2, population: 100, status: 'living', tier: 'village' },
      { id: 'b', x: 20, y: 2, population: 100, status: 'living', tier: 'village' },
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
    colonistSettings: { yieldModifier: 'typical', populationDensity: 1 },
    primaryClaim: {},
  })

  assert.strictEqual(result.latched, false)
  assert.strictEqual(result.landBranch, false)
})

test('maritime branch latches drain_city town with arable below half food need', () => {
  const doc = flatLandDoc(20, 20, 0)
  const result = evaluateSupplyChainIndependence({
    settlements: [
      {
        id: 'port',
        x: 5,
        y: 5,
        population: 1000,
        status: 'living',
        tier: 'town',
        logisticsNodePrimaryType: 'drain_city',
      },
    ],
    worldDocument: doc,
    threeDayHaulDistance: 3,
    roads: [],
    colonistSettings: { yieldModifier: 'typical', populationDensity: 1 },
    primaryClaim: { port: [{ x: 5, y: 5 }] },
  })

  assert.strictEqual(result.latched, true)
  assert.strictEqual(result.maritimeBranch, true)
  assert.deepStrictEqual(result.maritimePeelSettlementIds, ['port'])
})
