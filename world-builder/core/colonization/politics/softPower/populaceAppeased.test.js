import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isPopulaceAppeasedRejoin,
  POPULACE_APPEASED_CAUSE,
  resolveSoftPowerRejoinCause,
} from './populaceAppeased.js'

test('isPopulaceAppeasedRejoin when epoch-start banner matches join target', () => {
  assert.equal(
    isPopulaceAppeasedRejoin(
      { bannerMembershipHistoryBySettlementId: { pin: ['fa', ''] } },
      'pin',
      'fa',
    ),
    true,
  )
})

test('isPopulaceAppeasedRejoin false when rejoining a different banner', () => {
  assert.equal(
    isPopulaceAppeasedRejoin(
      { bannerMembershipHistoryBySettlementId: { pin: ['fa', ''] } },
      'pin',
      'fb',
    ),
    false,
  )
})

test('resolveSoftPowerRejoinCause returns populace_appeased when reunifying', () => {
  assert.equal(
    resolveSoftPowerRejoinCause(
      { bannerMembershipHistoryBySettlementId: { pin: ['fa', 'fa'] } },
      'pin',
      'fa',
      'join_existing',
    ),
    POPULACE_APPEASED_CAUSE,
  )
})
