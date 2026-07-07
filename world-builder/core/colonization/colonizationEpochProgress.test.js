import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInitialEpochStepProgress,
  epochStepProgressValue,
  epochStepUnitCount,
  epochStepUnitIndex,
  reduceEpochStepProgressOnCollapseSubstepStart,
  reduceEpochStepProgressOnEpochStart,
  reduceEpochStepProgressOnFinalizeStepStart,
  reduceEpochStepProgressOnMapSubstepStart,
  reduceEpochStepProgressOnNetworkSubstepStart,
  reduceEpochStepProgressOnPhaseStart,
} from './colonizationEpochProgress.js'
import {
  COLONIZATION_EPOCH_FINALIZE_STEP_COUNT,
  COLONIZATION_EPOCH_PHASE_COUNT,
} from './colonizationEpochSteps.js'

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
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
    activeFinalizeStepIndex: -1,
    completedFinalizeStepIndex: -1,
    activeMapSubstepIndex: -1,
    completedMapSubstepIndex: -1,
  })
})

test('epochStepProgressValue scales by completed units across batch, phases, and finalize', () => {
  const unitCount = epochStepUnitCount(2)
  assert.strictEqual(unitCount, 2 * COLONIZATION_EPOCH_PHASE_COUNT + COLONIZATION_EPOCH_FINALIZE_STEP_COUNT)
  assert.strictEqual(epochStepProgressValue(epochStepUnitIndex(0, 2, 0), unitCount), 7)
  assert.strictEqual(
    epochStepProgressValue(epochStepUnitIndex(1, 2, COLONIZATION_EPOCH_PHASE_COUNT - 1), unitCount),
    86,
  )
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
  assert.strictEqual(next.label, 'Epoch 1/1 · Network · Dispatch')
})

test('reduceEpochStepProgressOnCollapseSubstepStart appends collapse substep label', () => {
  const progress = reduceEpochStepProgressOnPhaseStart(
    reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(1), {
      epochIndex: 0,
      epochBatch: 1,
    }),
    {
      epochIndex: 0,
      epochBatch: 1,
      phaseIndex: 5,
      phaseId: 'collapse',
    },
  )
  const next = reduceEpochStepProgressOnCollapseSubstepStart(progress, { substepIndex: 1 })
  assert.strictEqual(next.activeCollapseSubstepIndex, 1)
  assert.strictEqual(next.label, 'Epoch 1/1 · Collapse · Hinterland')
})

test('reduceEpochStepProgressOnFinalizeStepStart marks commit after simulation phases', () => {
  const progress = reduceEpochStepProgressOnFinalizeStepStart(
    {
      ...createInitialEpochStepProgress(1),
      completedEpochIndex: 0,
      completedPhaseIndex: COLONIZATION_EPOCH_PHASE_COUNT - 1,
    },
    { stepIndex: 0 },
  )
  assert.strictEqual(progress.activeFinalizeStepIndex, 0)
  assert.strictEqual(progress.label, 'Commit')
  assert.strictEqual(progress.completedPhaseIndex, COLONIZATION_EPOCH_PHASE_COUNT - 1)
})

test('reduceEpochStepProgressOnMapSubstepStart appends map substep label', () => {
  const progress = reduceEpochStepProgressOnMapSubstepStart(
    reduceEpochStepProgressOnFinalizeStepStart(createInitialEpochStepProgress(1), {
      stepIndex: 1,
    }),
    { substepIndex: 3 },
  )
  assert.strictEqual(progress.activeMapSubstepIndex, 3)
  assert.strictEqual(progress.label, 'Map · Population')
})

test('reduceEpochStepProgressOnMapSubstepStart labels session substep under map finalize', () => {
  const progress = reduceEpochStepProgressOnMapSubstepStart(
    reduceEpochStepProgressOnFinalizeStepStart(createInitialEpochStepProgress(1), {
      stepIndex: 1,
    }),
    { substepIndex: 0 },
  )
  assert.strictEqual(progress.label, 'Map · Session')
})
