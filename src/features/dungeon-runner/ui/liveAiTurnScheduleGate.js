import { MATCH_PHASES } from '../engine/kernel.js'

const ACTIONABLE_AI_TURN_PHASES = new Set([
  MATCH_PHASES.BIDDING,
  MATCH_PHASES.DUNGEON,
  MATCH_PHASES.PICK_ADVENTURER,
])

export function isActionableAiTurnPhase(phase) {
  return ACTIONABLE_AI_TURN_PHASES.has(phase)
}

export function resolveAiTurnScheduleSkipReason({
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

export function resolveAiTurnRunSkipReason({
  neuralRefreshTerminalOpen = false,
  aiTurnInFlight = false,
  headlessCompletionInFlight = false,
  gameplayInputLocked = false,
  hasMatch = true,
  phase = null,
  seatId = null,
  humanSeatId = null,
  blockForRecovery = false,
  runToken = '',
  lastAppliedAiTurnToken = '',
} = {}) {
  if (neuralRefreshTerminalOpen) return 'neural-refresh-terminal'
  if (aiTurnInFlight) return 'in-flight'
  if (headlessCompletionInFlight) return 'headless-completion'
  if (gameplayInputLocked) return 'gameplay-locked'
  if (!hasMatch || (phase != null && !isActionableAiTurnPhase(phase))) return 'phase-not-actionable'
  if (!seatId || seatId === humanSeatId) return 'not-ai-seat'
  if (blockForRecovery) return 'model-recovering'
  if (runToken && runToken === lastAppliedAiTurnToken) return 'duplicate-token'
  return null
}

export function resolveAiTurnPrefetchSkipReason({
  headlessCompletionInFlight = false,
  hasMatch = true,
  isHumanTurn = false,
  phase = null,
  seatId = null,
  humanSeatId = null,
  roleType = null,
  pickAdventurerNnEnabled = true,
  runToken = '',
  lastAppliedAiTurnToken = '',
  neuralRefreshTerminalOpen = false,
  modelRecovering = false,
} = {}) {
  if (headlessCompletionInFlight) return 'headless-completion'
  if (!hasMatch) return 'no-match'
  if (isHumanTurn) return 'human-turn'
  if (!seatId || seatId === humanSeatId) return 'not-ai-seat'
  if (phase != null && !isActionableAiTurnPhase(phase)) return 'phase'
  if (!runToken || runToken === lastAppliedAiTurnToken) return 'token-not-ready'
  if (roleType !== 'nn') return 'not-nn-seat'
  if (phase === MATCH_PHASES.PICK_ADVENTURER && !pickAdventurerNnEnabled) return 'random-pick-adventurer'
  if (neuralRefreshTerminalOpen) return 'neural-refresh-terminal'
  if (modelRecovering) return 'model-recovering'
  return null
}
