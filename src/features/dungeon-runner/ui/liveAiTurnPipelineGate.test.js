import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_PHASES } from '../engine/kernel.js'
import {
  evaluateLiveAiTurnPipelineGate,
  isActionableAiTurnPhase,
  resolveAiTurnPrefetchSkipReason,
  resolveAiTurnRunSkipReason,
  resolveAiTurnScheduleSkipReason,
} from './liveAiTurnPipelineGate.js'

const aiTurnReadyInputs = {
  hasMatch: true,
  isHumanTurn: false,
  phase: MATCH_PHASES.BIDDING,
  runToken: 'token-1',
  lastAppliedAiTurnToken: '',
  seatId: 'seat-2',
  humanSeatId: 'seat-1',
  roleType: 'nn',
}

test('actionable ai turn phases include bidding dungeon and pick-adventurer only', () => {
  assert.equal(isActionableAiTurnPhase(MATCH_PHASES.BIDDING), true)
  assert.equal(isActionableAiTurnPhase(MATCH_PHASES.DUNGEON), true)
  assert.equal(isActionableAiTurnPhase(MATCH_PHASES.PICK_ADVENTURER), true)
  assert.equal(isActionableAiTurnPhase(MATCH_PHASES.MATCH_OVER), false)
})

test('refresh terminal blocks live ai scheduling while open', () => {
  assert.equal(
    resolveAiTurnScheduleSkipReason({ neuralRefreshTerminalOpen: true, hasMatch: true, isHumanTurn: false }),
    'neural-refresh-terminal',
  )
  assert.equal(
    resolveAiTurnRunSkipReason({ neuralRefreshTerminalOpen: true }),
    'neural-refresh-terminal',
  )
})

test('neural load gate blocks live ai scheduling while in flight', () => {
  assert.equal(
    resolveAiTurnScheduleSkipReason({
      matchNeuralLoadGateInFlight: true,
      hasMatch: true,
      isHumanTurn: false,
    }),
    'neural-load-gate',
  )
})

test('live ai scheduling is gated while headless completion runs', () => {
  assert.equal(
    resolveAiTurnScheduleSkipReason({
      headlessCompletionInFlight: true,
      hasMatch: true,
      isHumanTurn: false,
    }),
    'headless-completion',
  )
  assert.equal(
    resolveAiTurnRunSkipReason({ headlessCompletionInFlight: true }),
    'headless-completion',
  )
  assert.equal(
    resolveAiTurnPrefetchSkipReason({ headlessCompletionInFlight: true }),
    'headless-completion',
  )
})

test('live play prefetch skips while nn model is recovering', () => {
  assert.equal(
    resolveAiTurnPrefetchSkipReason({
      hasMatch: true,
      isHumanTurn: false,
      phase: MATCH_PHASES.BIDDING,
      seatId: 'seat-2',
      humanSeatId: 'seat-1',
      roleType: 'nn',
      runToken: 'token-1',
      modelRecovering: true,
    }),
    'model-recovering',
  )
})

test('schedule skips silently for human turn without logging reason', () => {
  assert.equal(
    resolveAiTurnScheduleSkipReason({ hasMatch: true, isHumanTurn: true }),
    null,
  )
})

test('live ai turn pipeline gate matrix', () => {
  const cases = [
    {
      name: 'match neural load gate in flight',
      inputs: { matchNeuralLoadGateInFlight: true },
      scheduleSkipReason: 'neural-load-gate',
      runSkipReason: 'neural-load-gate',
      prefetchSkipReason: 'neural-load-gate',
    },
    {
      name: 'ai turn in flight',
      inputs: { aiTurnInFlight: true },
      scheduleSkipReason: 'in-flight',
      runSkipReason: 'in-flight',
      prefetchSkipReason: 'in-flight',
    },
    {
      name: 'active neural opponent recovery',
      inputs: { blockForRecovery: true, modelRecovering: true },
      scheduleSkipReason: 'model-recovering',
      runSkipReason: 'model-recovering',
      prefetchSkipReason: null,
    },
    {
      name: 'presentation lock',
      inputs: { gameplayInputLocked: true },
      scheduleSkipReason: 'gameplay-locked',
      runSkipReason: 'gameplay-locked',
      prefetchSkipReason: null,
    },
    {
      name: 'neural recovery refresh terminal',
      inputs: { neuralRefreshTerminalOpen: true },
      scheduleSkipReason: 'neural-refresh-terminal',
      runSkipReason: 'neural-refresh-terminal',
      prefetchSkipReason: 'neural-refresh-terminal',
    },
    {
      name: 'finishing match headless completion',
      inputs: { headlessCompletionInFlight: true },
      scheduleSkipReason: 'headless-completion',
      runSkipReason: 'headless-completion',
      prefetchSkipReason: 'headless-completion',
    },
    {
      name: 'deferred post-dungeon',
      inputs: { deferredPostDungeonState: { awaiting: true } },
      scheduleSkipReason: 'deferred-post-dungeon',
      runSkipReason: 'deferred-post-dungeon',
      prefetchSkipReason: 'deferred-post-dungeon',
    },
  ]

  for (const scenario of cases) {
    const result = evaluateLiveAiTurnPipelineGate({
      ...aiTurnReadyInputs,
      ...scenario.inputs,
    })

    assert.equal(
      result.scheduleSkipReason,
      scenario.scheduleSkipReason,
      `${scenario.name}: schedule skip reason`,
    )
    assert.equal(result.runSkipReason, scenario.runSkipReason, `${scenario.name}: run skip reason`)
    assert.equal(
      result.prefetchSkipReason,
      scenario.prefetchSkipReason,
      `${scenario.name}: prefetch skip reason`,
    )
    assert.equal(result.maySchedule, scenario.scheduleSkipReason === null, `${scenario.name}: maySchedule`)
    assert.equal(result.mayRunTurn, scenario.runSkipReason === null, `${scenario.name}: mayRunTurn`)
    assert.equal(result.mayPrefetch, scenario.prefetchSkipReason === null, `${scenario.name}: mayPrefetch`)

    if (scenario.scheduleSkipReason != null && scenario.name !== 'timer pending') {
      assert.notEqual(
        result.runSkipReason,
        null,
        `${scenario.name}: run blocked whenever schedule is blocked`,
      )
    }
  }
})

test('timer pending blocks schedule only', () => {
  const result = evaluateLiveAiTurnPipelineGate({
    ...aiTurnReadyInputs,
    timerPending: true,
  })

  assert.equal(result.scheduleSkipReason, 'timer-pending')
  assert.equal(result.maySchedule, false)
  assert.equal(result.runSkipReason, null)
  assert.equal(result.mayRunTurn, true)
})
