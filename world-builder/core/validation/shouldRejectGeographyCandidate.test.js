import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectRejectionReasons,
  shouldRejectGeographyCandidate,
} from './shouldRejectGeographyCandidate.js'

test('shouldRejectGeographyCandidate is false when only warnings present', () => {
  const rows = [
    { checkId: 'navigableRiverQuota', status: 'warn', summary: 'Low count' },
    { checkId: 'coastMouth', status: 'pass', summary: 'ok' },
  ]
  assert.strictEqual(shouldRejectGeographyCandidate(rows), false)
})

test('shouldRejectGeographyCandidate is true when a hard fail row exists', () => {
  const rows = [
    { checkId: 'coastMouth', status: 'fail', summary: 'No mouths' },
    { checkId: 'navigableRiverQuota', status: 'warn', summary: 'Low count' },
  ]
  assert.strictEqual(shouldRejectGeographyCandidate(rows), true)
})

test('collectRejectionReasons returns actionable check summaries', () => {
  const rows = [
    { checkId: 'coastMouth', status: 'fail', summary: 'No river mouths detected' },
    { checkId: 'parallelStrandRatio', status: 'fail', summary: 'Parallel strands 0.62 above cap 0.35' },
    { checkId: 'highlandPresence', status: 'warn', summary: 'Thin highlands' },
  ]
  assert.deepStrictEqual(collectRejectionReasons(rows), [
    'coastMouth: No river mouths detected',
    'parallelStrandRatio: Parallel strands 0.62 above cap 0.35',
  ])
})
