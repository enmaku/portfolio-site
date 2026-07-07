import assert from 'node:assert/strict'
import test from 'node:test'
import { planExpeditionDispatch } from './planExpeditionDispatch.js'

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

test('planExpeditionDispatch uses explicit mode without sail coin flip', () => {
  const doc = makeDoc()
  const visitRaster = new Uint8Array(doc.gridWidth * doc.gridHeight)
  const settlement = { id: 's1', x: 4, y: 4 }

  const land = planExpeditionDispatch({
    settlement,
    doc,
    visitRaster,
    geographySeed: 42,
    epoch: 1,
    roadCellMask: null,
    mode: 'land',
  })
  assert.ok(land)
  assert.strictEqual(land.mode, 'land')
})

test('planExpeditionDispatch creates maritime treks without a legal first step at dispatch', () => {
  const doc = makeDoc()
  const visitRaster = new Uint8Array(doc.gridWidth * doc.gridHeight)
  const settlement = { id: 'port', x: 4, y: 4 }

  const maritime = planExpeditionDispatch({
    settlement,
    doc,
    visitRaster,
    geographySeed: 42,
    epoch: 1,
    roadCellMask: null,
    mode: 'open_sea',
  })

  assert.ok(maritime)
  assert.strictEqual(maritime.mode, 'open_sea')
  assert.deepStrictEqual(maritime.route, [{ x: 4, y: 4 }])
})
