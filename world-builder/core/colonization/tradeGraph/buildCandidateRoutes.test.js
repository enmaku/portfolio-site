import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCandidateTradeGraph,
  computeSailPathDistances,
} from './buildCandidateRoutes.js'
import {
  DIRECTIONAL_FRICTION_DOWNHILL,
  DIRECTIONAL_FRICTION_UPHILL,
  ROUTE_CAPACITY_LB_PER_PERSON_DAY,
} from '../../economy/tradeGraph/routeEconomics.js'
import { SEA_LEVEL } from '../../biomeIds.js'

const LAND_ELEVATION = SEA_LEVEL + 0.08

function edgesForPair(graph, a, b) {
  return graph.edges.filter(
    (edge) =>
      (edge.fromSettlementId === a && edge.toSettlementId === b) ||
      (edge.fromSettlementId === b && edge.toSettlementId === a),
  )
}

test('overland candidates form only within one three-day haul budget', () => {
  const graph = buildCandidateTradeGraph({
    settlements: [
      { id: 'a', x: 1, y: 1, population: 100 },
      { id: 'b', x: 5, y: 1, population: 100 },
      { id: 'c', x: 25, y: 1, population: 100 },
    ],
    gridWidth: 40,
    gridHeight: 8,
    threeDayHaulDistance: 6,
  })

  const abOverland = edgesForPair(graph, 'a', 'b').filter((e) => e.mode === 'overland')
  const acOverland = edgesForPair(graph, 'a', 'c').filter((e) => e.mode === 'overland')

  assert.strictEqual(abOverland.length, 1)
  assert.strictEqual(acOverland.length, 0)
})

test('continuous road path supersedes ordinary overland for that pair', () => {
  const roads = [
    {
      cells: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
        { x: 5, y: 1 },
      ],
      settlementIds: ['a', 'b'],
      mode: 'land',
    },
  ]

  const graph = buildCandidateTradeGraph({
    settlements: [
      { id: 'a', x: 1, y: 1, population: 100 },
      { id: 'b', x: 5, y: 1, population: 100 },
    ],
    gridWidth: 12,
    gridHeight: 4,
    threeDayHaulDistance: 10,
    roads,
  })

  const pair = edgesForPair(graph, 'a', 'b')
  assert.strictEqual(pair.length, 1)
  assert.strictEqual(pair[0].mode, 'road')
  assert.ok(!pair.some((e) => e.mode === 'overland'))
})

test('inland-water candidate requires a sail-overlay path within inland range', () => {
  const width = 12
  const height = 6
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(SEA_LEVEL - 0.1)
  const sailMask = new Uint8Array(cellCount)

  for (let y = 1; y <= 4; y += 1) {
    for (let x = 0; x < width; x += 1) {
      sailMask[y * width + x] = 1
    }
  }

  const settlements = [
    { id: 'a', x: 1, y: 3, population: 100, maritimeRole: 'inland_sail' },
    { id: 'b', x: 9, y: 3, population: 100, maritimeRole: 'inland_sail' },
  ]

  const reachable = buildCandidateTradeGraph({
    settlements,
    gridWidth: width,
    gridHeight: height,
    threeDayHaulDistance: 20,
    inlandSailExpeditionRange: 30,
    elevation,
    sailMask,
  })
  const tooFar = buildCandidateTradeGraph({
    settlements,
    gridWidth: width,
    gridHeight: height,
    threeDayHaulDistance: 20,
    inlandSailExpeditionRange: 2,
    elevation,
    sailMask,
  })

  assert.strictEqual(edgesForPair(reachable, 'a', 'b').filter((e) => e.mode === 'inlandWater').length, 1)
  assert.strictEqual(edgesForPair(tooFar, 'a', 'b').filter((e) => e.mode === 'inlandWater').length, 0)
})

test('inland-water candidates do not cross disconnected sail basins', () => {
  const width = 12
  const height = 4
  const cellCount = width * height
  const sailMask = new Uint8Array(cellCount)
  for (let x = 0; x <= 3; x += 1) sailMask[1 * width + x] = 1
  for (let x = 8; x <= 11; x += 1) sailMask[1 * width + x] = 1

  const graph = buildCandidateTradeGraph({
    settlements: [
      { id: 'a', x: 1, y: 1, population: 100, maritimeRole: 'inland_sail' },
      { id: 'b', x: 10, y: 1, population: 100, maritimeRole: 'inland_sail' },
    ],
    gridWidth: width,
    gridHeight: height,
    threeDayHaulDistance: 20,
    inlandSailExpeditionRange: 40,
    sailMask,
  })

  assert.strictEqual(edgesForPair(graph, 'a', 'b').filter((e) => e.mode === 'inlandWater').length, 0)
})

test('every pair of living port settlements gets an open-sea candidate', () => {
  const graph = buildCandidateTradeGraph({
    settlements: [
      { id: 'p1', x: 1, y: 1, population: 100, maritimeRole: 'port' },
      { id: 'p2', x: 30, y: 1, population: 100, maritimeRole: 'port' },
      { id: 'p3', x: 1, y: 30, population: 100, maritimeRole: 'port' },
      { id: 'inland', x: 15, y: 15, population: 100, maritimeRole: 'none' },
    ],
    gridWidth: 40,
    gridHeight: 40,
    threeDayHaulDistance: 6,
  })

  const openSea = graph.edges.filter((e) => e.mode === 'openSea')
  assert.strictEqual(openSea.length, 3)
  assert.strictEqual(edgesForPair(graph, 'p1', 'p2').filter((e) => e.mode === 'openSea').length, 1)
  assert.strictEqual(edgesForPair(graph, 'p1', 'p3').filter((e) => e.mode === 'openSea').length, 1)
  assert.strictEqual(edgesForPair(graph, 'p2', 'p3').filter((e) => e.mode === 'openSea').length, 1)
  assert.strictEqual(edgesForPair(graph, 'p1', 'inland').length, 0)
})

test('open-sea candidate length follows sail overlay around blocked chords', () => {
  const width = 20
  const height = 20
  const sailMask = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < 8; x += 1) sailMask[y * width + x] = 1
  }
  // Land bar blocks the vertical chord at x=3 between the ports.
  for (let x = 0; x <= 5; x += 1) {
    for (let y = 8; y <= 11; y += 1) sailMask[y * width + x] = 0
  }

  const graph = buildCandidateTradeGraph({
    settlements: [
      { id: 'n', x: 3, y: 2, population: 100, maritimeRole: 'port' },
      { id: 's', x: 3, y: 17, population: 100, maritimeRole: 'port' },
    ],
    gridWidth: width,
    gridHeight: height,
    threeDayHaulDistance: 10,
    sailMask,
  })

  const openSea = edgesForPair(graph, 'n', 's').find((e) => e.mode === 'openSea')
  assert.ok(openSea)
  const chordFraction = 15 / 10
  assert.ok(
    openSea.haulDistanceFraction > chordFraction + 0.1,
    `expected detour longer than chord ${chordFraction}, got ${openSea.haulDistanceFraction}`,
  )
})

test('capacity and transport cost apply mode multipliers and directional friction', () => {
  const width = 12
  const height = 4
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(LAND_ELEVATION)
  elevation[1 * width + 5] = LAND_ELEVATION + 1 // b sits far uphill from a

  const graph = buildCandidateTradeGraph({
    settlements: [
      { id: 'a', x: 1, y: 1, population: 400 },
      { id: 'b', x: 5, y: 1, population: 900 },
    ],
    gridWidth: width,
    gridHeight: height,
    threeDayHaulDistance: 6,
    elevation,
  })

  const overland = edgesForPair(graph, 'a', 'b').find((e) => e.mode === 'overland')
  assert.ok(overland)

  const expectedCapacity = ROUTE_CAPACITY_LB_PER_PERSON_DAY * Math.sqrt(400 * 900)
  assert.strictEqual(overland.capacityLb, expectedCapacity)

  const distance = 4 / 6
  assert.ok(Math.abs(overland.transportCostCpPerLb - distance) < 1e-9)

  // a -> b is uphill (harder), b -> a is downhill (easier).
  assert.strictEqual(overland.directionalFrictionAtoB, DIRECTIONAL_FRICTION_UPHILL)
  assert.strictEqual(overland.directionalFrictionBtoA, DIRECTIONAL_FRICTION_DOWNHILL)
})

test('open-sea capacity and transport use open-sea multipliers with neutral friction', () => {
  const graph = buildCandidateTradeGraph({
    settlements: [
      { id: 'p1', x: 0, y: 0, population: 100, maritimeRole: 'port' },
      { id: 'p2', x: 10, y: 0, population: 100, maritimeRole: 'port' },
    ],
    gridWidth: 16,
    gridHeight: 4,
    threeDayHaulDistance: 5,
  })

  const openSea = graph.edges.find((e) => e.mode === 'openSea')
  assert.ok(openSea)
  assert.strictEqual(openSea.capacityLb, ROUTE_CAPACITY_LB_PER_PERSON_DAY * 100 * 10)
  assert.strictEqual(openSea.directionalFrictionAtoB, 1)
  assert.strictEqual(openSea.directionalFrictionBtoA, 1)
  const distance = 10 / 5
  assert.ok(Math.abs(openSea.transportCostCpPerLb - distance * 0.1) < 1e-9)
})

test('candidate set is deterministic for identical inputs', () => {
  const build = () =>
    buildCandidateTradeGraph({
      settlements: [
        { id: 'a', x: 1, y: 1, population: 120, maritimeRole: 'port' },
        { id: 'b', x: 5, y: 1, population: 80, maritimeRole: 'port' },
        { id: 'c', x: 3, y: 3, population: 200 },
      ],
      gridWidth: 16,
      gridHeight: 16,
      threeDayHaulDistance: 8,
      roads: [
        {
          cells: [
            { x: 1, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 3 },
          ],
          settlementIds: ['a', 'c'],
          mode: 'land',
        },
      ],
    })

  assert.deepStrictEqual(build(), build())
})

test('open-sea early-exit distances match full sail flood for the port set', () => {
  const width = 24
  const height = 24
  const sailMask = new Uint8Array(width * height).fill(1)
  for (let y = 8; y <= 11; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (x < 6 || x > 17) continue
      sailMask[y * width + x] = 0
    }
  }

  const ports = [
    { x: 2, y: 2 },
    { x: 21, y: 2 },
    { x: 2, y: 21 },
    { x: 21, y: 21 },
  ]
  const portIndices = ports.map((p) => p.y * width + p.x)
  const origin = portIndices[0]

  const early = computeSailPathDistances(
    origin,
    sailMask,
    width,
    height,
    Number.POSITIVE_INFINITY,
    { targetIndices: portIndices },
  )
  const full = computeSailPathDistances(origin, sailMask, width, height, Number.POSITIVE_INFINITY)

  for (const index of portIndices) {
    assert.ok(Number.isFinite(early[index]))
    assert.strictEqual(early[index], full[index])
  }

  const earlyEdges = buildCandidateTradeGraph({
    settlements: ports.map((p, i) => ({
      id: `p${i}`,
      x: p.x,
      y: p.y,
      population: 100,
      maritimeRole: 'port',
    })),
    gridWidth: width,
    gridHeight: height,
    threeDayHaulDistance: 10,
    sailMask,
  }).edges.filter((e) => e.mode === 'openSea')

  assert.strictEqual(earlyEdges.length, 6)
  for (const edge of earlyEdges) {
    assert.ok(edge.haulDistanceFraction > 0)
  }
})

test('land modes omit water edges and match filtering an all-mode graph', () => {
  const width = 16
  const height = 8
  const cellCount = width * height
  const elevation = new Float32Array(cellCount).fill(SEA_LEVEL - 0.1)
  const sailMask = new Uint8Array(cellCount).fill(1)
  const settlements = [
    { id: 'a', x: 1, y: 1, population: 100, maritimeRole: 'port' },
    { id: 'b', x: 5, y: 1, population: 100, maritimeRole: 'port' },
    { id: 'c', x: 9, y: 1, population: 100, maritimeRole: 'inland_sail' },
  ]
  const roads = [
    {
      cells: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
        { x: 5, y: 1 },
      ],
      settlementIds: ['a', 'b'],
      mode: 'land',
    },
  ]
  const base = {
    settlements,
    gridWidth: width,
    gridHeight: height,
    threeDayHaulDistance: 20,
    inlandSailExpeditionRange: 40,
    elevation,
    sailMask,
    roads,
  }

  const land = buildCandidateTradeGraph({ ...base, modes: 'land' })
  const all = buildCandidateTradeGraph({ ...base, modes: 'all' })
  const filtered = all.edges.filter((e) => e.mode === 'road' || e.mode === 'overland')

  assert.ok(land.edges.every((e) => e.mode === 'road' || e.mode === 'overland'))
  assert.ok(!land.edges.some((e) => e.mode === 'openSea' || e.mode === 'inlandWater'))
  assert.deepStrictEqual(
    land.edges.map((e) => e.id).sort(),
    filtered.map((e) => e.id).sort(),
  )
})
