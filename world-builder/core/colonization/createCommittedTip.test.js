import assert from 'node:assert/strict'
import test from 'node:test'
import { createCommittedTip } from './createCommittedTip.js'
import { createDefaultColonizationSlice } from './createDefaultColonizationSlice.js'

test('createCommittedTip deep-clones claimMap cells from slice.primaryClaim', () => {
  const slice = createDefaultColonizationSlice()
  slice.epoch = 2
  slice.primaryClaim = {
    s1: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
  }

  const tip = createCommittedTip(slice)
  const settlementId = 's1'

  assert.notStrictEqual(tip.claimMap[settlementId], slice.primaryClaim[settlementId])
  assert.notStrictEqual(tip.claimMap[settlementId][0], slice.primaryClaim[settlementId][0])
  assert.deepStrictEqual(tip.claimMap[settlementId], slice.primaryClaim[settlementId])
})

test('createCommittedTip uses event claimMap when provided', () => {
  const slice = createDefaultColonizationSlice()
  slice.primaryClaim = { s1: [{ x: 0, y: 0 }] }

  const eventClaim = { s1: [{ x: 5, y: 6 }] }
  const tip = createCommittedTip(slice, {
    kind: 'settlement_abandoned',
    claimMap: eventClaim,
  })

  assert.strictEqual(tip.eventKind, 'settlement_abandoned')
  assert.deepStrictEqual(tip.claimMap, eventClaim)
  assert.notStrictEqual(tip.claimMap.s1, eventClaim.s1)
})
