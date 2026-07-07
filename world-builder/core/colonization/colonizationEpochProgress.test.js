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
  assert.deepStrictEqual(createInitialEpochStepProgress(), {
    percent: 0,
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

test('epochStepProgressValue scales by completed units across phases and finalize', () => {
  const unitCount = epochStepUnitCount()
  assert.strictEqual(unitCount, COLONIZATION_EPOCH_PHASE_COUNT + COLONIZATION_EPOCH_FINALIZE_STEP_COUNT)
  assert.strictEqual(epochStepProgressValue(epochStepUnitIndex(0), unitCount), 13)
  assert.strictEqual(
    epochStepProgressValue(epochStepUnitIndex(COLONIZATION_EPOCH_PHASE_COUNT - 1), unitCount),
    75,
  )
})

test('reduceEpochStepProgressOnEpochStart sets epoch label', () => {
  const next = reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(), {
    simulationEpoch: 12,
  })
  assert.strictEqual(next.activeEpochIndex, 0)
  assert.strictEqual(next.label, 'Epoch 13')
})

test('reduceEpochStepProgressOnPhaseStart includes phase label', () => {
  const progress = reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(), {
    simulationEpoch: 0,
  })
  const next = reduceEpochStepProgressOnPhaseStart(progress, {
    simulationEpoch: 0,
    phaseIndex: 1,
    phaseId: 'claims',
  })
  assert.strictEqual(next.activePhaseIndex, 1)
  assert.strictEqual(next.label, 'Epoch 1 · Claims')
})

test('reduceEpochStepProgressOnNetworkSubstepStart appends network substep label', () => {
  const progress = reduceEpochStepProgressOnPhaseStart(
    reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(), {
      simulationEpoch: 0,
    }),
    {
      simulationEpoch: 0,
      phaseIndex: 0,
      phaseId: 'network',
    },
  )
  const next = reduceEpochStepProgressOnNetworkSubstepStart(progress, { substepIndex: 1 })
  assert.strictEqual(next.activeNetworkSubstepIndex, 1)
  assert.strictEqual(next.label, 'Epoch 1 · Network · Dispatch')
})

test('reduceEpochStepProgressOnCollapseSubstepStart appends collapse substep label', () => {
  const progress = reduceEpochStepProgressOnPhaseStart(
    reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(), {
      simulationEpoch: 0,
    }),
    {
      simulationEpoch: 0,
      phaseIndex: 5,
      phaseId: 'collapse',
    },
  )
  const next = reduceEpochStepProgressOnCollapseSubstepStart(progress, { substepIndex: 1 })
  assert.strictEqual(next.activeCollapseSubstepIndex, 1)
  assert.strictEqual(next.label, 'Epoch 1 · Collapse · Hinterland')
})

test('reduceEpochStepProgressOnFinalizeStepStart marks commit after simulation phases', () => {
  const progress = reduceEpochStepProgressOnFinalizeStepStart(
    {
      ...createInitialEpochStepProgress(),
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
    reduceEpochStepProgressOnFinalizeStepStart(createInitialEpochStepProgress(), {
      stepIndex: 1,
    }),
    { substepIndex: 3 },
  )
  assert.strictEqual(progress.activeMapSubstepIndex, 3)
  assert.strictEqual(progress.label, 'Map · Population')
})

test('reduceEpochStepProgressOnMapSubstepStart labels session substep under map finalize', () => {
  const progress = reduceEpochStepProgressOnMapSubstepStart(
    reduceEpochStepProgressOnFinalizeStepStart(createInitialEpochStepProgress(), {
      stepIndex: 1,
    }),
    { substepIndex: 0 },
  )
  assert.strictEqual(progress.label, 'Map · Session')
})
