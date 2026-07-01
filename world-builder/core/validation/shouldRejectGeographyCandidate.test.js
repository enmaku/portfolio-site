import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'
import {
  collectRejectionReasons,
  collectStructuredRejectionReasons,
  isRejectionSamplingEnforced,
  shouldRejectGeographyCandidate,
} from './shouldRejectGeographyCandidate.js'

test('shouldRejectGeographyCandidate is false when only warnings present', () => {
  const rows = [
    { checkId: 'navigableRiverQuota', status: 'warn', summary: 'Low count', category: 'hydrology', rejectable: true },
    { checkId: 'coastMouth', status: 'pass', summary: 'ok', category: 'coast', rejectable: true },
  ]
  assert.strictEqual(shouldRejectGeographyCandidate(rows), false)
})

test('shouldRejectGeographyCandidate is true when a hard fail row exists', () => {
  const rows = [
    { checkId: 'coastMouth', status: 'fail', summary: 'No mouths', category: 'coast', rejectable: true },
    { checkId: 'navigableRiverQuota', status: 'warn', summary: 'Low count', category: 'hydrology', rejectable: true },
  ]
  assert.strictEqual(shouldRejectGeographyCandidate(rows), true)
})

test('collectStructuredRejectionReasons returns check ids without summaries', () => {
  const rows = [
    { checkId: 'coastMouth', status: 'fail', summary: 'No river mouths detected', category: 'coast', rejectable: true },
    { checkId: 'parallelStrandRatio', status: 'fail', summary: 'Parallel strands 0.62 above cap 0.35', category: 'hydrology', rejectable: true },
    { checkId: 'highlandPresence', status: 'warn', summary: 'Thin highlands', category: 'landmassPlausibility', rejectable: false },
  ]
  assert.deepStrictEqual(collectStructuredRejectionReasons(rows), [
    { checkId: 'coastMouth', category: 'coast' },
    { checkId: 'parallelStrandRatio', category: 'hydrology' },
  ])
})

test('collectRejectionReasons preserves legacy string reasons for logging', () => {
  const rows = [
    { checkId: 'coastMouth', status: 'fail', summary: 'No river mouths detected', category: 'coast', rejectable: true },
  ]
  assert.deepStrictEqual(collectRejectionReasons(rows), ['coastMouth: No river mouths detected'])
})

test('rejection sampling disabled mode never rejects from advisory-only failures', () => {
  const rows = [
    { checkId: 'highlandPresence', status: 'warn', summary: 'Thin highlands', category: 'landmassPlausibility', rejectable: false },
    { checkId: 'resourceMismatch', status: 'warn', summary: 'Mismatch', category: 'resources', rejectable: false },
  ]
  assert.strictEqual(isRejectionSamplingEnforced(DEFAULT_WORLD_GENERATION_OPTIONS), false)
  assert.strictEqual(shouldRejectGeographyCandidate(rows), false)
})

test('rejection sampling enforced mode rejects on configured hard failures', () => {
  const options = {
    ...DEFAULT_WORLD_GENERATION_OPTIONS,
    enforceCoastMouth: true,
  }
  const rows = [
    { checkId: 'coastMouth', status: 'fail', summary: 'No mouths', category: 'coast', rejectable: true },
  ]
  assert.strictEqual(isRejectionSamplingEnforced(options), true)
  assert.strictEqual(shouldRejectGeographyCandidate(rows), true)
  assert.deepStrictEqual(collectStructuredRejectionReasons(rows), [
    { checkId: 'coastMouth', category: 'coast' },
  ])
})
