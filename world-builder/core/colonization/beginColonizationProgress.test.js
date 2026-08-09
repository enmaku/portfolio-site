import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createInitialBeginColonizationProgress,
  reduceBeginColonizationProgressOnRunComplete,
  reduceBeginColonizationProgressOnStepComplete,
  reduceBeginColonizationProgressOnStepStart,
} from './beginColonizationProgress.js'

test('reduceBeginColonizationProgressOnStepStart sets active step and label', () => {
  const next = reduceBeginColonizationProgressOnStepStart(createInitialBeginColonizationProgress(), {
    stepIndex: 2,
    label: 'Ruin',
  })
  assert.strictEqual(next.activeStepIndex, 2)
  assert.strictEqual(next.label, 'Ruin')
})

test('reduceBeginColonizationProgressOnStepComplete advances percent', () => {
  const next = reduceBeginColonizationProgressOnStepComplete(createInitialBeginColonizationProgress(), {
    stepIndex: 3,
  })
  assert.strictEqual(next.completedStepIndex, 3)
  assert.ok(next.percent > 0)
})

test('reduceBeginColonizationProgressOnRunComplete finishes at 100%', () => {
  const next = reduceBeginColonizationProgressOnRunComplete(createInitialBeginColonizationProgress())
  assert.strictEqual(next.percent, 100)
  assert.strictEqual(next.activeStepIndex, -1)
})
