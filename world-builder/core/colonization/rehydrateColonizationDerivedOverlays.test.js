import assert from 'node:assert/strict'
import test from 'node:test'
import { rehydrateColonizationDerivedOverlays } from './rehydrateColonizationDerivedOverlays.js'
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
      epochBatch: 50,
    },
    foundingLanding: { x: 1, y: 1 },
    historyLog: [{ kind: 'founding', epoch: 0 }],
    settlements: [{ id: 's1', x: 1, y: 1, tier: 'outpost', population: 100, status: 'living' }],
    committedTips: [],
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
      epochBatch: 50,
    },
    settlements: [],
    visitedCells: visit,
    populationCollapseRaster: collapse,
    historyLog: [],
    committedTips: [],
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
