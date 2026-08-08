import assert from 'node:assert/strict'
import test from 'node:test'
import { HISTORY_KIND_VASSAL_DEFECTION } from '../historyKinds.js'
import {
  isPopulaceAppeasedRejoin,
  POPULACE_APPEASED_CAUSE,
  resolveSoftPowerRejoinCause,
} from './populaceAppeased.js'

test('isPopulaceAppeasedRejoin after soft-unalign from the joining banner', () => {
  assert.equal(
    isPopulaceAppeasedRejoin(
      {
        historyLog: [
          {
            kind: HISTORY_KIND_VASSAL_DEFECTION,
            settlementId: 'pin',
            fromFactionId: 'fa',
            cause: 'soft_unaligned',
            epoch: 10,
          },
        ],
      },
      'pin',
      'fa',
    ),
    true,
  )
})

test('isPopulaceAppeasedRejoin false when rejoining a different banner', () => {
  assert.equal(
    isPopulaceAppeasedRejoin(
      {
        historyLog: [
          {
            kind: HISTORY_KIND_VASSAL_DEFECTION,
            settlementId: 'pin',
            fromFactionId: 'fa',
            cause: 'soft_unaligned',
            epoch: 10,
          },
        ],
      },
      'pin',
      'fb',
    ),
    false,
  )
})

test('resolveSoftPowerRejoinCause returns populace_appeased when reunifying', () => {
  assert.equal(
    resolveSoftPowerRejoinCause(
      {
        historyLog: [
          {
            kind: HISTORY_KIND_VASSAL_DEFECTION,
            settlementId: 'pin',
            fromFactionId: 'fa',
            cause: 'soft_unaligned',
            epoch: 10,
          },
        ],
      },
      'pin',
      'fa',
      'join_existing',
    ),
    POPULACE_APPEASED_CAUSE,
  )
})
