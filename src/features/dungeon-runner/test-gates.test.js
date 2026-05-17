import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACCEPTANCE_TEST_CONTRACT,
  TEST_GATE_THRESHOLDS,
  getDeterminismGateSeeds,
} from './test-gates.js'

test('test gate thresholds are codified for deterministic headless suites', () => {
  assert.equal(Number.isInteger(TEST_GATE_THRESHOLDS.determinismSeedCount), true)
  assert.equal(TEST_GATE_THRESHOLDS.determinismSeedCount >= 20, true)
  assert.equal(Number.isInteger(TEST_GATE_THRESHOLDS.minimumInvariantChecks), true)
  assert.equal(TEST_GATE_THRESHOLDS.minimumInvariantChecks >= 5, true)
})

test('determinism gate seed set is stable and meets threshold', () => {
  const first = getDeterminismGateSeeds()
  const second = getDeterminismGateSeeds()
  assert.deepEqual(first, second)
  assert.equal(first.length, TEST_GATE_THRESHOLDS.determinismSeedCount)
  assert.equal(new Set(first).size, first.length)
})

test('acceptance test contract pattern is explicit for downstream slices', () => {
  assert.equal(typeof ACCEPTANCE_TEST_CONTRACT.requiredBeforeImplementation, 'boolean')
  assert.equal(ACCEPTANCE_TEST_CONTRACT.requiredBeforeImplementation, true)
  assert.equal(Array.isArray(ACCEPTANCE_TEST_CONTRACT.requiredSections), true)
  assert.equal(ACCEPTANCE_TEST_CONTRACT.requiredSections.includes('Behavior'), true)
  assert.equal(ACCEPTANCE_TEST_CONTRACT.requiredSections.includes('Public Interface'), true)
  assert.equal(ACCEPTANCE_TEST_CONTRACT.requiredSections.includes('Determinism Evidence'), true)
})
