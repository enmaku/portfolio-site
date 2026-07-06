import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInitialRehydrateColonizationProgress,
  reduceRehydrateColonizationProgressOnCollapseSubstepStart,
  reduceRehydrateColonizationProgressOnRunComplete,
  reduceRehydrateColonizationProgressOnSessionSubstepComplete,
  reduceRehydrateColonizationProgressOnSessionSubstepStart,
  reduceRehydrateColonizationProgressOnStepComplete,
  reduceRehydrateColonizationProgressOnStepStart,
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
    substepIndex: 1,
  })
  assert.strictEqual(next.activeCollapseSubstepIndex, 1)
  assert.match(next.label, /Hinterland/)
})

test('reduceRehydrateColonizationProgressOnRunComplete finishes at 100%', () => {
  const next = reduceRehydrateColonizationProgressOnRunComplete(
    createInitialRehydrateColonizationProgress(),
  )
  assert.strictEqual(next.percent, 100)
  assert.strictEqual(next.activeStepIndex, -1)
})
