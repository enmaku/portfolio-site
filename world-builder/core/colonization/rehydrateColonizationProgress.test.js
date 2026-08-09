import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInitialRehydrateColonizationProgress,
  reduceRehydrateColonizationProgressOnCollapseSubstepItemProgress,
  reduceRehydrateColonizationProgressOnCollapseSubstepStart,
  reduceRehydrateColonizationProgressOnRunComplete,
  reduceRehydrateColonizationProgressOnSessionSubstepComplete,
  reduceRehydrateColonizationProgressOnSessionSubstepStart,
  reduceRehydrateColonizationProgressOnStepComplete,
  reduceRehydrateColonizationProgressOnStepStart,
  reduceRehydrateColonizationProgressOnVisitedSubstepComplete,
  reduceRehydrateColonizationProgressOnVisitedSubstepItemProgress,
  reduceRehydrateColonizationProgressOnVisitedSubstepStart,
} from './rehydrateColonizationProgress.js'

test('reduceRehydrateColonizationProgressOnStepStart sets active step and label', () => {
  const next = reduceRehydrateColonizationProgressOnStepStart(
    createInitialRehydrateColonizationProgress(),
    {
      stepIndex: 1,
      label: 'Claims',
    },
  )
  assert.strictEqual(next.activeStepIndex, 1)
  assert.strictEqual(next.label, 'Claims')
})

test('reduceRehydrateColonizationProgressOnStepComplete advances percent', () => {
  const next = reduceRehydrateColonizationProgressOnStepComplete(
    createInitialRehydrateColonizationProgress(),
    {
      stepIndex: 2,
    },
  )
  assert.strictEqual(next.completedStepIndex, 2)
  assert.ok(next.percent > 0)
})

test('reduceRehydrateColonizationProgressOnSessionSubstepStart sets active session substep', () => {
  const started = reduceRehydrateColonizationProgressOnStepStart(
    createInitialRehydrateColonizationProgress(),
    {
      stepIndex: 1,
      label: 'Session',
    },
  )
  const next = reduceRehydrateColonizationProgressOnSessionSubstepStart(started, {
    substepIndex: 2,
  })
  assert.strictEqual(next.activeSessionSubstepIndex, 2)
})

test('reduceRehydrateColonizationProgressOnSessionSubstepComplete advances completed session substep', () => {
  const next = reduceRehydrateColonizationProgressOnSessionSubstepComplete(
    createInitialRehydrateColonizationProgress(),
    { substepIndex: 1 },
  )
  assert.strictEqual(next.completedSessionSubstepIndex, 1)
})

test('reduceRehydrateColonizationProgressOnCollapseSubstepStart updates collapse label', () => {
  const started = reduceRehydrateColonizationProgressOnStepStart(
    createInitialRehydrateColonizationProgress(),
    {
      stepIndex: 3,
      label: 'Collapse',
    },
  )
  const next = reduceRehydrateColonizationProgressOnCollapseSubstepStart(started, {
    substepIndex: 2,
  })
  assert.strictEqual(next.activeCollapseSubstepIndex, 2)
  assert.match(next.label, /Hinterland/)
})

test('reduceRehydrateColonizationProgressOnCollapseSubstepItemProgress tracks item progress', () => {
  const started = reduceRehydrateColonizationProgressOnCollapseSubstepStart(
    reduceRehydrateColonizationProgressOnStepStart(createInitialRehydrateColonizationProgress(), {
      stepIndex: 3,
      label: 'Collapse',
    }),
    { substepIndex: 0 },
  )
  const next = reduceRehydrateColonizationProgressOnCollapseSubstepItemProgress(started, {
    substepIndex: 0,
    itemIndex: 2,
    itemCount: 5,
  })
  assert.strictEqual(next.collapseSubstepItemIndex, 2)
  assert.strictEqual(next.collapseSubstepItemCount, 5)
  assert.match(next.label, /Prepare 2\/5/)
})

test('reduceRehydrateColonizationProgressOnVisitedSubstepStart sets active visited substep', () => {
  const started = reduceRehydrateColonizationProgressOnStepStart(
    createInitialRehydrateColonizationProgress(),
    {
      stepIndex: 5,
      label: 'Visited',
    },
  )
  const next = reduceRehydrateColonizationProgressOnVisitedSubstepStart(started, {
    substepIndex: 1,
  })
  assert.strictEqual(next.activeVisitedSubstepIndex, 1)
  assert.match(next.label, /Expeditions/)
})

test('reduceRehydrateColonizationProgressOnVisitedSubstepItemProgress tracks item progress', () => {
  const started = reduceRehydrateColonizationProgressOnVisitedSubstepStart(
    createInitialRehydrateColonizationProgress(),
    { substepIndex: 0 },
  )
  const next = reduceRehydrateColonizationProgressOnVisitedSubstepItemProgress(started, {
    itemIndex: 3,
    itemCount: 49,
  })
  assert.strictEqual(next.visitedSubstepItemIndex, 3)
  assert.strictEqual(next.visitedSubstepItemCount, 49)
})

test('reduceRehydrateColonizationProgressOnVisitedSubstepComplete advances completed visited substep', () => {
  const next = reduceRehydrateColonizationProgressOnVisitedSubstepComplete(
    createInitialRehydrateColonizationProgress(),
    { substepIndex: 2 },
  )
  assert.strictEqual(next.completedVisitedSubstepIndex, 2)
  assert.strictEqual(next.visitedSubstepItemIndex, -1)
  assert.strictEqual(next.visitedSubstepItemCount, 0)
})

test('reduceRehydrateColonizationProgressOnStepComplete clears visited substep progress', () => {
  const progressed = reduceRehydrateColonizationProgressOnVisitedSubstepItemProgress(
    createInitialRehydrateColonizationProgress(),
    { itemIndex: 3, itemCount: 49 },
  )
  const next = reduceRehydrateColonizationProgressOnStepComplete(progressed, {
    stepIndex: 5,
  })
  assert.strictEqual(next.activeVisitedSubstepIndex, -1)
  assert.strictEqual(next.completedVisitedSubstepIndex, -1)
  assert.strictEqual(next.visitedSubstepItemIndex, -1)
  assert.strictEqual(next.visitedSubstepItemCount, 0)
})

test('reduceRehydrateColonizationProgressOnRunComplete finishes at 100%', () => {
  const next = reduceRehydrateColonizationProgressOnRunComplete(
    createInitialRehydrateColonizationProgress(),
  )
  assert.strictEqual(next.percent, 100)
  assert.strictEqual(next.activeStepIndex, -1)
  assert.strictEqual(next.activeVisitedSubstepIndex, -1)
})
