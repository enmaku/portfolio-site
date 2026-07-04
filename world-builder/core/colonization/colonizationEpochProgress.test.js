import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInitialEpochStepProgress,
  epochStepProgressValue,
  epochStepUnitCount,
  epochStepUnitIndex,
  reduceEpochStepProgressOnEpochStart,
  reduceEpochStepProgressOnNetworkSubstepStart,
  reduceEpochStepProgressOnPhaseStart,
} from './colonizationEpochProgress.js'
import { COLONIZATION_EPOCH_PHASE_COUNT } from './colonizationEpochSteps.js'

test('createInitialEpochStepProgress starts idle before any epoch phase', () => {
  assert.deepStrictEqual(createInitialEpochStepProgress(50), {
    percent: 0,
    epochBatch: 50,
    activeEpochIndex: -1,
    completedEpochIndex: -1,
    activePhaseIndex: -1,
    completedPhaseIndex: -1,
    label: '',
    activeNetworkSubstepIndex: -1,
    completedNetworkSubstepIndex: -1,
  })
})

test('epochStepProgressValue scales by completed units across batch and phases', () => {
  const unitCount = epochStepUnitCount(2)
  assert.strictEqual(unitCount, 2 * COLONIZATION_EPOCH_PHASE_COUNT)
  assert.strictEqual(epochStepProgressValue(epochStepUnitIndex(0, 2, 0), unitCount), 10)
  assert.strictEqual(epochStepProgressValue(epochStepUnitIndex(1, 2, COLONIZATION_EPOCH_PHASE_COUNT - 1), unitCount), 100)
})

test('reduceEpochStepProgressOnEpochStart sets epoch label', () => {
  const next = reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(50), {
    epochIndex: 12,
    epochBatch: 50,
  })
  assert.strictEqual(next.activeEpochIndex, 12)
  assert.strictEqual(next.label, 'Epoch 13/50')
})

test('reduceEpochStepProgressOnPhaseStart includes phase label', () => {
  const progress = reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(10), {
    epochIndex: 0,
    epochBatch: 10,
  })
  const next = reduceEpochStepProgressOnPhaseStart(progress, {
    epochIndex: 0,
    epochBatch: 10,
    phaseIndex: 1,
    phaseId: 'claims',
  })
  assert.strictEqual(next.activePhaseIndex, 1)
  assert.strictEqual(next.label, 'Epoch 1/10 · Claims')
})

test('reduceEpochStepProgressOnNetworkSubstepStart appends network substep label', () => {
  const progress = reduceEpochStepProgressOnPhaseStart(
    reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(1), {
      epochIndex: 0,
      epochBatch: 1,
    }),
    {
      epochIndex: 0,
      epochBatch: 1,
      phaseIndex: 0,
      phaseId: 'network',
    },
  )
  const next = reduceEpochStepProgressOnNetworkSubstepStart(progress, { substepIndex: 1 })
  assert.strictEqual(next.activeNetworkSubstepIndex, 1)
  assert.strictEqual(next.label, 'Epoch 1/1 · Network · Advance')
})
