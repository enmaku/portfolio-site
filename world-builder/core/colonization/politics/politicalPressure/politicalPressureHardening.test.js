import assert from 'node:assert/strict'
import test from 'node:test'
import { createDefaultColonizationSlice } from '../../createDefaultColonizationSlice.js'
import { applyAllianceMembership } from './applyAllianceMembership.js'
import {
  advancePoliticalPressureStreaks,
  POLITICAL_PRESSURE_COOLDOWN_KIND,
} from './politicalPressureStreaks.js'
import { resetPoliticalPressureTuning } from './politicalPressureTuning.js'
import { undirectedSettlementPairKey } from './primaryClaimAdjacency.js'
import { scorePoliticalPressureBySettlement } from './scorePoliticalPressure.js'
import { bilateralWithWartimeZeroForTests } from './applyPoliticalPressurePass.js'

test.afterEach(() => {
  resetPoliticalPressureTuning()
})

function living(id, factionId = null, extra = {}) {
  return {
    id,
    factionId,
    status: 'living',
    population: 120,
    wealthCp: 40,
    isTradePartner: false,
    vassalLiegeSettlementId: null,
    ...extra,
  }
}

function faction(id, capitalSettlementId, settlementIds) {
  return { id, capitalSettlementId, settlementIds, status: 'active' }
}

test('refractory cooldown blocks immediate re-arm after alliance', () => {
  const eligible = new Set(['free'])
  let state = {
    politicalPressureStreak: { free: 5 },
    politicalPressureClearStreak: {},
    politicalPressureArmedBySettlementId: { free: 'fa' },
    membershipCooldown: [
      { subjectId: 'free', untilEpoch: 12, kind: POLITICAL_PRESSURE_COOLDOWN_KIND },
    ],
  }
  const advanced = advancePoliticalPressureStreaks({
    state,
    scores: { free: { dominantFactionId: 'fa' } },
    epoch: 10,
    eligibleSubjectIds: eligible,
    mapGraySettlementIds: eligible,
  })
  assert.equal(advanced.state.politicalPressureArmedBySettlementId.free, undefined)
  assert.equal(advanced.state.politicalPressureStreak.free, 0)
})

test('wartime belligerent pairs zero trade cp used by pressure pass', () => {
  const settlements = [
    living('cap-a', 'fa', { population: 500, wealthCp: 200, martialCapacity: 80 }),
    living('m-a', 'fa', { population: 300 }),
    living('cap-b', 'fb', { population: 100 }),
    living('m-b', 'fb', { population: 80 }),
  ]
  const factions = [
    faction('fa', 'cap-a', ['cap-a', 'm-a']),
    faction('fb', 'cap-b', ['cap-b', 'm-b']),
  ]
  const primaryClaim = {
    'cap-a': [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    'm-a': [{ x: 0, y: 1 }],
    'cap-b': [
      { x: 3, y: 0 },
      { x: 2, y: 0 },
    ],
    'm-b': [{ x: 3, y: 1 }],
  }
  const corridorPairs = new Set([undirectedSettlementPairKey('m-b', 'cap-a')])
  const pair = undirectedSettlementPairKey('m-b', 'cap-a')
  const peacetime = scorePoliticalPressureBySettlement({
    settlements,
    factions,
    primaryClaim,
    gridWidth: 8,
    gridHeight: 8,
    corridorPairs,
    bilateralCpByPair: { [pair]: 8000 },
    subjectIds: ['m-b'],
  })
  assert.equal(peacetime['m-b'].dominantFactionId, 'fa')

  const wartimeBilateral = bilateralWithWartimeZeroForTests({
    bilateral: { [pair]: 8000 },
    settlements,
    blocks: [{ aFactionId: 'fa', bFactionId: 'fb' }],
  })
  assert.equal(wartimeBilateral[pair], 0)

  const wartime = scorePoliticalPressureBySettlement({
    settlements,
    factions,
    primaryClaim,
    gridWidth: 8,
    gridHeight: 8,
    corridorPairs,
    bilateralCpByPair: wartimeBilateral,
    subjectIds: ['m-b'],
  })
  assert.ok(
    (wartime['m-b'].pushByFactionId.fa ?? 0) < (peacetime['m-b'].pushByFactionId.fa ?? 0),
    'wartime zeroed trade should reduce fa push vs peacetime',
  )
})

test('live alliance apply then refractory prevents same-epoch re-arming path', () => {
  let slice = createDefaultColonizationSlice()
  slice.epoch = 5
  slice.settlements = [
    living('free'),
    living('cap-a', 'fa', { population: 500 }),
    living('m-a', 'fa'),
  ]
  slice.factions = [faction('fa', 'cap-a', ['cap-a', 'm-a'])]
  const claimAdjacencyPairs = new Set(['cap-a|free'])
  const corridorPairs = new Set(['cap-a|free'])
  const joined = applyAllianceMembership({
    slice: {
      ...slice,
      politicalPressureArmedBySettlementId: { free: 'fa' },
    },
    armedBySettlementId: { free: 'fa' },
    claimAdjacencyPairs,
    corridorPairs,
  })
  slice = joined.slice
  assert.equal(slice.settlements.find((s) => s.id === 'free')?.factionId, 'fa')
  const cooldown = (slice.membershipCooldown ?? []).find(
    (row) => row.subjectId === 'free' && row.kind === POLITICAL_PRESSURE_COOLDOWN_KIND,
  )
  assert.ok(cooldown)
  assert.ok(cooldown.untilEpoch > slice.epoch)

  const advanced = advancePoliticalPressureStreaks({
    state: slice,
    scores: { free: { dominantFactionId: 'fb' } },
    epoch: slice.epoch,
    eligibleSubjectIds: new Set(['free']),
  })
  assert.equal(advanced.state.politicalPressureArmedBySettlementId.free, undefined)
})
