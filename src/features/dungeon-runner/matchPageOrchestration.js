import { NeuralRecoveryTerminalError } from './nn/chooseWithRecovery.js'
import { runMatchNeuralLoadGate } from './nn/matchNeuralLoadGate.js'
import { CURRENT_MATCH_SCHEMA_VERSION, loadCurrentMatch } from './persistence/currentMatch.js'
import {
  attachNeuralRecoverySnapshotToMatch,
  shouldRunHeadlessMatchCompletion,
  surfacePersistedNeuralRecoveryTerminal,
} from './ui/headlessNeuralRecoveryPersistence.js'
import { materializeNewMatchState } from './setup/materializeNewMatchState.js'
import { resolveNeuralRecoveryTerminalUx } from './ui/neuralSeatRecoveryView.js'
import { runMaybeHeadlessMatchCompletionFromState } from './ui/headlessMatchCompletionRunner.js'

/** @typedef {import('./createMatchPageOrchestrationContext.js').MatchPageOrchestrationContext} MatchPageOrchestrationContext */

function resolvePresentationSpeedProfile(profile) {
  if (profile === 'brisk' || profile === 'cinematic') {
    return profile
  }
  return 'cinematic'
}

/**
 * @param {MatchPageOrchestrationContext} ctx
 * @returns {Promise<
 *   { kind: 'no-saved-match' }
 *   | { kind: 'setup-terminal' }
 *   | { kind: 'refresh-terminal', match: object, presentationSpeedProfile: string }
 *   | { kind: 'resume', match: object, presentationSpeedProfile: string }
 * >}
 */
export async function bootstrapCurrentMatchFromStorage(ctx) {
  const loaded = loadCurrentMatch(ctx.storage)
  if (!loaded.ok) {
    return { kind: 'no-saved-match' }
  }

  const setupSnapshot = ctx.cloneSetup(loaded.match.setup)
  const gateResult = await runMatchEntryNeuralLoadGateForPage(ctx, {
    setupSnapshot,
    releaseInFlightAfterGate: true,
  })
  if (gateResult.kind === 'setup-terminal') {
    return { kind: 'setup-terminal' }
  }

  const presentationSpeedProfile = resolvePresentationSpeedProfile(
    loaded.match.presentationSpeedProfile,
  )
  const match = { ...loaded.match, presentationSpeedProfile }

  const recoverySurface = surfacePersistedNeuralRecoveryTerminal({
    recovery: ctx.recovery,
    neuralRecoveryByModelId: loaded.match.neuralRecoveryByModelId,
    hasMatchSetup: Boolean(loaded.match.setup),
    applySetupTerminal: () => {
      ctx.resolveSetupTerminal(ctx.cloneSetup(loaded.match.setup))
    },
  })

  if (recoverySurface.surfaced && recoverySurface.action === 'setup-restore') {
    return { kind: 'setup-terminal' }
  }
  if (recoverySurface.surfaced && recoverySurface.action === 'refresh-dialog') {
    return { kind: 'refresh-terminal', match, presentationSpeedProfile }
  }

  return { kind: 'resume', match, presentationSpeedProfile }
}

/**
 * @param {MatchPageOrchestrationContext} ctx
 * @param {{
 *   setupSnapshot: object
 *   releaseInFlightAfterGate?: boolean
 * }} options
 * @returns {Promise<{ kind: 'success' } | { kind: 'setup-terminal' }>}
 */
export async function runMatchEntryNeuralLoadGateForPage(ctx, options) {
  const releaseInFlightAfterGate = options.releaseInFlightAfterGate ?? false
  ctx.setMatchNeuralLoadGateInFlight(true)
  try {
    const gate = await runMatchNeuralLoadGate(options.setupSnapshot, {
      loadModel: ctx.loadModel,
    })
    if (!gate.ok) {
      ctx.resolveSetupTerminal(options.setupSnapshot)
      if (releaseInFlightAfterGate) {
        ctx.setMatchNeuralLoadGateInFlight(false)
      }
      return { kind: 'setup-terminal' }
    }
    if (releaseInFlightAfterGate) {
      ctx.setMatchNeuralLoadGateInFlight(false)
    }
    return { kind: 'success' }
  } catch (error) {
    ctx.setMatchNeuralLoadGateInFlight(false)
    throw error
  }
}

/**
 * @param {{
 *   setupSnapshot: object
 *   seed: number
 *   id: string
 *   presentationSpeedProfile: string
 *   preservedBotLabels?: string[]
 * }} options
 */
export function buildNewMatchEnvelope(options) {
  const materializeOptions =
    options.preservedBotLabels?.length > 0
      ? { preservedBotLabels: options.preservedBotLabels }
      : {}
  return {
    schemaVersion: CURRENT_MATCH_SCHEMA_VERSION,
    id: options.id,
    setup: options.setupSnapshot,
    state: materializeNewMatchState(options.setupSnapshot, options.seed, materializeOptions),
    history: [],
    presentationSpeedProfile: options.presentationSpeedProfile,
  }
}

/**
 * @param {MatchPageOrchestrationContext} ctx
 * @param {{
 *   match: object | null | undefined
 *   humanPlayerSeatId: string | null | undefined
 *   chooseAction: (ctx: { state: object, seatId: string }) => Promise<object | null> | object | null
 *   gate: { inFlight: boolean, tryStart(): boolean, finish(): void }
 *   teardown?: () => void
 * }} options
 * @param {{ maxActions?: number, yieldEvery?: number }} [runOptions]
 */
export async function runHeadlessMatchCompletionForPage(ctx, options, runOptions = {}) {
  const match = options.match
  const humanPlayerSeatId = options.humanPlayerSeatId

  if (!match) {
    return { kind: 'skipped', reason: 'NO_MATCH' }
  }
  if (!humanPlayerSeatId) {
    return { kind: 'skipped', reason: 'NO_HUMAN' }
  }
  if (!shouldRunHeadlessMatchCompletion(match, humanPlayerSeatId)) {
    if (match.neuralRecoveryByModelId) {
      return { kind: 'skipped', reason: 'REFRESH_DEFERRED' }
    }
    return { kind: 'skipped', reason: 'NOT_NEEDED' }
  }

  try {
    const result = await runMaybeHeadlessMatchCompletionFromState(match.state, {
      humanPlayerSeatId,
      chooseAction: options.chooseAction,
      gate: options.gate,
      afterFlightStart: options.teardown,
      maxActions: runOptions.maxActions,
      yieldEvery: runOptions.yieldEvery,
    })

    if (!result.ran) {
      if (result.skippedReason === 'IN_FLIGHT') {
        return { kind: 'skipped', reason: 'IN_FLIGHT' }
      }
      return { kind: 'skipped', reason: 'NOT_NEEDED' }
    }

    if (result.failed) {
      return {
        kind: 'failed',
        errorCode: result.errorCode,
        actionCount: result.actionCount,
      }
    }

    let nextMatch = attachNeuralRecoverySnapshotToMatch(
      { ...match, state: result.state },
      ctx.recovery,
    )
    if ('neuralRecoveryByModelId' in nextMatch) {
      delete nextMatch.neuralRecoveryByModelId
    }
    ctx.persistCurrentMatch(ctx.storage, nextMatch)
    return { kind: 'completed', match: nextMatch }
  } catch (error) {
    if (!(error instanceof NeuralRecoveryTerminalError) || !match) {
      throw error
    }

    const ux = resolveNeuralRecoveryTerminalUx({
      terminal: error.terminal,
      hasMatchSetup: Boolean(match.setup),
    })

    if (ux.action === 'setup-restore') {
      ctx.applySetupTerminal(match.setup)
      return { kind: 'setup-terminal' }
    }

    if (ux.action === 'refresh-dialog') {
      const nextMatch = attachNeuralRecoverySnapshotToMatch(match, ctx.recovery)
      ctx.persistCurrentMatch(ctx.storage, nextMatch)
      return {
        kind: 'refresh-terminal',
        match: nextMatch,
        modelId: error.modelId,
        terminal: error.terminal,
        failureKind: error.failureKind,
      }
    }

    throw error
  }
}
