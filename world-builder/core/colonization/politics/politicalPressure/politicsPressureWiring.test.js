/**
 * Live politics-phase wiring for political pressure (ADR 0022 order).
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPoliticsPhase } from '../applyPoliticsPhase.js'
import { HISTORY_KIND_ALLIANCE } from '../historyKinds.js'
import { createDefaultColonizationSlice } from '../../createDefaultColonizationSlice.js'
import {
  resetPoliticalPressureTuning,
  setPoliticalPressureTuning,
} from './politicalPressureTuning.js'
import { resetConflictTuning, setConflictTuning } from '../conflict/conflictTuning.js'

test.afterEach(() => {
  resetPoliticalPressureTuning()
  resetConflictTuning()
})

function flatLandDoc(width, height) {
  const n = width * height
  return {
    gridWidth: width,
    gridHeight: height,
    arableRaster: new Float32Array(n).fill(2),
    timberRaster: new Float32Array(n).fill(1),
    fields: {
      elevation: new Float32Array(n).fill(0.6),
      movementCost: new Float32Array(n).fill(1),
    },
    lakeMask: new Uint8Array(n),
    riverCorridorMask: new Uint8Array(n),
  }
}

test('armed pressure joins adjacent free town as alliance before conflict', async () => {
  // Keep conflict quiet so alliance history is attributable to pressure.
  setConflictTuning({ warThreshold: 1_000_000 })

  const slice = createDefaultColonizationSlice()
  slice.epoch = 20
  slice.increment3LatchedEpoch = 5
  slice.settlements = [
    {
      id: 'cap',
      x: 1,
      y: 1,
      factionId: 'fa',
      status: 'living',
      population: 400,
      tier: 'town',
    },
    {
      id: 'member',
      x: 2,
      y: 1,
      factionId: 'fa',
      status: 'living',
      population: 200,
      tier: 'village',
    },
    {
      id: 'free',
      x: 3,
      y: 1,
      factionId: null,
      status: 'living',
      population: 80,
      tier: 'hamlet',
    },
  ]
  slice.factions = [
    {
      id: 'fa',
      capitalSettlementId: 'cap',
      settlementIds: ['cap', 'member'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  slice.politicalPressureArmedBySettlementId = { free: 'fa' }
  slice.politicalPressureStreak = { free: 3 }

  /** @type {string[]} */
  const substepOrder = []
  let allianceSeenBeforeConflictComplete = false
  let sawConflictStart = false

  const { slice: next, events } = await applyPoliticsPhase(
    {
      slice,
      worldDocument: flatLandDoc(8, 8),
      primaryClaim: {
        cap: [
          { x: 1, y: 1 },
          { x: 1, y: 0 },
        ],
        member: [
          { x: 2, y: 1 },
          { x: 2, y: 0 },
        ],
        free: [
          { x: 3, y: 1 },
          { x: 3, y: 0 },
        ],
      },
      survivalBySettlementId: {
        cap: { ok: true, foodSurplus: 2 },
        member: { ok: true, foodSurplus: 1 },
        free: { ok: true, foodSurplus: 1 },
      },
    },
    {
      yieldToUi: async () => {},
      hooks: {
        onPoliticsSubstep(payload) {
          if (payload.type === 'substep-start') {
            substepOrder.push(payload.substepId)
            if (payload.substepId === 'conflict') {
              sawConflictStart = true
            }
          }
        },
      },
    },
  )

  assert.ok(sawConflictStart)
  assert.deepStrictEqual(substepOrder, [
    'latch',
    'membership',
    'pressure',
    'conflict',
    'absorption',
    'palette',
  ])

  const free = next.settlements.find((s) => s.id === 'free')
  assert.equal(free.factionId, 'fa')
  assert.equal(free.isTradePartner, false)
  assert.equal(free.vassalLiegeSettlementId, 'cap')
  assert.ok(
    events.some(
      (e) =>
        e.kind === HISTORY_KIND_ALLIANCE &&
        e.settlementId === 'free' &&
        e.cause === 'join_existing',
    ),
  )
  assert.ok(!events.some((e) => e.kind === 'major_war_start'))
  allianceSeenBeforeConflictComplete = events.some((e) => e.kind === HISTORY_KIND_ALLIANCE)
  assert.equal(allianceSeenBeforeConflictComplete, true)
})

test('trade-partner-only path emits no alliance when pressure disabled', async () => {
  setPoliticalPressureTuning({ enabled: false })
  setConflictTuning({ warThreshold: 1_000_000 })

  const slice = createDefaultColonizationSlice()
  slice.epoch = 22
  slice.increment3LatchedEpoch = 5
  slice.settlements = [
    {
      id: 'cap',
      x: 1,
      y: 1,
      factionId: 'fa',
      status: 'living',
      population: 400,
      tier: 'town',
    },
    {
      id: 'member',
      x: 2,
      y: 1,
      factionId: 'fa',
      status: 'living',
      population: 200,
      tier: 'village',
    },
    {
      id: 'free',
      x: 4,
      y: 1,
      factionId: null,
      status: 'living',
      population: 90,
      tier: 'hamlet',
    },
  ]
  slice.factions = [
    {
      id: 'fa',
      capitalSettlementId: 'cap',
      settlementIds: ['cap', 'member'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  // Soft-power join eligible / bilateral trade — commercial path only.
  slice.softPowerJoinEligibleBySettlementId = { free: 'fa' }
  slice.lastOnMapGoodsBilateralCpByPair = { 'cap|free': 5000, 'member|free': 2000 }
  slice.politicalPressureArmedBySettlementId = { free: 'fa' }

  const { events } = await applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(8, 8),
    primaryClaim: {},
    survivalBySettlementId: {
      cap: { ok: true, foodSurplus: 2 },
      member: { ok: true, foodSurplus: 1 },
      free: { ok: true, foodSurplus: 1 },
    },
  })

  assert.ok(!events.some((e) => e.kind === HISTORY_KIND_ALLIANCE))
})

test('no alliance when pressure enabled but nothing armed', async () => {
  setConflictTuning({ warThreshold: 1_000_000 })

  const slice = createDefaultColonizationSlice()
  slice.epoch = 22
  slice.increment3LatchedEpoch = 5
  slice.settlements = [
    {
      id: 'cap',
      x: 1,
      y: 1,
      factionId: 'fa',
      status: 'living',
      population: 400,
      tier: 'town',
    },
    {
      id: 'member',
      x: 2,
      y: 1,
      factionId: 'fa',
      status: 'living',
      population: 200,
      tier: 'village',
    },
    {
      id: 'free',
      x: 4,
      y: 1,
      factionId: null,
      status: 'living',
      population: 90,
      tier: 'hamlet',
    },
  ]
  slice.factions = [
    {
      id: 'fa',
      capitalSettlementId: 'cap',
      settlementIds: ['cap', 'member'],
      status: 'active',
      emergedEpoch: 0,
    },
  ]
  slice.politicalPressureArmedBySettlementId = {}
  slice.politicalPressureStreak = {}

  const { events } = await applyPoliticsPhase({
    slice,
    worldDocument: flatLandDoc(8, 8),
    primaryClaim: {},
    survivalBySettlementId: {
      cap: { ok: true, foodSurplus: 2 },
      member: { ok: true, foodSurplus: 1 },
      free: { ok: true, foodSurplus: 1 },
    },
  })

  assert.ok(!events.some((e) => e.kind === HISTORY_KIND_ALLIANCE))
})
