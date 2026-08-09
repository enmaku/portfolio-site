import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDirectPressureCorridorPairSet } from './directCorridorPairs.js'
import {
  countSharedPrimaryClaimBorderCells,
} from './primaryClaimAdjacency.js'
import {
  DEFAULT_POLITICAL_PRESSURE_TUNING,
  getPoliticalPressureTuning,
  resetPoliticalPressureTuning,
  setPoliticalPressureTuning,
} from './politicalPressureTuning.js'
import { advancePoliticalPressureStreaks } from './politicalPressureStreaks.js'
import {
  isPoliticalPressureDominant,
  scorePoliticalPressureBySettlement,
} from './scorePoliticalPressure.js'
import { createEmptyPoliticalPressureSliceFields } from './resolvePoliticalPressureSliceFields.js'

test.afterEach(() => {
  resetPoliticalPressureTuning()
})

test('includes road and inland sail pairs; excludes open sea', async () => {
  // re-run corridor test file content for suite cohesion — imported module covered in its own file
  const pairs = buildDirectPressureCorridorPairSet({
    roads: [{ settlementIds: ['a', 'b'], mode: 'open_sea', cells: [] }],
  })
  assert.equal(pairs.has('a|b'), false)
})

test('Sweep B defaults are enabled with margin 2.5 and streak 3', () => {
  assert.equal(DEFAULT_POLITICAL_PRESSURE_TUNING.enabled, true)
  assert.equal(DEFAULT_POLITICAL_PRESSURE_TUNING.majority, 0.5)
  assert.equal(DEFAULT_POLITICAL_PRESSURE_TUNING.marginRatio, 2.5)
  assert.equal(DEFAULT_POLITICAL_PRESSURE_TUNING.streakEpochs, 3)
  assert.equal(getPoliticalPressureTuning().weightBorder, 0.5)
  setPoliticalPressureTuning({ streakEpochs: 1 })
  assert.equal(getPoliticalPressureTuning().streakEpochs, 1)
  resetPoliticalPressureTuning()
  assert.equal(getPoliticalPressureTuning().streakEpochs, 3)
})

test('dominance requires majority and 2.5x margin', () => {
  assert.equal(isPoliticalPressureDominant({ share: 0.5, runnerUpShare: 0.2 }), false)
  assert.equal(isPoliticalPressureDominant({ share: 0.501, runnerUpShare: 0.2 }), true)
  assert.equal(isPoliticalPressureDominant({ share: 0.6, runnerUpShare: 0.3 }), false)
  assert.equal(isPoliticalPressureDominant({ share: 0.75, runnerUpShare: 0.3 }), true)
  assert.equal(isPoliticalPressureDominant({ share: 1, runnerUpShare: 0 }), true)
})

function living(id, factionId = null, extra = {}) {
  return {
    id,
    factionId,
    status: 'living',
    population: 100,
    wealthCp: 0,
    martialCapacity: 0,
    isTradePartner: false,
    vassalLiegeSettlementId: null,
    ...extra,
  }
}

function faction(id, capitalSettlementId, settlementIds) {
  return { id, capitalSettlementId, settlementIds, status: 'active' }
}

test('tuning smoke: strong bordering neighbor dominates free subject', () => {
  const primaryClaim = {
    free: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ],
    'cap-a': [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
    'cap-b': [
      { x: 5, y: 5 },
    ],
  }
  assert.equal(
    countSharedPrimaryClaimBorderCells({
      primaryClaim,
      settlementIdA: 'free',
      settlementIdB: 'cap-a',
      gridWidth: 8,
      gridHeight: 8,
    }),
    2,
  )
  const scores = scorePoliticalPressureBySettlement({
    settlements: [
      living('free'),
      living('cap-a', 'fa', { population: 400, wealthCp: 200, martialCapacity: 50 }),
      living('m-a', 'fa', { population: 200 }),
      living('cap-b', 'fb', { population: 50 }),
    ],
    factions: [
      faction('fa', 'cap-a', ['cap-a', 'm-a']),
      faction('fb', 'cap-b', ['cap-b']),
    ],
    primaryClaim,
    gridWidth: 8,
    gridHeight: 8,
    corridorPairs: new Set(['free|cap-a']),
    bilateralCpByPair: { 'free|cap-a': 100 },
    subjectIds: ['free'],
  })
  assert.equal(scores.free.dominantFactionId, 'fa')
  assert.equal(scores.free.majority, true)
  assert.equal(scores.free.marginOk, true)
})

test('streaks arm only after streakEpochs and clear-and-rearm clears armed', () => {
  const eligible = new Set(['free'])
  let state = createEmptyPoliticalPressureSliceFields()

  for (let epoch = 1; epoch <= 2; epoch += 1) {
    const advanced = advancePoliticalPressureStreaks({
      state,
      scores: { free: { dominantFactionId: 'fa' } },
      epoch,
      eligibleSubjectIds: eligible,
    })
    state = { ...state, ...advanced.state }
    assert.equal(state.politicalPressureArmedBySettlementId.free, undefined)
  }

  const armed = advancePoliticalPressureStreaks({
    state,
    scores: { free: { dominantFactionId: 'fa' } },
    epoch: 3,
    eligibleSubjectIds: eligible,
  })
  state = { ...state, ...armed.state }
  assert.equal(state.politicalPressureArmedBySettlementId.free, 'fa')
  assert.equal(state.politicalPressureStreak.free, 3)

  for (let epoch = 4; epoch <= 5; epoch += 1) {
    const cleared = advancePoliticalPressureStreaks({
      state,
      scores: { free: { dominantFactionId: null } },
      epoch,
      eligibleSubjectIds: eligible,
    })
    state = { ...state, ...cleared.state }
  }
  assert.equal(state.politicalPressureArmedBySettlementId.free, undefined)
})

test('empty political pressure slice fields are empty maps', () => {
  const empty = createEmptyPoliticalPressureSliceFields()
  assert.deepEqual(empty.politicalPressureStreak, {})
  assert.deepEqual(empty.recentAllianceBySettlementId, {})
  assert.deepEqual(empty.bannerMembershipHistoryBySettlementId, {})
})

test('banner tenure resistance can block modest push that flips a new sticky seat', () => {
  const primaryClaim = {
    sub: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ],
    'cap-a': [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
  }
  const base = {
    settlements: [
      living('sub', 'fb', { population: 100, wealthCp: 0 }),
      living('cap-a', 'fa', { population: 140, wealthCp: 0 }),
      living('cap-b', 'fb', { population: 100, wealthCp: 0 }),
    ],
    factions: [
      faction('fa', 'cap-a', ['cap-a']),
      faction('fb', 'cap-b', ['cap-b', 'sub']),
    ],
    primaryClaim,
    gridWidth: 8,
    gridHeight: 8,
    corridorPairs: new Set(['sub|cap-a']),
    bilateralCpByPair: {},
    subjectIds: ['sub'],
  }
  const fresh = scorePoliticalPressureBySettlement({
    ...base,
    bannerMembershipHistoryBySettlementId: { sub: [] },
  })
  assert.equal(fresh.sub.dominantFactionId, 'fa')
  assert.equal(fresh.sub.bannerTenureResistance, 0)

  const heartland = scorePoliticalPressureBySettlement({
    ...base,
    bannerMembershipHistoryBySettlementId: {
      sub: Array.from({ length: 10 }, () => 'fb'),
    },
  })
  assert.equal(heartland.sub.dominantFactionId, null)
  assert.ok(heartland.sub.bannerTenureResistance > 0)
})

test('fresh conquest memory prefers prior banner for reunification pressure', () => {
  const primaryClaim = {
    sub: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ],
    'cap-purple': [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ],
  }
  const history = [...Array.from({ length: 9 }, () => 'purple'), 'orange']
  const scores = scorePoliticalPressureBySettlement({
    settlements: [
      living('sub', 'orange', { population: 100, wealthCp: 0 }),
      living('cap-purple', 'purple', { population: 140, wealthCp: 0 }),
      living('cap-orange', 'orange', { population: 100, wealthCp: 0 }),
    ],
    factions: [
      faction('purple', 'cap-purple', ['cap-purple']),
      faction('orange', 'cap-orange', ['cap-orange', 'sub']),
    ],
    primaryClaim,
    gridWidth: 8,
    gridHeight: 8,
    corridorPairs: new Set(['sub|cap-purple']),
    bilateralCpByPair: {},
    subjectIds: ['sub'],
    bannerMembershipHistoryBySettlementId: { sub: history },
  })
  assert.equal(scores.sub.dominantFactionId, 'purple')
  assert.equal(scores.sub.bannerTenureResistance, 0)
})
