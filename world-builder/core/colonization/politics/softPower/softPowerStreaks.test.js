import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SOFT_POWER_CLEAR_AND_REARM_EPOCHS,
  SOFT_POWER_JOIN_HOLD_EPOCHS,
  SOFT_POWER_PAINT_STREAK_EPOCHS,
  SOFT_POWER_REFRACTORY_EPOCHS,
  advanceSoftPowerStreaks,
} from './softPowerStreaks.js'

test('paint arms after paint streak of dominance', () => {
  let state = {
    softPowerPaintStreak: {},
    softPowerJoinHoldStreak: {},
    softPowerClearStreak: {},
    softPowerPaintBySettlementId: {},
    softPowerJoinEligibleBySettlementId: {},
    membershipCooldown: [],
  }
  const scores = { free: { dominantFactionId: 'fa' } }

  state = advanceSoftPowerStreaks({
    state,
    scores,
    epoch: 1,
    mapGraySettlementIds: new Set(['free']),
  }).state
  assert.equal(state.softPowerPaintBySettlementId.free, undefined)
  assert.equal(state.softPowerPaintStreak.free, 1)

  state = advanceSoftPowerStreaks({
    state,
    scores,
    epoch: 2,
    mapGraySettlementIds: new Set(['free']),
  }).state
  assert.equal(state.softPowerPaintBySettlementId.free, 'fa')
  assert.equal(SOFT_POWER_PAINT_STREAK_EPOCHS, 2)
})

test('join eligibility requires extra hold after paint', () => {
  let state = {
    softPowerPaintStreak: { free: 2 },
    softPowerJoinHoldStreak: {},
    softPowerClearStreak: {},
    softPowerPaintBySettlementId: { free: 'fa' },
    softPowerJoinEligibleBySettlementId: {},
    membershipCooldown: [],
  }
  const scores = { free: { dominantFactionId: 'fa' } }

  for (let epoch = 3; epoch < 3 + SOFT_POWER_JOIN_HOLD_EPOCHS - 1; epoch += 1) {
    state = advanceSoftPowerStreaks({
      state,
      scores,
      epoch,
      mapGraySettlementIds: new Set(['free']),
    }).state
    assert.equal(state.softPowerJoinEligibleBySettlementId.free, undefined)
  }
  state = advanceSoftPowerStreaks({
    state,
    scores,
    epoch: 3 + SOFT_POWER_JOIN_HOLD_EPOCHS - 1,
    mapGraySettlementIds: new Set(['free']),
  }).state
  assert.equal(state.softPowerJoinEligibleBySettlementId.free, 'fa')
})

test('lost dominance clears paint and requires clear-and-rearm', () => {
  let state = {
    softPowerPaintStreak: { free: 2 },
    softPowerJoinHoldStreak: { free: 3 },
    softPowerClearStreak: {},
    softPowerPaintBySettlementId: { free: 'fa' },
    softPowerJoinEligibleBySettlementId: { free: 'fa' },
    membershipCooldown: [],
  }

  state = advanceSoftPowerStreaks({
    state,
    scores: { free: { dominantFactionId: null } },
    epoch: 10,
    mapGraySettlementIds: new Set(['free']),
  }).state
  assert.equal(state.softPowerPaintBySettlementId.free, undefined)
  assert.equal(state.softPowerJoinEligibleBySettlementId.free, undefined)
  assert.equal(state.softPowerPaintStreak.free, undefined)
  assert.equal(state.softPowerClearStreak.free, 1)

  // Dominance returns before clear-and-rearm completes — still blocked.
  state = advanceSoftPowerStreaks({
    state,
    scores: { free: { dominantFactionId: 'fa' } },
    epoch: 11,
    mapGraySettlementIds: new Set(['free']),
  }).state
  assert.equal(state.softPowerPaintBySettlementId.free, undefined)
  assert.ok((state.softPowerClearStreak.free ?? 0) < SOFT_POWER_CLEAR_AND_REARM_EPOCHS)

  // Finish clear while dominance absent.
  state = advanceSoftPowerStreaks({
    state,
    scores: { free: { dominantFactionId: null } },
    epoch: 12,
    mapGraySettlementIds: new Set(['free']),
  }).state
  assert.equal(state.softPowerClearStreak.free, undefined)

  // Re-arm paint streak from zero.
  state = advanceSoftPowerStreaks({
    state,
    scores: { free: { dominantFactionId: 'fa' } },
    epoch: 13,
    mapGraySettlementIds: new Set(['free']),
  }).state
  assert.equal(state.softPowerPaintStreak.free, 1)
  assert.equal(state.softPowerPaintBySettlementId.free, undefined)
})

test('refractory cooldown blocks paint and join arming', () => {
  const state = advanceSoftPowerStreaks({
    state: {
      softPowerPaintStreak: {},
      softPowerJoinHoldStreak: {},
      softPowerClearStreak: {},
      softPowerPaintBySettlementId: {},
      softPowerJoinEligibleBySettlementId: {},
      membershipCooldown: [
        { subjectId: 'free', untilEpoch: 5, kind: 'trade_partner_peel' },
      ],
    },
    scores: { free: { dominantFactionId: 'fa' } },
    epoch: 4,
    mapGraySettlementIds: new Set(['free']),
  }).state
  assert.equal(state.softPowerPaintStreak.free, undefined)
  assert.equal(SOFT_POWER_REFRACTORY_EPOCHS, 2)
})

test('taxed seats accumulate rival trade pressure streak without paint', () => {
  const state = advanceSoftPowerStreaks({
    state: {
      softPowerPaintStreak: {},
      softPowerJoinHoldStreak: {},
      softPowerClearStreak: {},
      softPowerPaintBySettlementId: {},
      softPowerJoinEligibleBySettlementId: {},
      softPowerRebellionPressureStreak: {},
      membershipCooldown: [],
    },
    scores: {
      taxed: { dominantFactionId: 'rival' },
    },
    epoch: 1,
    mapGraySettlementIds: new Set(),
    taxedMemberSettlementIds: new Set(['taxed']),
    homeFactionBySettlementId: { taxed: 'home' },
  }).state
  assert.equal(state.softPowerPaintBySettlementId.taxed, undefined)
  assert.equal(state.softPowerRebellionPressureStreak.taxed, 1)
})
