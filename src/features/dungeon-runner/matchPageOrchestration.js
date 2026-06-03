import { NeuralRecoveryTerminalError } from './nn/chooseWithRecovery.js'
import {
  resolveNeuralLoadGateSetupTerminal,
  runMatchNeuralLoadGate,
} from './nn/matchNeuralLoadGate.js'
import { CURRENT_MATCH_SCHEMA_VERSION, loadCurrentMatch } from './persistence/currentMatch.js'
import { surfacePersistedNeuralRecoveryTerminal } from './ui/headlessNeuralRecoveryPersistence.js'
import { materializeNewMatchState } from './setup/materializeNewMatchState.js'
import {
  attachNeuralRecoverySnapshotToMatch,
  shouldRunHeadlessMatchCompletion,
} from './ui/headlessNeuralRecoveryPersistence.js'
import { resolveNeuralRecoveryTerminalUx } from './ui/neuralSeatRecoveryView.js'
import { runMaybeHeadlessMatchCompletionFromState } from './ui/headlessMatchCompletionRunner.js'

/**
 * @param {{
 *   setupSnapshot: object
 *   loadModel: (modelId: string) => Promise<void>
 *   setMatchNeuralLoadGateInFlight: (inFlight: boolean) => void
 *   releaseInFlightAfterGate?: boolean
 *   storage: Storage
 *   clearCurrentMatch: (storage: Storage) => void
 *   applySetupSnapshot: (setupTarget: object, setupSnapshot: object) => void
 *   setupTarget: object
 * }} options
 * @returns {Promise<{ kind: 'success' } | { kind: 'setup-terminal' }>}
 */
function resolvePresentationSpeedProfile(profile) {
  if (profile === 'brisk' || profile === 'cinematic') {
    return profile
  }
  return 'cinematic'
}

/**
 * @param {{
 *   storage: Storage
 *   loadModel: (modelId: string) => Promise<void>
 *   setMatchNeuralLoadGateInFlight: (inFlight: boolean) => void
 *   clearCurrentMatch: (storage: Storage) => void
 *   applySetupSnapshot: (setupTarget: object, setupSnapshot: object) => void
 *   setupTarget: object
 *   cloneSetup: (setup: object) => object
 *   recovery: ReturnType<import('./nn/recovery.js').createNeuralRuntimeRecoveryCoordinator>
 * }} options
 * @returns {Promise<
 *   { kind: 'no-saved-match' }
 *   | { kind: 'setup-terminal' }
 *   | { kind: 'refresh-terminal', match: object, presentationSpeedProfile: string }
 *   | { kind: 'resume', match: object, presentationSpeedProfile: string }
 * >}
 */
export async function bootstrapCurrentMatchFromStorage(options) {
  const loaded = loadCurrentMatch(options.storage)
  if (!loaded.ok) {
    return { kind: 'no-saved-match' }
  }

  const setupSnapshot = options.cloneSetup(loaded.match.setup)
  const gateResult = await runMatchEntryNeuralLoadGateForPage({
    setupSnapshot,
    loadModel: options.loadModel,
    setMatchNeuralLoadGateInFlight: options.setMatchNeuralLoadGateInFlight,
    releaseInFlightAfterGate: true,
    storage: options.storage,
    clearCurrentMatch: options.clearCurrentMatch,
    applySetupSnapshot: options.applySetupSnapshot,
    setupTarget: options.setupTarget,
  })
  if (gateResult.kind === 'setup-terminal') {
    return { kind: 'setup-terminal' }
  }

  const presentationSpeedProfile = resolvePresentationSpeedProfile(
    loaded.match.presentationSpeedProfile,
  )
  const match = { ...loaded.match, presentationSpeedProfile }

  let surfacedAction = null
  const surfaced = surfacePersistedNeuralRecoveryTerminal({
    recovery: options.recovery,
    neuralRecoveryByModelId: loaded.match.neuralRecoveryByModelId,
    hasMatchSetup: Boolean(loaded.match.setup),
    applySetupTerminal: () => {
      surfacedAction = 'setup-restore'
      resolveNeuralLoadGateSetupTerminal({
        storage: options.storage,
        setupSnapshot: options.cloneSetup(loaded.match.setup),
        clearCurrentMatch: options.clearCurrentMatch,
        applySetupSnapshot: options.applySetupSnapshot,
        setupTarget: options.setupTarget,
      })
    },
    openRefreshTerminal: () => {
      surfacedAction = 'refresh-dialog'
    },
  })

  if (surfaced && surfacedAction === 'setup-restore') {
    return { kind: 'setup-terminal' }
  }
  if (surfaced && surfacedAction === 'refresh-dialog') {
    return { kind: 'refresh-terminal', match, presentationSpeedProfile }
  }

  return { kind: 'resume', match, presentationSpeedProfile }
}

/**
 * @param {{
 *   storage: Storage
 *   setupSnapshot: object
 *   clearCurrentMatch: (storage: Storage) => void
 *   applySetupSnapshot: (setupTarget: object, setupSnapshot: object) => void
 *   setupTarget: object
 * }} options
 */
export function applyNeuralLoadGateSetupTerminalForPage(options) {
  resolveNeuralLoadGateSetupTerminal(options)
}

export async function runMatchEntryNeuralLoadGateForPage(options) {
  const releaseInFlightAfterGate = options.releaseInFlightAfterGate ?? false
  options.setMatchNeuralLoadGateInFlight(true)
  try {
    const gate = await runMatchNeuralLoadGate(options.setupSnapshot, {
      loadModel: options.loadModel,
    })
    if (!gate.ok) {
      resolveNeuralLoadGateSetupTerminal({
        storage: options.storage,
        setupSnapshot: options.setupSnapshot,
        clearCurrentMatch: options.clearCurrentMatch,
        applySetupSnapshot: options.applySetupSnapshot,
        setupTarget: options.setupTarget,
      })
      if (releaseInFlightAfterGate) {
        options.setMatchNeuralLoadGateInFlight(false)
      }
      return { kind: 'setup-terminal' }
    }
    if (releaseInFlightAfterGate) {
      options.setMatchNeuralLoadGateInFlight(false)
    }
    return { kind: 'success' }
  } catch (error) {
    options.setMatchNeuralLoadGateInFlight(false)
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
 * @param {{
 *   match: object | null | undefined
 *   humanPlayerSeatId: string | null | undefined
 *   chooseAction: (ctx: { state: object, seatId: string }) => Promise<object | null> | object | null
 *   recovery: ReturnType<import('./nn/recovery.js').createNeuralRuntimeRecoveryCoordinator>
 *   gate: { inFlight: boolean, tryStart(): boolean, finish(): void }
 *   teardown?: () => void
 *   storage: Storage
 *   persistCurrentMatch: (storage: Storage, match: object) => void
 *   applySetupTerminal: (setupSnapshot: object) => void
 * }} options
 * @param {{ maxActions?: number, yieldEvery?: number }} [runOptions]
 */
export async function runHeadlessMatchCompletionForPage(options, runOptions = {}) {
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
      options.recovery,
    )
    if ('neuralRecoveryByModelId' in nextMatch) {
      delete nextMatch.neuralRecoveryByModelId
    }
    options.persistCurrentMatch(options.storage, nextMatch)
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
      options.applySetupTerminal(match.setup)
      return { kind: 'setup-terminal' }
    }

    if (ux.action === 'refresh-dialog') {
      const nextMatch = attachNeuralRecoverySnapshotToMatch(match, options.recovery)
      options.persistCurrentMatch(options.storage, nextMatch)
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
