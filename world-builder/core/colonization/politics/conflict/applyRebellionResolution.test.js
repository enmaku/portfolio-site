import assert from 'node:assert/strict'
import test from 'node:test'
import { applyRebellionResolution } from './applyRebellionResolution.js'
import {
  HISTORY_KIND_REBELLION_END,
  HISTORY_KIND_REBELLION_START,
} from '../historyKinds.js'
import { REBELLION_TAX_DRAIN_CP_THRESHOLD } from './conflictConstants.js'

function edge(partial) {
  return {
    id: partial.id,
    fromSettlementId: partial.fromSettlementId,
    toSettlementId: partial.toSettlementId,
    mode: 'road',
    haulDistanceFraction: 1,
    capacityLb: 1,
    transportCostCpPerLb: 1,
    directionalFrictionAtoB: 1,
    directionalFrictionBtoA: 1,
  }
}

const reach = { overland: 20, road: 20, inlandWater: 20, openSea: 20 }

function empireSlice() {
  return {
    epoch: 20,
    historyLog: [],
    membershipCooldown: [],
    settlements: [
      {
        id: 'cap',
        factionId: 'empire',
        status: 'living',
        population: 4000,
        tier: 'city',
      },
      {
        id: 'vassal',
        factionId: 'empire',
        status: 'living',
        population: 1200,
        tier: 'town',
        vassalLiegeSettlementId: 'cap',
      },
    ],
    factions: [
      {
        id: 'empire',
        capitalSettlementId: 'cap',
        settlementIds: ['cap', 'vassal'],
        status: 'active',
        emergedEpoch: 0,
      },
    ],
    warExhaustionBySettlementId: {},
    belligerentTradeBlocks: [],
    recentConquestBySettlementId: {
      vassal: { conqueredEpoch: 18, priorFactionId: 'old' },
    },
  }
}

test('tax drain and recent conquest can arm a breakaway rebellion', () => {
  const slice = empireSlice()
  const edges = [edge({ id: 'cap-vassal', fromSettlementId: 'cap', toSettlementId: 'vassal' })]
  const result = applyRebellionResolution({
    slice,
    capacityBySettlementId: { cap: 100, vassal: 5000 },
    candidateEdges: edges,
    strategicReachHaulFractions: reach,
    taxDrainCpBySettlementId: { vassal: -REBELLION_TAX_DRAIN_CP_THRESHOLD },
  })
  assert.ok(result.events.some((e) => e.kind === HISTORY_KIND_REBELLION_START))
  assert.ok(result.events.some((e) => e.kind === HISTORY_KIND_REBELLION_END))
  assert.equal(result.fought, true)
  // Strong rebel walls beat weak loyalist projection → rebel victory exit
  const vassal = result.slice.settlements.find((s) => s.id === 'vassal')
  assert.notEqual(vassal.factionId, 'empire')
})

test('loyalist victory keeps membership with refractory', () => {
  const slice = empireSlice()
  const edges = [edge({ id: 'cap-vassal', fromSettlementId: 'cap', toSettlementId: 'vassal' })]
  const result = applyRebellionResolution({
    slice,
    capacityBySettlementId: { cap: 8000, vassal: 100 },
    candidateEdges: edges,
    strategicReachHaulFractions: reach,
    taxDrainCpBySettlementId: { vassal: -500 },
  })
  assert.equal(result.events.find((e) => e.kind === HISTORY_KIND_REBELLION_END)?.winner, 'loyalist')
  assert.equal(result.slice.settlements.find((s) => s.id === 'vassal').factionId, 'empire')
  assert.ok(result.slice.membershipCooldown.some((c) => c.subjectId === 'vassal'))
})

test('zero loyalist projection yields breakaway without war exhaustion', () => {
  const slice = empireSlice()
  const result = applyRebellionResolution({
    slice,
    capacityBySettlementId: { cap: 5000, vassal: 800 },
    candidateEdges: [],
    strategicReachHaulFractions: reach,
    taxDrainCpBySettlementId: { vassal: -500 },
  })
  assert.equal(result.fought, false)
  assert.deepEqual(result.slice.warExhaustionBySettlementId, {})
  assert.notEqual(result.slice.settlements.find((s) => s.id === 'vassal').factionId, 'empire')
})
