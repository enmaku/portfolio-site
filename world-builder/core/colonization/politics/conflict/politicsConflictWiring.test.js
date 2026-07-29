import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPoliticsPhase } from '../applyPoliticsPhase.js'
import { HISTORY_KIND_MAJOR_WAR_END, HISTORY_KIND_MAJOR_WAR_START } from '../historyKinds.js'
import { resetConflictTuning, setConflictTuning } from './conflictTuning.js'

function edge(partial) {
  return {
    id: partial.id,
    fromSettlementId: partial.fromSettlementId,
    toSettlementId: partial.toSettlementId,
    mode: 'road',
    haulDistanceFraction: partial.haulDistanceFraction ?? 0.4,
    capacityLb: 1,
    transportCostCpPerLb: 1,
    directionalFrictionAtoB: 1,
    directionalFrictionBtoA: 1,
  }
}

test.afterEach(() => {
  resetConflictTuning()
})

test('applyPoliticsPhase derives resource scores and can escalate conquest', () => {
  setConflictTuning({
    requireBorderNeighbor: true,
    allowDistantUnalignedConquest: true,
    borderNeighborHaulFraction: 0.6,
    distantUnalignedHaulFraction: 0.75,
    warThreshold: 10,
  })
  const edges = [edge({ id: 'a1-b1', fromSettlementId: 'a1', toSettlementId: 'b1' })]
  const slice = {
    epoch: 20,
    historyLog: [],
    increment3LatchedEpoch: 5,
    colonistSettings: {
      threeDayHaulDistance: 3,
      landExpeditionRange: 4,
      inlandSailExpeditionRange: 4,
      openSeaExpeditionRange: 6,
    },
    roads: [],
    primaryClaim: {},
    settlements: [
      {
        id: 'a1',
        x: 0,
        y: 0,
        factionId: 'fa',
        status: 'living',
        population: 800,
        tier: 'town',
      },
      {
        id: 'b1',
        x: 1,
        y: 0,
        factionId: null,
        status: 'living',
        population: 80,
        tier: 'hamlet',
      },
    ],
    factions: [
      {
        id: 'fa',
        capitalSettlementId: 'a1',
        settlementIds: ['a1'],
        status: 'active',
        emergedEpoch: 0,
      },
    ],
    warExhaustionBySettlementId: {},
    belligerentTradeBlocks: [],
    recentConquestBySettlementId: {},
    rivalryEdges: [],
    tradeRouteState: { candidates: edges, activeFlows: [] },
    externalTradeAccounts: {},
    lastTradeEpochResult: {
      realmBalancesCp: { a1: 0, b1: 0 },
      portTollIncomeCpBySettlementId: { b1: 2_500 },
      factionTaxNetCpBySettlementId: {},
      effectiveDelivered: {},
    },
  }

  const { slice: next, events } = applyPoliticsPhase({
    slice,
    worldDocument: {
      gridWidth: 4,
      gridHeight: 4,
      fields: { elevation: new Float32Array(16).fill(0.5) },
      lakeMask: new Uint8Array(16),
      riverCorridorMask: new Uint8Array(16),
    },
    candidateEdges: edges,
    survivalBySettlementId: {
      a1: { foodSurplus: 5, ok: true },
      b1: { foodSurplus: 2, ok: true },
    },
  })

  assert.ok(events.some((e) => e.kind === HISTORY_KIND_MAJOR_WAR_START))
  assert.ok(events.some((e) => e.kind === HISTORY_KIND_MAJOR_WAR_END))
  assert.equal(next.settlements.find((s) => s.id === 'b1').factionId, 'fa')
})
