import { MATCH_PHASES } from '../engine/kernel.js'

const ACTIONABLE_AI_TURN_PHASES = new Set([
  MATCH_PHASES.BIDDING,
  MATCH_PHASES.DUNGEON,
  MATCH_PHASES.PICK_ADVENTURER,
])

export function isActionableAiTurnPhase(phase) {
  return ACTIONABLE_AI_TURN_PHASES.has(phase)
}

function resolveScheduleSkipReasonFromInputs({
  neuralRefreshTerminalOpen = false,
  matchNeuralLoadGateInFlight = false,
  aiTurnInFlight = false,
  headlessCompletionInFlight = false,
  deferredPostDungeonState = null,
  hasMatch = true,
  isHumanTurn = false,
  blockForRecovery = false,
  gameplayInputLocked = false,
  phase = null,
  runToken = '',
  lastAppliedAiTurnToken = '',
  timerPending = false,
} = {}) {
  if (neuralRefreshTerminalOpen) return 'neural-refresh-terminal'
  if (matchNeuralLoadGateInFlight) return 'neural-load-gate'
  if (aiTurnInFlight) return 'in-flight'
  if (headlessCompletionInFlight) return 'headless-completion'
  if (deferredPostDungeonState) return 'deferred-post-dungeon'
  if (!hasMatch || isHumanTurn) return null
  if (blockForRecovery) return 'model-recovering'
  if (gameplayInputLocked) return 'gameplay-locked'
  if (phase != null && !isActionableAiTurnPhase(phase)) return 'phase-not-actionable'
  if (runToken && runToken === lastAppliedAiTurnToken) return 'already-applied-token'
  if (timerPending) return 'timer-pending'
  return null
}

function resolveRunSkipReasonFromInputs({
  neuralRefreshTerminalOpen = false,
  matchNeuralLoadGateInFlight = false,
  aiTurnInFlight = false,
  headlessCompletionInFlight = false,
  deferredPostDungeonState = null,
  hasMatch = true,
  isHumanTurn = false,
  blockForRecovery = false,
  gameplayInputLocked = false,
  phase = null,
  seatId = null,
  humanSeatId = null,
  runToken = '',
  lastAppliedAiTurnToken = '',
} = {}) {
  if (neuralRefreshTerminalOpen) return 'neural-refresh-terminal'
  if (matchNeuralLoadGateInFlight) return 'neural-load-gate'
  if (aiTurnInFlight) return 'in-flight'
  if (headlessCompletionInFlight) return 'headless-completion'
  if (deferredPostDungeonState) return 'deferred-post-dungeon'
  if (!hasMatch || isHumanTurn) return 'phase-not-actionable'
  if (blockForRecovery) return 'model-recovering'
  if (gameplayInputLocked) return 'gameplay-locked'
  if (phase != null && !isActionableAiTurnPhase(phase)) return 'phase-not-actionable'
  if (!seatId || seatId === humanSeatId) return 'not-ai-seat'
  if (runToken && runToken === lastAppliedAiTurnToken) return 'duplicate-token'
  return null
}

function resolvePrefetchSkipReasonFromInputs({
  headlessCompletionInFlight = false,
  matchNeuralLoadGateInFlight = false,
  neuralRefreshTerminalOpen = false,
  deferredPostDungeonState = null,
  hasMatch = true,
  isHumanTurn = false,
  blockForRecovery = false,
  phase = null,
  seatId = null,
  humanSeatId = null,
  roleType = null,
  pickAdventurerNnEnabled = true,
  runToken = '',
  lastAppliedAiTurnToken = '',
  modelRecovering = false,
} = {}) {
  if (headlessCompletionInFlight) return 'headless-completion'
  if (matchNeuralLoadGateInFlight) return 'neural-load-gate'
  if (neuralRefreshTerminalOpen) return 'neural-refresh-terminal'
  if (deferredPostDungeonState) return 'deferred-post-dungeon'
  if (!hasMatch) return 'no-match'
  if (isHumanTurn) return 'human-turn'
  if (!seatId || seatId === humanSeatId) return 'not-ai-seat'
  if (phase != null && !isActionableAiTurnPhase(phase)) return 'phase'
  if (!runToken || runToken === lastAppliedAiTurnToken) return 'token-not-ready'
  if (roleType !== 'nn') return 'not-nn-seat'
  if (phase === MATCH_PHASES.PICK_ADVENTURER && !pickAdventurerNnEnabled) return 'random-pick-adventurer'
  if (modelRecovering && !blockForRecovery) return 'model-recovering'
  return null
}

export function evaluateLiveAiTurnPipelineGate(inputs = {}) {
  const scheduleSkipReason = resolveScheduleSkipReasonFromInputs(inputs)
  const runSkipReason = resolveRunSkipReasonFromInputs(inputs)
  const prefetchSkipReason = resolvePrefetchSkipReasonFromInputs(inputs)

  return {
    maySchedule: scheduleSkipReason === null,
    mayPrefetch: prefetchSkipReason === null,
    mayRunTurn: runSkipReason === null,
    scheduleSkipReason,
    runSkipReason,
    prefetchSkipReason,
  }
}

export function resolveAiTurnScheduleSkipReason(inputs = {}) {
  return evaluateLiveAiTurnPipelineGate(inputs).scheduleSkipReason
}

export function resolveAiTurnRunSkipReason(inputs = {}) {
  return evaluateLiveAiTurnPipelineGate(inputs).runSkipReason
}

export function resolveAiTurnPrefetchSkipReason(inputs = {}) {
  return evaluateLiveAiTurnPipelineGate(inputs).prefetchSkipReason
}
