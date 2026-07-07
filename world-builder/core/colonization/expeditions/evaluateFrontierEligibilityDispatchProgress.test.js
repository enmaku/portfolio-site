import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateFrontierEligibility } from './evaluateFrontierEligibility.js'
import { evaluateFrontierEligibilityWithDispatchProgress } from './evaluateFrontierEligibilityDispatchProgress.js'

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

test('evaluateFrontierEligibilityWithDispatchProgress matches sync eligibility', async () => {
  const doc = makeLandFrontierDoc()
  const visitRaster = new Uint8Array(doc.gridWidth * doc.gridHeight)
  visitRaster[2 * doc.gridWidth + 3] = 1
  visitRaster[2 * doc.gridWidth + 2] = 1
  visitRaster[2 * doc.gridWidth + 4] = 1
  visitRaster[1 * doc.gridWidth + 3] = 1
  visitRaster[3 * doc.gridWidth + 3] = 1
  const colonistSettings = {
    threeDayHaulDistance: 50,
    inlandSailExpeditionRange: 3,
    openSeaExpeditionRange: 8,
    landExpeditionRange: 2,
  }
  const settlement = { id: 'rim', x: 3, y: 2, population: 120 }
  const baseParams = {
    settlement,
    doc,
    visitRaster,
    colonistSettings,
    roadCellMask: null,
  }

  const sync = evaluateFrontierEligibility(baseParams)
  const asyncResult = await evaluateFrontierEligibilityWithDispatchProgress({
    ...baseParams,
    progressHooks: {
      reportSync() {},
      yieldToUi: async () => {},
    },
  })

  assert.deepStrictEqual(asyncResult, sync)
})
