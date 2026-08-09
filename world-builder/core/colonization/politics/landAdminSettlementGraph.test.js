import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLandAdminAdjacency,
  isWithinStrategicOverstretchReach,
  landHopsBetween,
  strategicOverstretchReachBudget,
} from './landAdminSettlementGraph.js'

function flatDoc(width, height) {
  return {
    gridWidth: width,
    gridHeight: height,
    fields: {},
    sailMask: new Uint8Array(width * height),
  }
}

test('strategicOverstretchReachBudget is land expedition range times three-day haul', () => {
  assert.strictEqual(
    strategicOverstretchReachBudget({ threeDayHaulDistance: 5, landExpeditionRange: 2 }),
    10,
  )
})

test('isWithinStrategicOverstretchReach is true for land expedition mode', () => {
  const doc = flatDoc(20, 20)
  assert.equal(
    isWithinStrategicOverstretchReach({
      origin: { x: 2, y: 2 },
      candidateCell: { x: 18, y: 18 },
      worldDocument: doc,
      roads: [],
      colonistSettings: { threeDayHaulDistance: 3, landExpeditionRange: 2 },
      expeditionMode: 'land',
    }),
    true,
  )
})

test('isWithinStrategicOverstretchReach is true for nearby open-sea candidate within land budget', () => {
  const doc = flatDoc(30, 30)
  assert.equal(
    isWithinStrategicOverstretchReach({
      origin: { x: 10, y: 10 },
      candidateCell: { x: 12, y: 10 },
      worldDocument: doc,
      roads: [],
      colonistSettings: { threeDayHaulDistance: 5, landExpeditionRange: 2 },
      expeditionMode: 'open_sea',
    }),
    true,
  )
})

test('isWithinStrategicOverstretchReach is false for far open-sea candidate beyond land budget', () => {
  const doc = flatDoc(40, 40)
  assert.equal(
    isWithinStrategicOverstretchReach({
      origin: { x: 5, y: 5 },
      candidateCell: { x: 35, y: 35 },
      worldDocument: doc,
      roads: [],
      colonistSettings: { threeDayHaulDistance: 5, landExpeditionRange: 2 },
      expeditionMode: 'open_sea',
    }),
    false,
  )
})

test('land hops use road and overland edges but ignore sail-only connectivity', () => {
  const doc = flatDoc(20, 20)
  // Fill sail mask so open-sea candidates could exist; settlements are far apart for overland.
  doc.sailMask.fill(1)
  const settlements = [
    { id: 'a', x: 2, y: 2, population: 100, status: 'living', maritimeRole: 'port' },
    { id: 'b', x: 17, y: 2, population: 100, status: 'living', maritimeRole: 'port' },
    { id: 'c', x: 4, y: 2, population: 100, status: 'living', maritimeRole: 'none' },
  ]
  const adjNoRoad = buildLandAdminAdjacency({
    settlements,
    worldDocument: doc,
    threeDayHaulDistance: 3,
    roads: [],
    inlandSailExpeditionRange: 12,
  })
  // a–c within overland haul; a–b only via sail → infinite land hops
  assert.ok(landHopsBetween(adjNoRoad, 'a', 'c') < Number.POSITIVE_INFINITY)
  assert.equal(landHopsBetween(adjNoRoad, 'a', 'b'), Number.POSITIVE_INFINITY)

  const adjWithRoad = buildLandAdminAdjacency({
    settlements,
    worldDocument: doc,
    threeDayHaulDistance: 3,
    roads: [
      {
        mode: 'land',
        settlementIds: ['a', 'b'],
        cells: Array.from({ length: 16 }, (_, i) => ({ x: 2 + i, y: 2 })),
      },
    ],
    inlandSailExpeditionRange: 12,
  })
  assert.equal(landHopsBetween(adjWithRoad, 'a', 'b'), 1)
})
