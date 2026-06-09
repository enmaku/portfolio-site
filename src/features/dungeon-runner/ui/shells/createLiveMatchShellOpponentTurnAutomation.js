import { ref, watch } from 'vue'
import { MATCH_PHASES, applyAction, getPlayerView } from '../../engine/kernel.js'
import { persistCurrentMatch } from '../../persistence/currentMatch.js'
import { abandonScheduledInferenceQueue } from '../../nn/runtime.js'
import { runHeadlessMatchCompletionForPage } from '../../matchPageOrchestration.js'
import { isNnAdventurerPickEnabled } from '../../setup/nnAdventurerPick.js'
import { createChooseNnActionWithRecovery } from '../../nn/chooseWithRecovery.js'
import { buildAiTurnRunToken } from '../dungeonRunnerAiTurnToken.js'
import {
  cancelAiTurnPrefetch,
  consumeAiTurnPrefetch,
  resetAiTurnPrefetch,
  startAiTurnPrefetch,
} from '../dungeonRunnerAiTurnPrefetch.js'
import { createPipelineStepLogger } from '../../nn/nnPipelineTrace.js'
import { createLivePlayActionChooser } from '../livePlayActionChooser.js'
import { evaluateLiveAiTurnPipelineGateForContext } from '../liveAiTurnPipelineGateContext.js'
import {
  buildAiTurnPrefetchSkipTrace,
  buildAiTurnRunSkipTrace,
  buildAiTurnScheduleSkipTrace,
} from '../liveAiTurnPipelineGateTrace.js'
import { buildSeatRecoveryIndicators, isActiveNnSeatRecovering } from '../neuralSeatRecoveryView.js'
import { shouldDeferDungeonExitUntilOutcomeAck } from '../headlessMatchCompletionRunner.js'

const AI_TURN_SCHEDULE_DELAY_MS = 300

const SCHEDULE_SKIP_THROTTLE_REASONS = new Set([
  'gameplay-locked',
  'timer-pending',
  'in-flight',
  'already-applied-token',
  'deferred-post-dungeon',
  'headless-completion',
])

/**
 * Opponent turn automation for live match shell: AI schedule/prefetch/run,
 * neural recovery subscribe reactions, and seat recovery indicators.
 *
 * @param {{
 *   match: import('vue').Ref<object | null>
 *   debugMode: import('vue').Ref<boolean>
 *   nnRecovery: ReturnType<import('../../nn/recovery.js').createNeuralRuntimeRecoveryCoordinator>
 *   deferredPostDungeonState: import('vue').Ref<object | null>
 *   matchNeuralLoadGateInFlight: import('vue').Ref<boolean>
 *   human: {
 *     getHumanSeatId: () => string | null
 *     getIsHumanTurn: () => boolean
 *     onClearAutoResolveTimer: () => void
 *   }
 *   presentation: {
 *     gameplayInputLocked: import('vue').Ref<boolean>
 *     previousVisibleState: import('vue').Ref<object | null>
 *     presentationOrchestrator: {
 *       getQueueSnapshot: () => Array<{ remainingMs: number }>
 *     }
 *     activePresentation: import('vue').Ref<object | null>
 *     enqueuePresentationTransition: (
 *       prevState: object,
 *       nextState: object,
 *       action: object,
 *       seatId: string,
 *       roleType: string,
 *     ) => void
 *     syncPresentationLabel: () => void
 *     clearPresentationOrchestrator: () => void
 *   }
 *   dialog: {
 *     getNeuralRefreshTerminalOpen: () => boolean
 *     getHeadlessCompletionInFlight: () => boolean
 *     createHeadlessCompletionFlightGate: () => {
 *       inFlight: boolean
 *       tryStart(): boolean
 *       finish(): void
 *     }
 *     ackDungeonRunForTeardown: (run: object | null | undefined) => void
 *   }
 *   lifecycle: {
 *     isLifecycleActive: () => boolean
 *     getMatchPageOrchestrationCtx: () => object
 *     handleNeuralRecoveryTerminalError: (error: unknown) => boolean
 *   }
 *   recovery: {
 *     ensureNnModelsReady: () => Promise<void>
 *     nnRuntimeOptions: (modelId: string | null) => object
 *   }
 *   seatRecoveryIndicators?: import('vue').Ref<Array<object>>
 *   storage?: Storage
 *   persistCurrentMatch?: typeof persistCurrentMatch
 *   buildAiTurnRunToken?: typeof buildAiTurnRunToken
 *   createLivePlayActionChooser?: typeof createLivePlayActionChooser
 *   runHeadlessMatchCompletionForPage?: typeof runHeadlessMatchCompletionForPage
 *   startAiTurnPrefetch?: typeof startAiTurnPrefetch
 *   abandonScheduledInferenceQueue?: typeof abandonScheduledInferenceQueue
 *   setTimeout?: typeof globalThis.setTimeout
 *   clearTimeout?: typeof globalThis.clearTimeout
 * }} deps
 */
export function createLiveMatchShellOpponentTurnAutomation(deps) {
  const match = deps.match
  const debugMode = deps.debugMode
  const nnRecovery = deps.nnRecovery
  const getHumanSeatId = deps.human.getHumanSeatId
  const getIsHumanTurn = deps.human.getIsHumanTurn
  const deferredPostDungeonState = deps.deferredPostDungeonState
  const matchNeuralLoadGateInFlight = deps.matchNeuralLoadGateInFlight
  const gameplayInputLocked = deps.presentation.gameplayInputLocked
  const previousVisibleState = deps.presentation.previousVisibleState
  const presentationOrchestrator = deps.presentation.presentationOrchestrator
  const activePresentation = deps.presentation.activePresentation
  const enqueuePresentationTransition = deps.presentation.enqueuePresentationTransition
  const getNeuralRefreshTerminalOpen = deps.dialog.getNeuralRefreshTerminalOpen
  const getHeadlessCompletionInFlight = deps.dialog.getHeadlessCompletionInFlight
  const ensureNnModelsReady = deps.recovery.ensureNnModelsReady
  const nnRuntimeOptions = deps.recovery.nnRuntimeOptions
  const handleNeuralRecoveryTerminalError = deps.lifecycle.handleNeuralRecoveryTerminalError
  const isLifecycleActive = deps.lifecycle.isLifecycleActive
  const getMatchPageOrchestrationCtx = deps.lifecycle.getMatchPageOrchestrationCtx
  const createHeadlessCompletionFlightGate = deps.dialog.createHeadlessCompletionFlightGate
  const syncPresentationLabel = deps.presentation.syncPresentationLabel
  const clearPresentationOrchestrator = deps.presentation.clearPresentationOrchestrator
  const ackDungeonRunForTeardown = deps.dialog.ackDungeonRunForTeardown
  const onClearAutoResolveTimer = deps.human.onClearAutoResolveTimer
  const storage = deps.storage ?? window.localStorage
  const persistMatch = deps.persistCurrentMatch ?? persistCurrentMatch
  const buildRunToken = deps.buildAiTurnRunToken ?? buildAiTurnRunToken
  const createActionChooser = deps.createLivePlayActionChooser ?? createLivePlayActionChooser
  const runHeadlessCompletionForPage =
    deps.runHeadlessMatchCompletionForPage ?? runHeadlessMatchCompletionForPage
  const abandonInferenceQueue = deps.abandonScheduledInferenceQueue ?? abandonScheduledInferenceQueue
  const startPrefetch = deps.startAiTurnPrefetch ?? startAiTurnPrefetch
  const setTimeoutFn = deps.setTimeout ?? globalThis.setTimeout.bind(globalThis)
  const clearTimeoutFn = deps.clearTimeout ?? globalThis.clearTimeout.bind(globalThis)

  const seatRecoveryIndicators = deps.seatRecoveryIndicators ?? ref([])
  let activeSeatRecoveryBlocking = false
  /** @type {ReturnType<typeof setTimeout> | null} */
  let aiTurnTimerId = null
  let aiTurnInFlight = false
  let lastAppliedAiTurnToken = null
  let lastScheduleSkipKey = ''
  let lastPrimeSkipTraceKey = ''

  function aiTurnTrace(baseContext = {}) {
    return createPipelineStepLogger('AITurn', debugMode.value, {
      matchId: match.value?.id ?? null,
      ...baseContext,
    })
  }

  function logNnRecoveryTrace(modelId, step, detail = {}) {
    if (!debugMode.value) return
    aiTurnTrace({ modelId })(`recovery.${step}`, {
      loadAttempts: nnRecovery.getLoadAttempts(modelId),
      inferAttempts: nnRecovery.getInferAttempts(modelId),
      loadBackend: nnRecovery.getBackendPreference(modelId, 'load'),
      inferBackend: nnRecovery.getBackendPreference(modelId, 'infer'),
      ...detail,
    })
  }

  const chooseNnActionWithRecovery = createChooseNnActionWithRecovery({
    recovery: nnRecovery,
    onRecoveryBegin: (modelId) => logNnRecoveryTrace(modelId, 'begin'),
    onRecoveryAttempt: (detail) => logNnRecoveryTrace(detail.modelId, 'attempt', detail),
    onRecoverySettled: (modelId) => logNnRecoveryTrace(modelId, 'settled'),
  })

  function syncSeatRecoveryIndicators() {
    const seats = match.value?.state?.seats ?? []
    seatRecoveryIndicators.value = buildSeatRecoveryIndicators({ seats, recovery: nnRecovery })
  }

  function resolveActiveSeatRecoveryBlocking() {
    return match.value?.state
      ? isActiveNnSeatRecovering({ state: match.value.state, recovery: nnRecovery })
      : false
  }

  function applySeatRecoveryBlockingTransition(blocking) {
    if (!activeSeatRecoveryBlocking && blocking) {
      cancelAiTurnPrefetch()
    }
    activeSeatRecoveryBlocking = blocking
  }

  function syncMatchStateRecovery() {
    syncSeatRecoveryIndicators()
    applySeatRecoveryBlockingTransition(resolveActiveSeatRecoveryBlocking())
  }

  function evaluatePageAiTurnPipelineGate({ runToken = '', timerPending = false } = {}) {
    return evaluateLiveAiTurnPipelineGateForContext({
      matchState: match.value?.state ?? null,
      humanSeatId: getHumanSeatId(),
      isHumanTurn: getIsHumanTurn(),
      hasMatch: !!match.value,
      neuralRefreshTerminalOpen: getNeuralRefreshTerminalOpen(),
      matchNeuralLoadGateInFlight: matchNeuralLoadGateInFlight.value,
      aiTurnInFlight,
      headlessCompletionInFlight: getHeadlessCompletionInFlight(),
      deferredPostDungeonState: deferredPostDungeonState.value,
      gameplayInputLocked: gameplayInputLocked.value,
      recovery: nnRecovery,
      runToken,
      lastAppliedAiTurnToken,
      timerPending,
      pickAdventurerNnEnabled: isNnAdventurerPickEnabled(),
    })
  }

  function logAiTurnScheduleSkip(reason, detail = {}) {
    if (!debugMode.value) return
    const key = `${reason}:${detail.runToken ?? detail.activeKind ?? ''}`
    if (SCHEDULE_SKIP_THROTTLE_REASONS.has(reason) && key === lastScheduleSkipKey) return
    lastScheduleSkipKey = key
    console.warn('[DungeonRunner][AITurn][Schedule] skip', reason, detail)
  }

  function logAiTurnPrimeSkip(reason, detail = {}) {
    if (!debugMode.value) return
    const key = `${reason}:${detail.runToken ?? detail.phase ?? detail.seatId ?? detail.roleType ?? ''}`
    if (key === lastPrimeSkipTraceKey) return
    lastPrimeSkipTraceKey = key
    aiTurnTrace()('prefetch.prime.skip', { reason, ...detail })
  }

  function buildLivePlayChooserDeps(extra = {}) {
    return {
      nnRecovery,
      ensureNnModelsReady,
      nnRuntimeOptions,
      chooseNnActionWithRecovery,
      ...extra,
    }
  }

  async function runAiTurn() {
    const trace = aiTurnTrace()
    const seatId = match.value?.state?.turn?.activeSeatId ?? null
    const runToken = match.value ? buildRunToken({ matchId: match.value.id, state: match.value.state }) : ''
    const gate = evaluatePageAiTurnPipelineGate({ runToken })
    if (!gate.mayRunTurn) {
      const presentationQueueSnapshot = presentationOrchestrator.getQueueSnapshot()
      const skipTrace = buildAiTurnRunSkipTrace(gate, {
        runToken,
        seatId,
        humanSeatId: getHumanSeatId(),
        phase: match.value?.state?.phase ?? null,
        activePresentationKind: activePresentation.value?.kind ?? null,
        queueMs: presentationQueueSnapshot.reduce((sum, item) => sum + item.remainingMs, 0),
        lastAppliedAiTurnToken,
      })
      if (skipTrace) {
        trace(skipTrace.step, skipTrace.detail)
      }
      return
    }
    aiTurnInFlight = true
    try {
      trace('run.begin', {
        runToken,
        phase: match.value.state.phase,
        seatId,
        turnNumber: match.value.state.turn.turnNumber,
        biddingSubphase: match.value.state.bidding?.subphase ?? null,
        revealedMonsterCard: match.value.state.bidding?.revealedMonsterCard ?? null,
        dungeonSubphase: match.value.state.dungeon?.subphase ?? null,
      })
      const seat = match.value.state.seats.find((candidate) => candidate.id === seatId)
      const roleType = seat?.role?.type
      const chooseAction = createActionChooser(
        buildLivePlayChooserDeps({
          tryConsumePrefetch: async ({ runToken: consumeRunToken }) => {
            const prefetchGate = evaluatePageAiTurnPipelineGate({
              runToken: consumeRunToken ?? runToken,
            })
            return consumeAiTurnPrefetch({
              runToken: consumeRunToken ?? runToken,
              mayPrefetch: prefetchGate.mayPrefetch,
              prefetchSkipReason: prefetchGate.prefetchSkipReason,
              trace: (step, detail) => trace(step, detail),
            })
          },
        }),
      )
      let action
      try {
        action = await chooseAction({ state: match.value.state, seatId, runToken })
      } catch (error) {
        if (handleNeuralRecoveryTerminalError(error)) {
          trace('run.abort', {
            reason: 'nn-recovery-terminal',
            terminal: error.terminal,
            modelId: error.modelId,
          })
          return
        }
        throw error
      }
      if (!action) {
        trace('run.abort', { reason: 'no-action' })
        return
      }
      if (!match.value) {
        trace('run.abort', { reason: 'match-cleared' })
        return
      }
      const currentToken = buildRunToken({
        matchId: match.value.id,
        state: match.value.state,
      })
      if (runToken !== currentToken) {
        trace('run.abort', { reason: 'stale-token', runToken, currentToken })
        return
      }
      const prevState = match.value.state
      if (getHumanSeatId()) {
        previousVisibleState.value = getPlayerView(prevState, { seatId: getHumanSeatId() })
      }
      const result = applyAction(prevState, action, { seatId })
      if (!result.ok) {
        trace('run.abort', { reason: 'apply-failed', actionType: action.type })
        return
      }
      lastAppliedAiTurnToken = runToken
      const deferExit = shouldDeferDungeonExitUntilOutcomeAck(prevState, result.state)
      if (deferExit) {
        deferredPostDungeonState.value = result.state
        match.value = { ...match.value, state: { ...result.state, phase: MATCH_PHASES.DUNGEON } }
      } else {
        deferredPostDungeonState.value = null
        match.value = { ...match.value, state: result.state }
      }
      persistMatch(storage, match.value)
      trace('run.applied', {
        actionType: action.type,
        nextRunToken: buildRunToken({ matchId: match.value.id, state: match.value.state }),
        phaseAfter: match.value.state.phase,
        turnAfterSeatId: match.value.state.turn.activeSeatId,
        deferExit,
      })
      enqueuePresentationTransition(
        prevState,
        result.state,
        action,
        seatId,
        roleType ?? 'randombot',
      )
      if (debugMode.value) {
        const snap = presentationOrchestrator.getQueueSnapshot()
        trace('presentation.enqueued', {
          queue: snap.map((item) => item.kind),
          queueMs: snap.reduce((sum, item) => sum + item.remainingMs, 0),
        })
      }
      primeAiTurnPrefetch()
    } finally {
      aiTurnInFlight = false
      trace('run.finally', { inFlight: false })
    }
  }

  function primeAiTurnPrefetch(precomputedGate = null) {
    const trace = aiTurnTrace()
    const state = match.value?.state
    const seatId = state?.turn?.activeSeatId ?? null
    const seat = state?.seats?.find((candidate) => candidate.id === seatId)
    const runToken = match.value ? buildRunToken({ matchId: match.value.id, state }) : ''
    const modelId = seat?.role?.type === 'nn' ? (seat.role.modelId ?? 'latest') : null
    const gate = precomputedGate ?? evaluatePageAiTurnPipelineGate({ runToken })
    if (!gate.mayPrefetch) {
      const skipTrace = buildAiTurnPrefetchSkipTrace(gate, {
        seatId,
        phase: state?.phase ?? null,
        runToken,
        modelId,
        roleType: seat?.role?.type ?? null,
      })
      if (skipTrace) {
        logAiTurnPrimeSkip(skipTrace.reason, skipTrace.detail)
      }
      return
    }
    lastPrimeSkipTraceKey = ''
    startPrefetch({
      runToken,
      mayPrefetch: true,
      prefetchSkipReason: null,
      trace: (step, detail) => trace(step, detail),
      compute: async () => {
        await ensureNnModelsReady()
        return chooseNnActionWithRecovery(state, { seatId }, nnRuntimeOptions(modelId))
      },
    })
  }

  function scheduleAiTurnIfReady() {
    if (!isLifecycleActive()) return
    if (!match.value || getIsHumanTurn()) {
      return
    }
    const runToken = buildRunToken({ matchId: match.value.id, state: match.value.state })
    const gate = evaluatePageAiTurnPipelineGate({ runToken, timerPending: !!aiTurnTimerId })
    if (!gate.maySchedule) {
      const skipTrace = buildAiTurnScheduleSkipTrace(gate, {
        runToken,
        phase: match.value?.state?.phase ?? null,
        activeSeatId: match.value?.state?.turn?.activeSeatId ?? null,
        presentationQueueSnapshot: presentationOrchestrator.getQueueSnapshot(),
      })
      if (skipTrace) {
        logAiTurnScheduleSkip(skipTrace.reason, skipTrace.detail)
      }
      if (gate.mayPrefetch) {
        primeAiTurnPrefetch(gate)
      }
      if (
        gate.scheduleSkipReason === 'model-recovering' ||
        gate.scheduleSkipReason === 'gameplay-locked'
      ) {
        if (aiTurnTimerId) {
          clearTimeoutFn(aiTurnTimerId)
          aiTurnTimerId = null
        }
      }
      return
    }
    primeAiTurnPrefetch(gate)
    if (debugMode.value) {
      aiTurnTrace()('schedule.timer-armed', { runToken, delayMs: AI_TURN_SCHEDULE_DELAY_MS })
    }
    aiTurnTimerId = setTimeoutFn(() => {
      aiTurnTimerId = null
      if (debugMode.value) aiTurnTrace()('schedule.timer-fired', { runToken })
      void runAiTurn()
    }, AI_TURN_SCHEDULE_DELAY_MS)
  }

  function scheduleAiTurnOnPresentationTick() {
    if (!isLifecycleActive()) return
    if (
      !match.value ||
      getIsHumanTurn() ||
      deferredPostDungeonState.value ||
      getHeadlessCompletionInFlight()
    ) {
      return
    }
    scheduleAiTurnIfReady()
  }

  function onNnRecoveryChanged() {
    syncMatchStateRecovery()
    if (!isLifecycleActive()) return
    scheduleAiTurnIfReady()
  }

  function clearAiTurnTimer() {
    if (aiTurnTimerId) {
      clearTimeoutFn(aiTurnTimerId)
      aiTurnTimerId = null
    }
  }

  function resetScheduleSkipTraceKeys() {
    lastScheduleSkipKey = ''
    lastPrimeSkipTraceKey = ''
  }

  function resetLastAppliedAiTurnToken() {
    lastAppliedAiTurnToken = null
  }

  function teardownOpponentTurnAutomation() {
    clearAiTurnTimer()
    resetAiTurnPrefetch()
    resetLastAppliedAiTurnToken()
  }

  function bootstrapRecoveryState() {
    syncSeatRecoveryIndicators()
    activeSeatRecoveryBlocking = resolveActiveSeatRecoveryBlocking()
  }

  function teardownForHeadlessMatchCompletion() {
    teardownOpponentTurnAutomation()
    onClearAutoResolveTimer()
    abandonInferenceQueue()
    clearPresentationOrchestrator()
    deferredPostDungeonState.value = null
    ackDungeonRunForTeardown(match.value?.state?.lastDungeonRun)
  }

  async function maybeRunHeadlessMatchCompletion() {
    try {
      return await runHeadlessCompletionForPage(getMatchPageOrchestrationCtx(), {
        match: match.value,
        humanPlayerSeatId: getHumanSeatId(),
        chooseAction: createActionChooser(buildLivePlayChooserDeps()),
        gate: createHeadlessCompletionFlightGate(),
        teardown: teardownForHeadlessMatchCompletion,
      })
    } finally {
      syncPresentationLabel()
    }
  }

  /**
   * @param {{
   *   persistMatch: (envelope: object) => void
   *   isLifecycleActive: () => boolean
   *   scheduleHumanAutoResolveIfReady: () => void
   * }} callbacks
   */
  function activateMatchStateSubscription(callbacks) {
    return watch(
      () => match.value?.state,
      (state) => {
        if (!match.value || !state) return
        syncMatchStateRecovery()
        callbacks.persistMatch(match.value)
        if (!callbacks.isLifecycleActive()) return
        scheduleAiTurnIfReady()
        callbacks.scheduleHumanAutoResolveIfReady()
      },
      { deep: true },
    )
  }

  function deactivateMatchStateSubscription(stopHandle) {
    if (typeof stopHandle === 'function') {
      stopHandle()
    }
  }

  /**
   * @param {{
   *   isLifecycleActive: () => boolean
   *   scheduleHumanAutoResolveIfReady: () => void
   * }} callbacks
   */
  function onPresentationGameplayUnlocked(callbacks) {
    resetScheduleSkipTraceKeys()
    if (callbacks.isLifecycleActive()) {
      scheduleAiTurnIfReady()
      callbacks.scheduleHumanAutoResolveIfReady()
    }
  }

  return {
    seatRecoveryIndicators,
    chooseNnActionWithRecovery,
    buildLivePlayChooserDeps,
    logNnRecoveryTrace,
    aiTurnTrace,
    evaluatePageAiTurnPipelineGate,
    syncSeatRecoveryIndicators,
    syncMatchStateRecovery,
    bootstrapRecoveryState,
    onNnRecoveryChanged,
    scheduleAiTurnIfReady,
    scheduleAiTurnOnPresentationTick,
    runAiTurn,
    primeAiTurnPrefetch,
    resetAiTurnPrefetch,
    cancelAiTurnPrefetch,
    clearAiTurnTimer,
    getAiTurnTimerId: () => aiTurnTimerId,
    resetScheduleSkipTraceKeys,
    resetLastAppliedAiTurnToken,
    teardownOpponentTurnAutomation,
    maybeRunHeadlessMatchCompletion,
    activateMatchStateSubscription,
    deactivateMatchStateSubscription,
    onPresentationGameplayUnlocked,
  }
}
