import assert from 'node:assert/strict'
import test from 'node:test'
import { BIOMES } from '../biomeIds.js'
import { beginColonizationCommit } from './beginColonizationCommit.js'
import {
  COLONIZATION_PHASE_SETUP,
  createDefaultColonizationSlice,
} from './createDefaultColonizationSlice.js'
import { runColonizationEpochStep } from './runColonizationEpochStep.js'
import { COLONIZATION_EPOCH_PHASES } from './colonizationEpochSteps.js'

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

async function commitRunningSlice() {
  const slice = createDefaultColonizationSlice()
  slice.colonizationPhase = COLONIZATION_PHASE_SETUP
  slice.foundingLanding = { x: 1, y: 1 }
  slice.colonistSettings.startingPopulation = 20
  slice.colonistSettings.threeDayHaulDistance = 2
  return beginColonizationCommit(slice, richGeographyDoc())
}

test('runColonizationEpochStep reports progress through phases and epoch completion', async () => {
  const running = await commitRunningSlice()
  running.logisticsNodeSurvey = (running.logisticsNodeSurvey ?? []).map((entry) => ({
    ...entry,
    exhausted: true,
  }))
  /** @type {number[]} */
  const percents = []
  /** @type {string[]} */
  const phaseIds = []

  const result = await runColonizationEpochStep(running, richGeographyDoc(), {
    yieldToUi: async () => {},
    handlers: {
      onProgress(progress) {
        percents.push(progress.percent)
        if (progress.activePhaseIndex >= 0) {
          const phaseId = COLONIZATION_EPOCH_PHASES[progress.activePhaseIndex]?.id
          if (phaseId && phaseIds.at(-1) !== phaseId) {
            phaseIds.push(phaseId)
          }
        }
      },
    },
  })

  assert.strictEqual(result.ran, true)
  assert.strictEqual(result.slice.epoch, 1)
  assert.ok(percents.length > 0)
  assert.strictEqual(percents.at(-1), 89)
  assert.ok(phaseIds.includes('politics'), `expected politics phase, got ${phaseIds.join(',')}`)
})

test('runColonizationEpochStep runs politics (matches applyEpochStep history)', async () => {
  const { applyEpochStep } = await import('./runColonizationEpochStep.js')
  const running = await commitRunningSlice()
  running.logisticsNodeSurvey = (running.logisticsNodeSurvey ?? []).map((entry) => ({
    ...entry,
    exhausted: true,
  }))
  const doc = richGeographyDoc()
  const fromUi = await runColonizationEpochStep(structuredClone(running), doc, {
    yieldToUi: async () => {},
  })
  const fromApply = await applyEpochStep(structuredClone(running), doc)

  assert.strictEqual(fromUi.ran, true)
  assert.deepEqual(
    fromUi.slice.historyLog.map((entry) => entry.kind),
    fromApply.historyLog.map((entry) => entry.kind),
  )
  assert.deepEqual(fromUi.slice.factions, fromApply.factions)
})

test('runColonizationEpochStep reports dispatch and advance network item progress', async () => {
  const running = await commitRunningSlice()
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

test('runColonizationEpochStep reports trade substep indices in order without stalling progress', async () => {
  const running = await commitRunningSlice()
  running.logisticsNodeSurvey = (running.logisticsNodeSurvey ?? []).map((entry) => ({
    ...entry,
    exhausted: true,
  }))
  /** Add a second settlement so pairwise trade clears. */
  running.settlements = [
    ...running.settlements,
    {
      ...running.settlements[0],
      id: 'trade-peer',
      x: 2,
      y: 2,
      population: 20,
    },
  ]

  /** @type {number[]} */
  const tradeSubstepStarts = []
  let sawProgressAfterTradeStart = false
  let tradePhaseSeen = false

  await runColonizationEpochStep(running, richGeographyDoc(), {
    yieldToUi: async () => {},
    handlers: {
      onProgress(progress) {
        if (progress.activePhaseIndex === 2 && progress.activeTradeSubstepIndex >= 0) {
          tradePhaseSeen = true
          if (
            tradeSubstepStarts.length === 0 ||
            tradeSubstepStarts.at(-1) !== progress.activeTradeSubstepIndex
          ) {
            tradeSubstepStarts.push(progress.activeTradeSubstepIndex)
          }
        }
        if (tradePhaseSeen && progress.activePhaseIndex > 2) {
          sawProgressAfterTradeStart = true
        }
      },
    },
  })

  assert.deepStrictEqual(tradeSubstepStarts, [0, 1, 2, 3, 4, 5])
  assert.strictEqual(sawProgressAfterTradeStart, true)
})

test('runColonizationEpochStep reports politics substep indices in order', async () => {
  const running = await commitRunningSlice()
  /** @type {number[]} */
  const politicsSubstepStarts = []

  await runColonizationEpochStep(running, richGeographyDoc(), {
    yieldToUi: async () => {},
    handlers: {
      onProgress(progress) {
        if (progress.activePhaseIndex === 7 && progress.activePoliticsSubstepIndex >= 0) {
          if (
            politicsSubstepStarts.length === 0 ||
            politicsSubstepStarts.at(-1) !== progress.activePoliticsSubstepIndex
          ) {
            politicsSubstepStarts.push(progress.activePoliticsSubstepIndex)
          }
        }
      },
    },
  })

  assert.deepStrictEqual(politicsSubstepStarts, [0, 1, 2, 3, 4, 5])
})

test('runColonizationEpochStep emits claims control_overlay_refresh with live primaryClaim', async () => {
  const running = await commitRunningSlice()
  running.logisticsNodeSurvey = (running.logisticsNodeSurvey ?? []).map((entry) => ({
    ...entry,
    exhausted: true,
  }))
  /** @type {string[]} */
  const cueTypes = []
  /** @type {object | null} */
  let claimsCue = null

  await runColonizationEpochStep(running, richGeographyDoc(), {
    yieldToUi: async () => {},
    handlers: {
      onMapFx(cue, live) {
        cueTypes.push(cue.type)
        if (cue.type === 'control_overlay_refresh' && cue.phaseId === 'claims') {
          claimsCue = cue
          assert.ok(live.slice)
          assert.ok(live.primaryClaim)
          assert.strictEqual(cue.primaryClaim, live.primaryClaim)
        }
      },
    },
  })

  assert.ok(claimsCue, `expected claims control refresh among ${cueTypes.join(',')}`)
  assert.ok(cueTypes.includes('control_overlay_refresh'))
})

test('runColonizationEpochStep emits politics control_overlay_refresh during membership mutations', async () => {
  const running = await commitRunningSlice()
  running.logisticsNodeSurvey = (running.logisticsNodeSurvey ?? []).map((entry) => ({
    ...entry,
    exhausted: true,
  }))
  /** @type {string[]} */
  const politicsPhases = []

  await runColonizationEpochStep(running, richGeographyDoc(), {
    yieldToUi: async () => {},
    handlers: {
      onMapFx(cue) {
        if (cue.type === 'control_overlay_refresh' && cue.phaseId === 'politics') {
          politicsPhases.push('politics')
        }
      },
    },
  })

  assert.ok(
    politicsPhases.length >= 1,
    'expected at least one politics control overlay refresh',
  )
})

test('runColonizationEpochStep does not blank control overlay during network advance', async () => {
  const running = await commitRunningSlice()
  running.primaryClaim = {
    [running.settlements[0].id]: [{ x: running.settlements[0].x, y: running.settlements[0].y }],
  }
  /** @type {Array<{ phaseId?: string, primaryClaim?: object }>} */
  const controlCues = []

  await runColonizationEpochStep(running, richGeographyDoc(), {
    yieldToUi: async () => {},
    handlers: {
      onMapFx(cue) {
        if (cue.type === 'control_overlay_refresh') {
          controlCues.push(cue)
          if (cue.phaseId === 'network') {
            assert.ok(
              cue.primaryClaim && Object.keys(cue.primaryClaim).length > 0,
              'network control refresh must not use empty primaryClaim',
            )
          }
        }
      },
    },
  })

  assert.equal(
    controlCues.some((cue) => cue.phaseId === 'network'),
    false,
    'founding must not force a mid-network control refresh (claims phase owns claim geometry)',
  )
  const claimsCue = controlCues.find((cue) => cue.phaseId === 'claims')
  assert.ok(claimsCue, 'expected claims-phase control refresh')
  assert.ok(claimsCue.primaryClaim && Object.keys(claimsCue.primaryClaim).length > 0)
})
