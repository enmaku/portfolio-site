import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_PHASES } from '../engine/kernel.js'
import {
  isActionableAiTurnPhase,
  resolveAiTurnPrefetchSkipReason,
  resolveAiTurnRunSkipReason,
  resolveAiTurnScheduleSkipReason,
} from './liveAiTurnScheduleGate.js'

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
