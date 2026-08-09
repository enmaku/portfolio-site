import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isSameBannerEpochReunification,
  resolveEpochStartFactionId,
} from './sameBannerReunification.js'

test('resolveEpochStartFactionId reads prior tenure slot', () => {
  assert.equal(
    resolveEpochStartFactionId(
      { bannerMembershipHistoryBySettlementId: { pin: ['fa', ''] } },
      'pin',
    ),
    'fa',
  )
  assert.equal(
    resolveEpochStartFactionId(
      { bannerMembershipHistoryBySettlementId: { pin: ['fa', 'fa'] } },
      'pin',
    ),
    'fa',
  )
  assert.equal(
    resolveEpochStartFactionId(
      { bannerMembershipHistoryBySettlementId: { pin: [''] } },
      'pin',
    ),
    null,
  )
})

test('isSameBannerEpochReunification requires matching end banner', () => {
  const slice = { bannerMembershipHistoryBySettlementId: { pin: ['fa', 'fb'] } }
  assert.equal(isSameBannerEpochReunification(slice, 'pin', 'fa'), true)
  assert.equal(isSameBannerEpochReunification(slice, 'pin', 'fb'), false)
  assert.equal(isSameBannerEpochReunification(slice, 'pin', null), false)
})
