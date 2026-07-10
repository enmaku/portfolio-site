import assert from 'node:assert/strict'
import test from 'node:test'
import {
  needsColonizationDerivedOverlayRehydration,
  rehydrateColonizationDerivedOverlays,
  rehydrateColonizationDerivedOverlaysAsync,
} from './rehydrateColonizationDerivedOverlays.js'
import { COLONIZATION_PHASE_RUNNING } from './createDefaultColonizationSlice.js'

test('rehydrateColonizationDerivedOverlays rebuilds visit and collapse rasters from session history', () => {
  const doc = {
    gridWidth: 4,
    gridHeight: 4,
    movementCost: new Float32Array(16).fill(1),
    geographySeed: 1,
    fields: {
      elevation: Float32Array.from([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]),
    },
    arableRaster: new Float32Array(16).fill(0),
    riverCorridorMask: new Uint8Array(16),
  }
  const slice = {
    colonizationPhase: COLONIZATION_PHASE_RUNNING,
    epoch: 1,
    colonistSettings: {
      threeDayHaulDistance: 2,
      startingPopulation: 100,
      yieldModifier: 'typical',
    },
    foundingLanding: { x: 1, y: 1 },
    historyLog: [{ kind: 'founding', epoch: 0 }],
    settlements: [{ id: 's1', x: 1, y: 1, tier: 'outpost', population: 100, status: 'living' }],
    realmId: 'realm-1',
    primaryClaim: { s1: [{ x: 1, y: 1 }] },
    populationCollapseRaster: null,
    notableFigures: [],
    visitedCells: null,
    expeditions: [],
    frontierExhausted: false,
    roads: [],
    logisticsNodeSurvey: [],
  }

  const rehydrated = rehydrateColonizationDerivedOverlays(slice, doc)

  assert.ok(rehydrated.visitedCells instanceof Uint8Array)
  assert.strictEqual(rehydrated.visitedCells.length, 16)
  assert.ok(rehydrated.populationCollapseRaster instanceof Float32Array)
  assert.strictEqual(rehydrated.populationCollapseRaster.length, 16)
  assert.ok(rehydrated.primaryClaim.s1?.length > 0)
  assert.ok(Array.isArray(rehydrated.logisticsNodeSurvey))
})

test('rehydrateColonizationDerivedOverlays preserves in-memory rasters during an active session', () => {
  const doc = {
    gridWidth: 2,
    gridHeight: 2,
    movementCost: new Float32Array(4).fill(1),
  }
  const visit = new Uint8Array([1, 0, 0, 0])
  const collapse = new Float32Array([0, 12, 0, 0])
  const slice = {
    colonizationPhase: COLONIZATION_PHASE_RUNNING,
    colonistSettings: {
      threeDayHaulDistance: 2,
      startingPopulation: 100,
      yieldModifier: 'typical',
    },
    settlements: [],
    visitedCells: visit,
    populationCollapseRaster: collapse,
    historyLog: [],
    primaryClaim: {},
    notableFigures: [],
    expeditions: [],
    roads: [],
    logisticsNodeSurvey: [
      {
        x: 0,
        y: 0,
        primaryType: 'surplus_basin',
        tags: { surplus_basin: 0.8 },
        exhausted: false,
        founded: false,
      },
    ],
    epoch: 1,
    foundingLanding: null,
    realmId: null,
    frontierExhausted: false,
  }

  const rehydrated = rehydrateColonizationDerivedOverlays(slice, doc)

  assert.strictEqual(rehydrated, slice)
})

test('needsColonizationDerivedOverlayRehydration is false when rasters are already present', () => {
  const doc = {
    gridWidth: 2,
    gridHeight: 2,
    movementCost: new Float32Array(4).fill(1),
  }
  const slice = {
    colonizationPhase: COLONIZATION_PHASE_RUNNING,
    colonistSettings: {
      threeDayHaulDistance: 2,
      startingPopulation: 100,
      yieldModifier: 'typical',
    },
    settlements: [],
    visitedCells: new Uint8Array(4),
    populationCollapseRaster: new Float32Array(4),
    historyLog: [],
    primaryClaim: {},
    notableFigures: [],
    expeditions: [],
    roads: [],
    logisticsNodeSurvey: [
      {
        x: 0,
        y: 0,
        primaryType: 'surplus_basin',
        tags: { surplus_basin: 0.8 },
        exhausted: false,
        founded: false,
      },
    ],
    epoch: 1,
    foundingLanding: null,
    realmId: null,
    frontierExhausted: false,
  }

  assert.strictEqual(needsColonizationDerivedOverlayRehydration(slice, doc), false)
})

test('rehydrateColonizationDerivedOverlaysAsync reports progress through steps', async () => {
  const doc = {
    gridWidth: 4,
    gridHeight: 4,
    movementCost: new Float32Array(16).fill(1),
    geographySeed: 1,
    fields: {
      elevation: Float32Array.from([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]),
    },
    arableRaster: new Float32Array(16).fill(0),
    riverCorridorMask: new Uint8Array(16),
  }
  const slice = {
    colonizationPhase: COLONIZATION_PHASE_RUNNING,
    epoch: 1,
    colonistSettings: {
      threeDayHaulDistance: 2,
      startingPopulation: 100,
      yieldModifier: 'typical',
    },
    foundingLanding: { x: 1, y: 1 },
    historyLog: [{ kind: 'founding', epoch: 0 }],
    settlements: [{ id: 's1', x: 1, y: 1, tier: 'outpost', population: 100, status: 'living' }],
    realmId: 'realm-1',
    primaryClaim: { s1: [{ x: 1, y: 1 }] },
    populationCollapseRaster: null,
    notableFigures: [],
    visitedCells: null,
    expeditions: [],
    frontierExhausted: false,
    roads: [],
    logisticsNodeSurvey: [],
  }

  const percents = []
  /** @type {number[]} */
  const visitedSubstepStarts = []
  /** @type {number[]} */
  const visitedSubstepCompletes = []
  let lastActiveVisitedSubstep = -1
  let lastCompletedVisitedSubstep = -1
  /** @type {Array<{ itemIndex: number, itemCount: number, activeVisitedSubstepIndex: number }>} */
  const visitedItemProgress = []
  const rehydrated = await rehydrateColonizationDerivedOverlaysAsync(slice, doc, {
    yieldToUi: async () => {},
    handlers: {
      onProgress(progress) {
        percents.push(progress.percent)
        if (
          progress.activeVisitedSubstepIndex >= 0 &&
          progress.activeVisitedSubstepIndex !== lastActiveVisitedSubstep
        ) {
          lastActiveVisitedSubstep = progress.activeVisitedSubstepIndex
          visitedSubstepStarts.push(progress.activeVisitedSubstepIndex)
        }
        if (
          progress.completedVisitedSubstepIndex >= 0 &&
          progress.completedVisitedSubstepIndex !== lastCompletedVisitedSubstep
        ) {
          lastCompletedVisitedSubstep = progress.completedVisitedSubstepIndex
          visitedSubstepCompletes.push(progress.completedVisitedSubstepIndex)
        }
        if (progress.visitedSubstepItemCount > 0) {
          visitedItemProgress.push({
            itemIndex: progress.visitedSubstepItemIndex,
            itemCount: progress.visitedSubstepItemCount,
            activeVisitedSubstepIndex: progress.activeVisitedSubstepIndex,
          })
        }
      },
    },
  })

  assert.ok(rehydrated.visitedCells instanceof Uint8Array)
  assert.ok(rehydrated.populationCollapseRaster instanceof Float32Array)
  assert.ok(percents.some((percent) => percent > 0))
  assert.strictEqual(percents.at(-1), 100)
  assert.deepStrictEqual(visitedSubstepStarts, [0, 1, 2])
  assert.deepStrictEqual(visitedSubstepCompletes, [0, 1, 2])
  assert.ok(
    visitedItemProgress.some(
      (row) => row.activeVisitedSubstepIndex === 0 && row.itemIndex === 1 && row.itemCount === 1,
    ),
  )
})
