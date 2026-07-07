import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { beginColonizationCommit } from './beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'
import { runColonizationEpochStep } from './runColonizationEpochStep.js'

function richGeographyDoc() {
  const cellCount = 16
  return {
    geographySeed: 7,
    gridWidth: 4,
    gridHeight: 4,
    arableRaster: new Float32Array(cellCount).fill(2),
    timberRaster: new Float32Array(cellCount).fill(2),
    fields: {
      elevation: new Float32Array(cellCount).fill(0.5),
      temperature: new Float32Array(cellCount).fill(0.5),
      rainfall: new Float32Array(cellCount).fill(0.6),
      drainage: new Float32Array(cellCount).fill(0.2),
      salinity: new Float32Array(cellCount).fill(0.1),
    },
    biomes: new Uint8Array(cellCount).fill(BIOMES.GRASSLAND),
    lakeMask: new Uint8Array(cellCount),
    riverCorridorMask: Uint8Array.from({ length: cellCount }, (_, i) => (i === 5 ? 1 : 0)),
  }
}

function commitRunningSlice() {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 1 }
  slice.colonistSettings.startingPopulation = 20
  slice.colonistSettings.threeDayHaulDistance = 2
  return beginColonizationCommit(slice, richGeographyDoc())
}

test('runColonizationEpochStep reports progress through phases and commit finalize', async () => {
  const running = commitRunningSlice()
  running.logisticsNodeSurvey = (running.logisticsNodeSurvey ?? []).map((entry) => ({
    ...entry,
    exhausted: true,
  }))
  /** @type {number[]} */
  const percents = []

  const result = await runColonizationEpochStep(running, richGeographyDoc(), {
    yieldToUi: async () => {},
    handlers: {
      onProgress(progress) {
        percents.push(progress.percent)
      },
    },
  })

  assert.strictEqual(result.ran, true)
  assert.strictEqual(result.slice.epoch, 1)
  assert.ok(percents.length > 0)
  assert.strictEqual(percents.at(-1), 88)
})

test('runColonizationEpochStep reports dispatch and advance network item progress', async () => {
  const running = commitRunningSlice()
  /** @type {Array<{ substepIndex: number, itemIndex: number, itemCount: number }>} */
  const itemProgress = []

  await runColonizationEpochStep(running, richGeographyDoc(), {
    yieldToUi: async () => {},
    handlers: {
      onProgress(progress) {
        if (
          progress.networkSubstepItemCount > 0 &&
          progress.networkSubstepItemIndex > 0 &&
          progress.activeNetworkSubstepIndex >= 0
        ) {
          itemProgress.push({
            substepIndex: progress.activeNetworkSubstepIndex,
            itemIndex: progress.networkSubstepItemIndex,
            itemCount: progress.networkSubstepItemCount,
          })
        }
      },
    },
  })

  const dispatchProgress = itemProgress.filter((entry) => entry.substepIndex === 1)
  const advanceProgress = itemProgress.filter((entry) => entry.substepIndex === 2)
  assert.ok(dispatchProgress.length > 0)
  assert.ok(advanceProgress.length > 0)
})
