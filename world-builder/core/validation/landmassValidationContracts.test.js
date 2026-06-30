import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'
import {
  ADVISORY_VALIDATION_CHECK_IDS,
  REJECTABLE_VALIDATION_CHECK_IDS,
  VALIDATION_CHECK_IDS,
  buildValidationSignals,
  collectStructuredRejectionReasons,
  createValidationRow,
  isRejectionSamplingEnforced,
  readEnforceFlag,
  resolveValidationCheckStatus,
} from './landmassValidationContracts.js'

test('VALIDATION_CHECK_IDS lists every contract in stable order', () => {
  assert.deepStrictEqual(VALIDATION_CHECK_IDS, [
    'navigableRiverQuota',
    'coastMouth',
    'hacksLawExponent',
    'slopeAreaConcavity',
    'parallelStrandRatio',
    'coastConnectedNavigablePath',
    'endorheicFractionCap',
    'salinityOceanGradient',
    'highlandPresence',
    'biomeDiversity',
    'windRainfallAsymmetry',
    'resourceMismatch',
  ])
})

test('rejectable and advisory check ids partition the contract', () => {
  assert.strictEqual(
    REJECTABLE_VALIDATION_CHECK_IDS.length + ADVISORY_VALIDATION_CHECK_IDS.length,
    VALIDATION_CHECK_IDS.length,
  )
  for (const checkId of REJECTABLE_VALIDATION_CHECK_IDS) {
    assert.ok(!ADVISORY_VALIDATION_CHECK_IDS.includes(checkId))
    assert.ok(readEnforceFlag(checkId, DEFAULT_WORLD_GENERATION_OPTIONS) === false)
  }
  for (const checkId of ADVISORY_VALIDATION_CHECK_IDS) {
    assert.strictEqual(readEnforceFlag(checkId, DEFAULT_WORLD_GENERATION_OPTIONS), false)
  }
})

test('readEnforceFlag maps rejectable checks to enforce options', () => {
  assert.strictEqual(
    readEnforceFlag('coastMouth', {
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enforceCoastMouth: true,
    }),
    true,
  )
  assert.strictEqual(readEnforceFlag('highlandPresence', DEFAULT_WORLD_GENERATION_OPTIONS), false)
})

test('resolveValidationCheckStatus warns for advisory failures', () => {
  assert.strictEqual(resolveValidationCheckStatus(false, 'highlandPresence', DEFAULT_WORLD_GENERATION_OPTIONS), 'warn')
  assert.strictEqual(resolveValidationCheckStatus(true, 'highlandPresence', DEFAULT_WORLD_GENERATION_OPTIONS), 'pass')
})

test('resolveValidationCheckStatus fails rejectable checks only when enforced', () => {
  assert.strictEqual(
    resolveValidationCheckStatus(false, 'coastMouth', DEFAULT_WORLD_GENERATION_OPTIONS),
    'warn',
  )
  assert.strictEqual(
    resolveValidationCheckStatus(
      false,
      'coastMouth',
      { ...DEFAULT_WORLD_GENERATION_OPTIONS, enforceCoastMouth: true },
    ),
    'fail',
  )
})

test('isRejectionSamplingEnforced is false when all enforce flags are off', () => {
  assert.strictEqual(isRejectionSamplingEnforced(DEFAULT_WORLD_GENERATION_OPTIONS), false)
})

test('isRejectionSamplingEnforced is true when any rejectable check is enforced', () => {
  assert.strictEqual(
    isRejectionSamplingEnforced({
      ...DEFAULT_WORLD_GENERATION_OPTIONS,
      enforceParallelStrandRatio: true,
    }),
    true,
  )
})

test('collectStructuredRejectionReasons returns check ids and categories only', () => {
  const reasons = collectStructuredRejectionReasons([
    { checkId: 'coastMouth', status: 'fail', summary: 'ignored copy' },
    { checkId: 'parallelStrandRatio', status: 'fail', summary: 'ignored copy' },
    { checkId: 'highlandPresence', status: 'warn', summary: 'ignored copy' },
  ])
  assert.deepStrictEqual(reasons, [
    { checkId: 'coastMouth', category: 'coast' },
    { checkId: 'parallelStrandRatio', category: 'hydrology' },
  ])
})

test('createValidationRow copies category and rejectable from contract', () => {
  const row = createValidationRow('coastMouth', 'warn', 'fixture summary')
  assert.strictEqual(row.checkId, 'coastMouth')
  assert.strictEqual(row.status, 'warn')
  assert.strictEqual(row.category, 'coast')
  assert.strictEqual(row.rejectable, true)
})

test('buildValidationSignals exposes logistics-facing movement metrics', () => {
  const signals = buildValidationSignals(
    [
      { checkId: 'navigableRiverQuota', status: 'warn' },
      { checkId: 'coastConnectedNavigablePath', status: 'pass' },
      { checkId: 'endorheicFractionCap', status: 'pass' },
      { checkId: 'salinityOceanGradient', status: 'pass' },
      { checkId: 'highlandPresence', status: 'pass' },
      { checkId: 'biomeDiversity', status: 'pass' },
      { checkId: 'windRainfallAsymmetry', status: 'pass' },
      { checkId: 'resourceMismatch', status: 'pass' },
    ],
    {
      navigableEdgeCount: 4,
      riverCellCount: 12,
      mouthCount: 2,
      hacksLawExponent: 0.55,
      parallelStrandRatio: 0.1,
      coastConnectedNavigablePathLength: 9,
    },
    {
      coastalNodeCount: 3,
      highlandFraction: 0.2,
      biomeDiversityCount: 5,
      windRainfallAsymmetryActive: true,
      resourceMismatchDetected: false,
      meanInlandSalinity: 0.1,
      oceanSalinityMean: 0.95,
    },
  )

  assert.strictEqual(signals.movement.navigableRiverEdgeCount, 4)
  assert.strictEqual(signals.movement.coastConnectedNavigablePathLength, 9)
  assert.strictEqual(signals.movement.navigableRiverCheckStatus, 'warn')
  assert.strictEqual(signals.movement.coastConnectedNavigablePathCheckStatus, 'pass')
})
