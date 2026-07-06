import assert from 'node:assert/strict'
import test from 'node:test'
import { rebuildVisitRasterFromSession } from './rebuildVisitRasterFromSession.js'
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
