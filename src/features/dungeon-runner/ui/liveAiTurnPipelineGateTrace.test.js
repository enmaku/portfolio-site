import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAiTurnPrefetchSkipTrace,
  buildAiTurnRunSkipTrace,
  buildAiTurnScheduleSkipTrace,
} from './liveAiTurnPipelineGateTrace.js'

function gateWithScheduleReason(reason) {
  return {
    maySchedule: reason === null,
    scheduleSkipReason: reason,
    mayRunTurn: true,
    runSkipReason: null,
    mayPrefetch: true,
    prefetchSkipReason: null,
  }
}

function gateWithRunReason(reason) {
  return {
    maySchedule: true,
    scheduleSkipReason: null,
    mayRunTurn: reason === null,
    runSkipReason: reason,
    mayPrefetch: true,
    prefetchSkipReason: null,
  }
}

function gateWithPrefetchReason(reason) {
  return {
    maySchedule: true,
    scheduleSkipReason: null,
    mayRunTurn: true,
    runSkipReason: null,
    mayPrefetch: reason === null,
    prefetchSkipReason: reason,
  }
}

test('schedule skip trace returns null when gate has no skip reason', () => {
  assert.equal(buildAiTurnScheduleSkipTrace(gateWithScheduleReason(null), {}), null)
})

test('schedule skip trace maps gameplay-locked to presentation queue metrics', () => {
  const snapshot = [
    { kind: 'dungeon-reveal', remainingMs: 100 },
    { kind: 'turn-handoff', remainingMs: 50 },
  ]
  const result = buildAiTurnScheduleSkipTrace(gateWithScheduleReason('gameplay-locked'), {
    runToken: 'tok-1',
    presentationQueueSnapshot: snapshot,
  })
  assert.deepEqual(result, {
    reason: 'gameplay-locked',
    detail: {
      activeKind: 'dungeon-reveal',
      queueMs: 150,
      queueKinds: ['dungeon-reveal', 'turn-handoff'],
      runToken: 'tok-1',
    },
  })
})

test('schedule skip trace maps model-recovering to active seat id', () => {
  const result = buildAiTurnScheduleSkipTrace(gateWithScheduleReason('model-recovering'), {
    activeSeatId: 'seat-2',
  })
  assert.deepEqual(result, {
    reason: 'model-recovering',
    detail: { activeSeatId: 'seat-2' },
  })
})

test('schedule skip trace maps phase-not-actionable to phase', () => {
  const result = buildAiTurnScheduleSkipTrace(gateWithScheduleReason('phase-not-actionable'), {
    phase: 'match-over',
  })
  assert.deepEqual(result, {
    reason: 'phase-not-actionable',
    detail: { phase: 'match-over' },
  })
})

test('schedule skip trace maps token reasons to runToken', () => {
  for (const reason of ['already-applied-token', 'timer-pending']) {
    const result = buildAiTurnScheduleSkipTrace(gateWithScheduleReason(reason), {
      runToken: 'tok-9',
    })
    assert.deepEqual(result, { reason, detail: { runToken: 'tok-9' } })
  }
})

test('run skip trace returns null when gate has no skip reason', () => {
  assert.equal(buildAiTurnRunSkipTrace(gateWithRunReason(null), {}), null)
})

test('run skip trace maps gameplay-locked to presentation context', () => {
  const result = buildAiTurnRunSkipTrace(gateWithRunReason('gameplay-locked'), {
    activePresentationKind: 'dungeon-reveal',
    queueMs: 240,
  })
  assert.deepEqual(result, {
    step: 'run.skip',
    detail: {
      reason: 'gameplay-locked',
      activePresentation: 'dungeon-reveal',
      queueMs: 240,
    },
  })
})

test('run skip trace maps phase-not-actionable to phase', () => {
  const result = buildAiTurnRunSkipTrace(gateWithRunReason('phase-not-actionable'), {
    phase: 'match-over',
  })
  assert.deepEqual(result, {
    step: 'run.skip',
    detail: { reason: 'phase-not-actionable', phase: 'match-over' },
  })
})

test('run skip trace maps not-ai-seat to seat ids', () => {
  const result = buildAiTurnRunSkipTrace(gateWithRunReason('not-ai-seat'), {
    seatId: 'seat-1',
    humanSeatId: 'seat-1',
  })
  assert.deepEqual(result, {
    step: 'run.skip',
    detail: { reason: 'not-ai-seat', seatId: 'seat-1', humanSeatId: 'seat-1' },
  })
})

test('run skip trace maps model-recovering to seat id', () => {
  const result = buildAiTurnRunSkipTrace(gateWithRunReason('model-recovering'), {
    seatId: 'seat-3',
  })
  assert.deepEqual(result, {
    step: 'run.skip',
    detail: { reason: 'model-recovering', seatId: 'seat-3' },
  })
})

test('run skip trace maps duplicate-token to run token fields', () => {
  const result = buildAiTurnRunSkipTrace(gateWithRunReason('duplicate-token'), {
    runToken: 'tok-a',
    lastAppliedAiTurnToken: 'tok-a',
  })
  assert.deepEqual(result, {
    step: 'run.skip',
    detail: { reason: 'duplicate-token', runToken: 'tok-a', lastAppliedAiTurnToken: 'tok-a' },
  })
})

test('prefetch skip trace returns null when gate has no skip reason', () => {
  assert.equal(buildAiTurnPrefetchSkipTrace(gateWithPrefetchReason(null), {}), null)
})

test('prefetch skip trace maps token-not-ready to runToken', () => {
  const result = buildAiTurnPrefetchSkipTrace(gateWithPrefetchReason('token-not-ready'), {
    runToken: 'tok-7',
  })
  assert.deepEqual(result, {
    reason: 'token-not-ready',
    detail: { runToken: 'tok-7' },
  })
})

test('prefetch skip trace maps not-ai-seat to seatId', () => {
  const result = buildAiTurnPrefetchSkipTrace(gateWithPrefetchReason('not-ai-seat'), {
    seatId: 'seat-1',
  })
  assert.deepEqual(result, {
    reason: 'not-ai-seat',
    detail: { seatId: 'seat-1' },
  })
})

test('prefetch skip trace maps phase to phase detail', () => {
  const result = buildAiTurnPrefetchSkipTrace(gateWithPrefetchReason('phase'), {
    phase: 'match-over',
  })
  assert.deepEqual(result, {
    reason: 'phase',
    detail: { phase: 'match-over' },
  })
})

test('prefetch skip trace maps model-recovering to modelId', () => {
  const result = buildAiTurnPrefetchSkipTrace(gateWithPrefetchReason('model-recovering'), {
    modelId: 'model-x',
  })
  assert.deepEqual(result, {
    reason: 'model-recovering',
    detail: { modelId: 'model-x' },
  })
})
