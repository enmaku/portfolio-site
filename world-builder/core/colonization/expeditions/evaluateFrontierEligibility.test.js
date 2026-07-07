import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDryLandTraversableMask } from './buildDryLandTraversableMask.js'
import { evaluateFrontierEligibility } from './evaluateFrontierEligibility.js'

function makeLandFrontierDoc() {
  const gridWidth = 8
  const gridHeight = 6
  const cellCount = gridWidth * gridHeight
  const elevation = new Float32Array(cellCount).fill(0.65)
  return {
    geographySeed: 10,
    gridWidth,
    gridHeight,
    fields: { elevation },
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: new Uint8Array(cellCount),
    coastalNodes: [],
    biomes: new Uint8Array(cellCount),
  }
}

test('evaluateFrontierEligibility excludes interior settlement with fully visited haul-shed', () => {
  const doc = makeLandFrontierDoc()
  const visitRaster = new Uint8Array(doc.gridWidth * doc.gridHeight).fill(1)
  const dryLandMask = buildDryLandTraversableMask(doc)
  for (let i = 0; i < dryLandMask.length; i += 1) {
    if (dryLandMask[i] === 1) visitRaster[i] = 1
  }

  const eligible = evaluateFrontierEligibility({
    settlement: { id: 'interior', x: 3, y: 2, population: 100 },
    doc,
    visitRaster,
    colonistSettings: {
      threeDayHaulDistance: 50,
      inlandSailExpeditionRange: 3,
      openSeaExpeditionRange: 8,
      landExpeditionRange: 2,
    },
    roadCellMask: null,
  })

  assert.strictEqual(eligible.some((entry) => entry.pool === 'land'), false)
})

test('evaluateFrontierEligibility includes rim settlement with unvisited haul-shed cell', () => {
  const doc = makeLandFrontierDoc()
  const visitRaster = new Uint8Array(doc.gridWidth * doc.gridHeight)
  visitRaster[2 * doc.gridWidth + 3] = 1
  visitRaster[2 * doc.gridWidth + 2] = 1
  visitRaster[2 * doc.gridWidth + 4] = 1
  visitRaster[1 * doc.gridWidth + 3] = 1
  visitRaster[3 * doc.gridWidth + 3] = 1

  const eligible = evaluateFrontierEligibility({
    settlement: { id: 'rim', x: 3, y: 2, population: 120 },
    doc,
    visitRaster,
    colonistSettings: {
      threeDayHaulDistance: 50,
      inlandSailExpeditionRange: 3,
      openSeaExpeditionRange: 8,
      landExpeditionRange: 2,
    },
    roadCellMask: null,
  })

  assert.strictEqual(eligible.some((entry) => entry.pool === 'land'), true)
})
