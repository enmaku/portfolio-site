import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { applyPopulationCollapse } from './applyPopulationCollapse.js'
import {
  COLONIZATION_PHASE_RUNNING,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'

function geographyDoc() {
  const cellCount = 16
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[2 * 4 + 1] = 1

  return {
    geographySeed: 42,
    gridWidth: 4,
    gridHeight: 4,
    arableRaster: new Float32Array(cellCount).fill(1),
    timberRaster: new Float32Array(cellCount).fill(1),
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.6),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask,
  }
}

test('applyPopulationCollapse returns slice and raster with shared reference', async () => {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_RUNNING
  slice.epoch = 0
  slice.settlements = [
    {
      id: 's1',
      x: 1,
      y: 2,
      population: 50,
      status: 'living',
      tier: 'outpost',
    },
  ]
  slice.primaryClaim = {
    s1: [{ x: 1, y: 2 }, { x: 2, y: 2 }],
  }

  const doc = geographyDoc()
  const result = await applyPopulationCollapse(slice, doc)

  assert.ok(result.slice)
  assert.ok(result.populationCollapseRaster instanceof Float32Array)
  assert.strictEqual(result.slice.populationCollapseRaster, result.populationCollapseRaster)
  assert.strictEqual(result.populationCollapseRaster.length, 16)
  assert.ok(result.populationCollapseRaster.some((value) => value > 0))
})
