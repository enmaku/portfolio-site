import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInitialEpochStepProgress,
  epochStepProgressValue,
  epochStepUnitCount,
  epochStepUnitIndex,
  reduceEpochStepProgressOnCollapseSubstepItemProgress,
  reduceEpochStepProgressOnCollapseSubstepStart,
  reduceEpochStepProgressOnEpochStart,
  reduceEpochStepProgressOnFinalizeStepStart,
  reduceEpochStepProgressOnMapSubstepStart,
  reduceEpochStepProgressOnNetworkSubstepStart,
  reduceEpochStepProgressOnNetworkSubstepItemProgress,
  reduceEpochStepProgressOnPhaseStart,
  reduceEpochStepProgressOnTradeSubstepStart,
  reduceEpochStepProgressOnPoliticsSubstepStart,
} from './colonizationEpochProgress.js'
import {
  COLONIZATION_EPOCH_FINALIZE_STEP_COUNT,
  COLONIZATION_EPOCH_PHASE_COUNT,
} from './colonizationEpochSteps.js'

function assertLabelSet(progress) {
  assert.strictEqual(typeof progress.label, 'string')
  assert.ok(progress.label.length > 0)
}

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
    networkSubstepItemIndex: -1,
    networkSubstepItemCount: 0,
    networkSubstepPhase: '',
    networkSubstepPhasePercent: -1,
    activeCollapseSubstepIndex: -1,
    completedCollapseSubstepIndex: -1,
    collapseSubstepItemIndex: -1,
    collapseSubstepItemCount: 0,
    activeTradeSubstepIndex: -1,
    completedTradeSubstepIndex: -1,
    tradeSubstepItemIndex: -1,
    tradeSubstepItemCount: 0,
    activePoliticsSubstepIndex: -1,
    completedPoliticsSubstepIndex: -1,
    politicsSubstepItemIndex: -1,
    politicsSubstepItemCount: 0,
    activeFinalizeStepIndex: -1,
    completedFinalizeStepIndex: -1,
    activeMapSubstepIndex: -1,
    completedMapSubstepIndex: -1,
  })
})

test('epochStepProgressValue scales by completed units across phases and finalize', () => {
  const unitCount = epochStepUnitCount()
  assert.strictEqual(unitCount, COLONIZATION_EPOCH_PHASE_COUNT + COLONIZATION_EPOCH_FINALIZE_STEP_COUNT)
  assert.strictEqual(epochStepProgressValue(epochStepUnitIndex(0), unitCount), 11)
  assert.strictEqual(
    epochStepProgressValue(epochStepUnitIndex(COLONIZATION_EPOCH_PHASE_COUNT - 1), unitCount),
    89,
  )
})

test('reduceEpochStepProgressOnEpochStart sets epoch progress', () => {
  const next = reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(), {
    simulationEpoch: 12,
  })
  assert.strictEqual(next.activeEpochIndex, 0)
  assertLabelSet(next)
})

test('reduceEpochStepProgressOnPhaseStart sets active phase', () => {
  const progress = reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(), {
    simulationEpoch: 0,
  })
  const next = reduceEpochStepProgressOnPhaseStart(progress, {
    simulationEpoch: 0,
    phaseIndex: 1,
    phaseId: 'claims',
  })
  assert.strictEqual(next.activePhaseIndex, 1)
  assertLabelSet(next)
})

test('reduceEpochStepProgressOnNetworkSubstepStart sets network substep', () => {
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
  assertLabelSet(next)
})

test('reduceEpochStepProgressOnNetworkSubstepItemProgress appends item counter', () => {
  const progress = reduceEpochStepProgressOnNetworkSubstepStart(
    reduceEpochStepProgressOnPhaseStart(
      reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(), {
        simulationEpoch: 0,
      }),
      {
        simulationEpoch: 0,
        phaseIndex: 0,
        phaseId: 'network',
      },
    ),
    { substepIndex: 2 },
  )
  const next = reduceEpochStepProgressOnNetworkSubstepItemProgress(progress, {
    substepIndex: 2,
    itemIndex: 4,
    itemCount: 11,
  })
  assert.strictEqual(next.networkSubstepItemIndex, 4)
  assert.strictEqual(next.networkSubstepItemCount, 11)
  assertLabelSet(next)
})

test('reduceEpochStepProgressOnNetworkSubstepItemProgress clears phase when omitted', () => {
  const next = reduceEpochStepProgressOnNetworkSubstepItemProgress(
    reduceEpochStepProgressOnNetworkSubstepStart(
      reduceEpochStepProgressOnPhaseStart(
        reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(), {
          simulationEpoch: 0,
        }),
        {
          simulationEpoch: 0,
          phaseIndex: 0,
          phaseId: 'network',
        },
      ),
      { substepIndex: 1 },
    ),
    {
      substepIndex: 1,
      itemIndex: 3,
      itemCount: 9,
    },
  )
  assert.strictEqual(next.networkSubstepPhase, '')
  assert.strictEqual(next.networkSubstepPhasePercent, -1)
  assertLabelSet(next)
})

test('reduceEpochStepProgressOnNetworkSubstepItemProgress records phase percent when provided', () => {
  const next = reduceEpochStepProgressOnNetworkSubstepItemProgress(
    reduceEpochStepProgressOnNetworkSubstepStart(
      reduceEpochStepProgressOnPhaseStart(
        reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(), {
          simulationEpoch: 0,
        }),
        {
          simulationEpoch: 0,
          phaseIndex: 0,
          phaseId: 'network',
        },
      ),
      { substepIndex: 1 },
    ),
    {
      substepIndex: 1,
      itemIndex: 3,
      itemCount: 9,
      phase: 'Land',
      phasePercent: 45,
    },
  )
  assert.strictEqual(next.networkSubstepPhase, 'Land')
  assert.strictEqual(next.networkSubstepPhasePercent, 45)
  assertLabelSet(next)
})

test('reduceEpochStepProgressOnCollapseSubstepStart sets collapse substep', () => {
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
  const next = reduceEpochStepProgressOnCollapseSubstepStart(progress, { substepIndex: 2 })
  assert.strictEqual(next.activeCollapseSubstepIndex, 2)
  assertLabelSet(next)
})

test('reduceEpochStepProgressOnCollapseSubstepItemProgress appends item counter', () => {
  const progress = reduceEpochStepProgressOnCollapseSubstepStart(
    reduceEpochStepProgressOnPhaseStart(
      reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(), {
        simulationEpoch: 0,
      }),
      {
        simulationEpoch: 0,
        phaseIndex: 5,
        phaseId: 'collapse',
      },
    ),
    { substepIndex: 2 },
  )
  const next = reduceEpochStepProgressOnCollapseSubstepItemProgress(progress, {
    substepIndex: 2,
    itemIndex: 128,
    itemCount: 400,
  })
  assert.strictEqual(next.collapseSubstepItemIndex, 128)
  assert.strictEqual(next.collapseSubstepItemCount, 400)
  assertLabelSet(next)
})

test('reduceEpochStepProgressOnTradeSubstepStart sets trade substep', () => {
  const progress = reduceEpochStepProgressOnPhaseStart(
    reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(), {
      simulationEpoch: 0,
    }),
    {
      simulationEpoch: 0,
      phaseIndex: 2,
      phaseId: 'trade',
    },
  )
  const next = reduceEpochStepProgressOnTradeSubstepStart(progress, { substepIndex: 2 })
  assert.strictEqual(next.activeTradeSubstepIndex, 2)
  assertLabelSet(next)
})

test('reduceEpochStepProgressOnPoliticsSubstepStart sets politics substep', () => {
  const progress = reduceEpochStepProgressOnPhaseStart(
    reduceEpochStepProgressOnEpochStart(createInitialEpochStepProgress(), {
      simulationEpoch: 0,
    }),
    {
      simulationEpoch: 0,
      phaseIndex: 7,
      phaseId: 'politics',
    },
  )
  const next = reduceEpochStepProgressOnPoliticsSubstepStart(progress, { substepIndex: 2 })
  assert.strictEqual(next.activePoliticsSubstepIndex, 2)
  assertLabelSet(next)
  const conflict = reduceEpochStepProgressOnPoliticsSubstepStart(progress, { substepIndex: 3 })
  assert.strictEqual(conflict.activePoliticsSubstepIndex, 3)
  assertLabelSet(conflict)
})

test('reduceEpochStepProgressOnFinalizeStepStart marks map finalize after simulation phases', () => {
  const progress = reduceEpochStepProgressOnFinalizeStepStart(
    {
      ...createInitialEpochStepProgress(),
      completedEpochIndex: 0,
      completedPhaseIndex: COLONIZATION_EPOCH_PHASE_COUNT - 1,
    },
    { stepIndex: 0 },
  )
  assert.strictEqual(progress.activeFinalizeStepIndex, 0)
  assertLabelSet(progress)
  assert.strictEqual(progress.completedPhaseIndex, COLONIZATION_EPOCH_PHASE_COUNT - 1)
})

test('reduceEpochStepProgressOnMapSubstepStart sets map substep', () => {
  const progress = reduceEpochStepProgressOnMapSubstepStart(
    reduceEpochStepProgressOnFinalizeStepStart(createInitialEpochStepProgress(), {
      stepIndex: 0,
    }),
    { substepIndex: 3 },
  )
  assert.strictEqual(progress.activeMapSubstepIndex, 3)
  assertLabelSet(progress)
})

test('reduceEpochStepProgressOnMapSubstepStart sets session map substep index', () => {
  const progress = reduceEpochStepProgressOnMapSubstepStart(
    reduceEpochStepProgressOnFinalizeStepStart(createInitialEpochStepProgress(), {
      stepIndex: 0,
    }),
    { substepIndex: 0 },
  )
  assert.strictEqual(progress.activeMapSubstepIndex, 0)
  assertLabelSet(progress)
})
