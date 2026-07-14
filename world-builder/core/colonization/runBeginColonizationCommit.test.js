import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { beginColonizationCommit } from './beginColonizationCommit.js'
import { runBeginColonizationCommit } from './runBeginColonizationCommit.js'
import {
  COLONIZATION_PHASE_RUNNING,
  COLONIZATION_PHASE_SETUP,
  createDefaultColonistSettings,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'

/**
 * @returns {import('../types.js').WorldDocument}
 */
function geographyDoc() {
  const cellCount = 16
  const arableRaster = new Float32Array(cellCount).fill(1)
  const timberRaster = new Float32Array(cellCount).fill(1)
  const riverCorridorMask = new Uint8Array(cellCount)
  riverCorridorMask[2 * 4 + 1] = 1

  return {
    geographySeed: 42,
    gridWidth: 4,
    gridHeight: 4,
    arableRaster,
    timberRaster,
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

/**
 * @returns {import('./createDefaultColonizationSlice.js').ColonizationSlice}
 */
function setupSlice() {
  return {
    ...createDefaultColonizationSlice(),
    colonizationPhase: COLONIZATION_PHASE_SETUP,
    foundingLanding: { x: 1, y: 2 },
    colonistSettings: createDefaultColonistSettings(),
  }
}

test('runBeginColonizationCommit matches beginColonizationCommit output', async () => {
  const slice = setupSlice()
  const doc = geographyDoc()
  const sync = await beginColonizationCommit(slice, doc)
  const asyncResult = await runBeginColonizationCommit(slice, doc, {
    yieldToUi: async () => {},
  })

  assert.strictEqual(asyncResult.committed, true)
  assert.deepStrictEqual(asyncResult.slice, sync)
})

test('runBeginColonizationCommit reports progress through steps and completes at 100%', async () => {
  const slice = setupSlice()
  const doc = geographyDoc()
  const percents = []

  const result = await runBeginColonizationCommit(slice, doc, {
    yieldToUi: async () => {},
    handlers: {
      onProgress(progress) {
        percents.push(progress.percent)
      },
    },
  })

  assert.strictEqual(result.committed, true)
  assert.strictEqual(result.slice.colonizationPhase, COLONIZATION_PHASE_RUNNING)
  assert.ok(percents.length >= 2)
  assert.strictEqual(percents.at(-1), 100)
})

test('runBeginColonizationCommit is a no-op outside setup', async () => {
  const slice = createDefaultColonizationSlice()
  const result = await runBeginColonizationCommit(slice, geographyDoc(), {
    yieldToUi: async () => {},
  })
  assert.strictEqual(result.committed, false)
  assert.strictEqual(result.slice, slice)
})
