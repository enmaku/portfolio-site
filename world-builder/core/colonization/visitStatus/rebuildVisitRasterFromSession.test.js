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
        route: [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
          { x: 3, y: 1 },
        ],
        progressIndex: 2,
        target: { x: 3, y: 1 },
        status: 'completed',
      },
    ],
    roads: [],
    logisticsNodeSurvey: [{ x: 3, y: 1, primaryType: 'coastal', exhausted: false, founded: false }],
  }

  const raster = rebuildVisitRasterFromSession(slice, doc)

  assert.ok(isCellVisited(raster, 1, 1, doc.gridWidth))
  assert.ok(isCellVisited(raster, 3, 1, doc.gridWidth))
})
