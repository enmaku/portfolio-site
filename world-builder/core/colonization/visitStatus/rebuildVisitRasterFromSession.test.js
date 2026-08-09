import assert from 'node:assert/strict'
import test from 'node:test'
import {
  rebuildVisitRasterFromSession,
  rebuildVisitRasterFromSessionAsync,
} from './rebuildVisitRasterFromSession.js'
import { isCellVisited } from './visitRaster.js'

test('rebuildVisitRasterFromSession seeds haul sheds for settlements and marks expedition routes', () => {
  const doc = {
    gridWidth: 8,
    gridHeight: 8,
    movementCost: new Float32Array(64).fill(1),
  }
  const slice = {
    colonistSettings: { threeDayHaulDistance: 2 },
    settlements: [{ id: 's1', x: 1, y: 1, status: 'living' }],
    expeditions: [
      {
        id: 'e1',
        settlementId: 's1',
        mode: 'land',
        bearing: 0.5,
        route: [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
          { x: 3, y: 1 },
        ],
        progressIndex: 2,
        status: 'completed',
        endReason: 'survey_complete',
      },
    ],
    roads: [],
    logisticsNodeSurvey: [{ x: 3, y: 1, primaryType: 'coastal', exhausted: false, founded: false }],
  }

  const raster = rebuildVisitRasterFromSession(slice, doc)

  assert.ok(isCellVisited(raster, 1, 1, doc.gridWidth))
  assert.ok(isCellVisited(raster, 3, 1, doc.gridWidth))
})

test('rebuildVisitRasterFromSession marks corridor fog for persisted founding routes', () => {
  const doc = {
    gridWidth: 8,
    gridHeight: 8,
    movementCost: new Float32Array(64).fill(1),
  }
  const slice = {
    colonistSettings: { threeDayHaulDistance: 2 },
    settlements: [
      { id: 's1', x: 1, y: 1, status: 'living' },
      { id: 's2', x: 5, y: 5, status: 'living' },
    ],
    expeditions: [],
    roads: [
      {
        mode: 'land',
        settlementIds: ['s1', 's2'],
        cells: [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
          { x: 3, y: 3 },
          { x: 4, y: 4 },
          { x: 5, y: 5 },
        ],
      },
    ],
    logisticsNodeSurvey: [],
  }

  const raster = rebuildVisitRasterFromSession(slice, doc)

  assert.ok(isCellVisited(raster, 3, 2, doc.gridWidth), 'road corridor neighbor should be visited')
  assert.ok(!isCellVisited(raster, 1, 6, doc.gridWidth), 'cells away from road corridor stay fogged')
})

test('rebuildVisitRasterFromSessionAsync yields through settlements, expeditions, and roads', async () => {
  const doc = {
    gridWidth: 8,
    gridHeight: 8,
    movementCost: new Float32Array(64).fill(1),
  }
  const slice = {
    colonistSettings: { threeDayHaulDistance: 2 },
    settlements: [
      { id: 's1', x: 1, y: 1, status: 'living' },
      { id: 's2', x: 5, y: 5, status: 'living' },
      { id: 's3', x: 3, y: 3, status: 'living' },
    ],
    expeditions: [
      {
        id: 'e1',
        settlementId: 's1',
        mode: 'land',
        bearing: 0.5,
        route: [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
        ],
        progressIndex: 1,
        status: 'completed',
        endReason: 'survey_complete',
      },
      {
        id: 'e2',
        settlementId: 's2',
        mode: 'land',
        bearing: 1,
        route: [
          { x: 5, y: 5 },
          { x: 4, y: 5 },
        ],
        progressIndex: 1,
        status: 'completed',
        endReason: 'survey_complete',
      },
    ],
    roads: [
      {
        mode: 'land',
        settlementIds: ['s1', 's3'],
        cells: [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
          { x: 3, y: 3 },
        ],
      },
    ],
    logisticsNodeSurvey: [],
  }

  /** @type {Array<{ type: string, substepIndex: number, itemIndex?: number, itemCount?: number }>} */
  const events = []
  let yieldCount = 0
  const raster = await rebuildVisitRasterFromSessionAsync(slice, doc, {
    yieldToUi: async () => {
      yieldCount += 1
    },
    onVisitedSubstep(payload) {
      events.push(payload)
    },
  })

  assert.ok(raster instanceof Uint8Array)
  assert.ok(isCellVisited(raster, 5, 5, doc.gridWidth))
  assert.ok(isCellVisited(raster, 2, 1, doc.gridWidth))
  assert.ok(isCellVisited(raster, 2, 2, doc.gridWidth))

  const starts = events.filter((event) => event.type === 'substep-start').map((e) => e.substepIndex)
  const completes = events
    .filter((event) => event.type === 'substep-complete')
    .map((e) => e.substepIndex)
  assert.deepStrictEqual(starts, [0, 1, 2])
  assert.deepStrictEqual(completes, [0, 1, 2])

  const settlementItems = events.filter(
    (event) => event.type === 'item-progress' && event.substepIndex === 0,
  )
  assert.deepStrictEqual(
    settlementItems.map((event) => ({ itemIndex: event.itemIndex, itemCount: event.itemCount })),
    [
      { itemIndex: 0, itemCount: 3 },
      { itemIndex: 1, itemCount: 3 },
      { itemIndex: 2, itemCount: 3 },
      { itemIndex: 3, itemCount: 3 },
    ],
  )

  const expeditionItems = events.filter(
    (event) => event.type === 'item-progress' && event.substepIndex === 1,
  )
  assert.deepStrictEqual(
    expeditionItems.map((event) => ({ itemIndex: event.itemIndex, itemCount: event.itemCount })),
    [
      { itemIndex: 0, itemCount: 2 },
      { itemIndex: 1, itemCount: 2 },
      { itemIndex: 2, itemCount: 2 },
    ],
  )

  const roadItems = events.filter(
    (event) => event.type === 'item-progress' && event.substepIndex === 2,
  )
  assert.deepStrictEqual(
    roadItems.map((event) => ({ itemIndex: event.itemIndex, itemCount: event.itemCount })),
    [
      { itemIndex: 0, itemCount: 1 },
      { itemIndex: 1, itemCount: 1 },
    ],
  )

  assert.ok(yieldCount >= events.filter((event) => event.type === 'item-progress').length)
})
