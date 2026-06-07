import { MATCH_PHASES, applyAction } from '../engine/kernel.js'
import { isDungeonOutcomeDialogOpen } from './dungeonOutcomeDialog.js'
import { isHumanEliminated, needsHeadlessCompletion } from './humanEliminationCompletionPolicy.js'

export const DEFAULT_MAX_HEADLESS_ACTIONS = 500

export const HEADLESS_COMPLETION_ERROR_CODES = {
  SAFETY_CAP: 'SAFETY_CAP',
  NOT_ACTIONABLE: 'NOT_ACTIONABLE',
  NO_ACTIVE_SEAT: 'NO_ACTIVE_SEAT',
  HUMAN_TURN_UNEXPECTED: 'HUMAN_TURN_UNEXPECTED',
  NO_ACTION: 'NO_ACTION',
  APPLY_FAILED: 'APPLY_FAILED',
}

const ACTIONABLE_PHASES = new Set([
  MATCH_PHASES.BIDDING,
  MATCH_PHASES.DUNGEON,
  MATCH_PHASES.PICK_ADVENTURER,
])

export function shouldDeferDungeonExitUntilOutcomeAck(prevState, nextState) {
  if (prevState.phase !== MATCH_PHASES.DUNGEON) return false
  if (nextState.phase === MATCH_PHASES.MATCH_OVER) return true
  return (
    nextState.phase === MATCH_PHASES.PICK_ADVENTURER && nextState.lastDungeonRun != null
  )
}

export function shouldAutoContinueDeferredDungeonExit({
  deferredPostDungeonState = null,
  lastDungeonRun = null,
  dismissedDungeonRun = null,
} = {}) {
  if (!deferredPostDungeonState) return false
  return !isDungeonOutcomeDialogOpen({ lastDungeonRun, dismissedDungeonRun })
}

export function canContinueFromDungeonOutcome({
  lastDungeonRun = null,
  deferredPostDungeonState = null,
} = {}) {
  return Boolean(lastDungeonRun || deferredPostDungeonState)
}

/**
 * Mirrors live deferral after a dungeon exit that must wait for outcome acknowledgement.
 * @returns {{ displayState: typeof prevState, deferredState: typeof nextState | null }}
 */
export function buildDeferredDungeonOutcomeDisplayState(prevState, nextState) {
  if (!shouldDeferDungeonExitUntilOutcomeAck(prevState, nextState)) {
    return { displayState: nextState, deferredState: null }
  }
  return {
    displayState: { ...nextState, phase: MATCH_PHASES.DUNGEON },
    deferredState: nextState,
  }
}

/**
 * After reload, persisted match state may still show dungeon phase while pick-adventurer
 * is already active (outcome dialog was deferred). Headless completion needs pick-adventurer.
 */
export function resolveHeadlessCompletionStartState(state, humanPlayerSeatId) {
  if (
    state?.phase === MATCH_PHASES.DUNGEON &&
    state.lastDungeonRun != null &&
    isHumanEliminated(state, humanPlayerSeatId) &&
    state.pickAdventurer?.activeSeatId
  ) {
    return { ...state, phase: MATCH_PHASES.PICK_ADVENTURER }
  }
  return state
}

/** Mirrors continueFromDungeonOutcome applying deferredPostDungeonState before headless completion. */
export function resolveStateAfterDungeonOutcomeContinue(displayedState, deferredPostDungeonState) {
  if (deferredPostDungeonState) {
    return deferredPostDungeonState
  }
  return displayedState
}

/** Mirrors `headlessCompletionInFlight` / finishing-match overlay visibility on the page. */
export function shouldShowFinishingMatchOverlay(headlessCompletionInFlight) {
  return headlessCompletionInFlight === true
}

/** Mirrors live AI scheduling / prefetch gates while headless completion runs. */
export function shouldBlockLiveAiPipelineWhileHeadless(headlessCompletionInFlight) {
  return headlessCompletionInFlight === true
}

export function createHeadlessCompletionFlightGate() {
  let inFlight = false
  return {
    get inFlight() {
      return inFlight
    },
    tryStart() {
      if (inFlight) return false
      inFlight = true
      return true
    },
    finish() {
      inFlight = false
    },
  }
}

/**
 * Mirrors `maybeRunHeadlessMatchCompletion` engine work (policy, start-state resolve, runner).
 * @param {import('../engine/kernel.js').ReturnType<typeof import('../engine/kernel.js').createInitialMatchState>} state
 */
export async function runMaybeHeadlessMatchCompletionFromState(state, options) {
  const humanPlayerSeatId = options.humanPlayerSeatId
  const chooseAction = options.chooseAction
  const gate = options.gate ?? createHeadlessCompletionFlightGate()
  const afterFlightStart = options.afterFlightStart

  if (!needsHeadlessCompletion(state, humanPlayerSeatId)) {
    return { ran: false, state, gate, skippedReason: 'NOT_NEEDED' }
  }
  if (!gate.tryStart()) {
    return { ran: false, state, gate, skippedReason: 'IN_FLIGHT' }
  }
  try {
    await afterFlightStart?.()
    const startState = resolveHeadlessCompletionStartState(state, humanPlayerSeatId)
    const result = await runHeadlessMatchCompletion(startState, {
      chooseAction,
      humanPlayerSeatId,
      maxActions: options.maxActions,
      yieldEvery: options.yieldEvery,
    })
    if (result.ok) {
      return {
        ran: true,
        state: result.state,
        gate,
        actionCount: result.actionCount,
        overlayVisible: shouldShowFinishingMatchOverlay(gate.inFlight),
      }
    }
    return {
      ran: true,
      state: startState,
      gate,
      failed: true,
      errorCode: result.errorCode,
      actionCount: result.actionCount,
      overlayVisible: shouldShowFinishingMatchOverlay(gate.inFlight),
    }
  } finally {
    gate.finish()
  }
}

/**
 * Mirrors `continueFromDungeonOutcome` then `maybeRunHeadlessMatchCompletion`.
 */
export async function runContinueFromDeferredThenHeadlessCompletion(options) {
  const continued = resolveStateAfterDungeonOutcomeContinue(
    options.displayedState,
    options.deferredPostDungeonState ?? null,
  )
  return runMaybeHeadlessMatchCompletionFromState(continued, {
    humanPlayerSeatId: options.humanPlayerSeatId,
    chooseAction: options.chooseAction,
    gate: options.gate,
    maxActions: options.maxActions,
    yieldEvery: options.yieldEvery,
    afterFlightStart: options.afterFlightStart,
  })
}

/**
 * @param {import('../engine/kernel.js').ReturnType<typeof import('../engine/kernel.js').createInitialMatchState>} state
 * @param {{
 *   chooseAction: (ctx: { state: typeof state, seatId: string }) => Promise<{ type: string } | null> | { type: string } | null
 *   humanPlayerSeatId: string
 *   maxActions?: number
 *   yieldEvery?: number
 * }} options
 */
export async function runHeadlessMatchCompletion(state, options) {
  const maxActions = options.maxActions ?? DEFAULT_MAX_HEADLESS_ACTIONS
  const chooseAction = options.chooseAction
  const humanPlayerSeatId = options.humanPlayerSeatId
  let currentState = state
  let actionCount = 0

  while (currentState.phase !== MATCH_PHASES.MATCH_OVER) {
    if (actionCount >= maxActions) {
      return {
        ok: false,
        state: currentState,
        actionCount,
        errorCode: HEADLESS_COMPLETION_ERROR_CODES.SAFETY_CAP,
      }
    }
    if (!ACTIONABLE_PHASES.has(currentState.phase)) {
      return {
        ok: false,
        state: currentState,
        actionCount,
        errorCode: HEADLESS_COMPLETION_ERROR_CODES.NOT_ACTIONABLE,
      }
    }
    const seatId = currentState.turn?.activeSeatId
    if (!seatId) {
      return {
        ok: false,
        state: currentState,
        actionCount,
        errorCode: HEADLESS_COMPLETION_ERROR_CODES.NO_ACTIVE_SEAT,
      }
    }
    if (seatId === humanPlayerSeatId) {
      return {
        ok: false,
        state: currentState,
        actionCount,
        errorCode: HEADLESS_COMPLETION_ERROR_CODES.HUMAN_TURN_UNEXPECTED,
      }
    }
    const action = await chooseAction({ state: currentState, seatId })
    if (!action) {
      return {
        ok: false,
        state: currentState,
        actionCount,
        errorCode: HEADLESS_COMPLETION_ERROR_CODES.NO_ACTION,
      }
    }
    const result = applyAction(currentState, action, { seatId })
    if (!result.ok) {
      return {
        ok: false,
        state: currentState,
        actionCount,
        errorCode: HEADLESS_COMPLETION_ERROR_CODES.APPLY_FAILED,
      }
    }
    currentState = result.state
    actionCount += 1
    if (options.yieldEvery && actionCount % options.yieldEvery === 0) {
      await Promise.resolve()
    }
  }

  return { ok: true, state: currentState, actionCount }
}
