import assert from 'node:assert/strict'
import test from 'node:test'
import { planExpeditionDispatchForAssignment } from './planExpeditionDispatch.js'

function makeDoc() {
  const gridWidth = 12
  const gridHeight = 12
  const cellCount = gridWidth * gridHeight
  const elevation = new Float32Array(cellCount).fill(0.65)
  return {
    geographySeed: 42,
    gridWidth,
    gridHeight,
    fields: { elevation },
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    coastalNodes: [],
    biomes: new Uint8Array(cellCount),
  }
}

test('planExpeditionDispatchForAssignment falls back to maritime when land dispatch is rejected', () => {
  const doc = makeDoc()
  const visitRaster = new Uint8Array(doc.gridWidth * doc.gridHeight)
  const assignment = {
    settlementId: 'port',
    population: 100,
    maritimeRole: 'port',
    canDispatchLand: true,
    canDispatchMaritime: true,
  }

  const planned = planExpeditionDispatchForAssignment(assignment, {
    settlement: { id: 'port', x: 4, y: 4 },
    doc,
    visitRaster,
    geographySeed: 42,
    epoch: 1,
    roadCellMask: null,
  })

  assert.ok(planned)
  assert.notStrictEqual(planned.mode, 'land')
})
