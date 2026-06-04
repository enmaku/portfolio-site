import {
  DUNGEON_RUNNER_PRESENTATION_ADVANCE_MS,
  runPresentationIntervalTick,
} from '../dungeonRunnerPresentationInterval.js'

/**
 * @param {{
 *   recovery: { subscribe: (listener: () => void) => () => void }
 *   onRecoveryChanged: () => void
 *   presentationOrchestrator: Parameters<typeof runPresentationIntervalTick>[0]
 *   tickCallbacks: Parameters<typeof runPresentationIntervalTick>[2]
 *   setInterval?: typeof globalThis.setInterval
 *   clearInterval?: typeof globalThis.clearInterval
 * }} deps
 * @returns {{ unsubscribe: () => void, presentationTimerId: ReturnType<typeof setInterval> }}
 */
export function activateLiveMatchShellLifecycle({
  recovery,
  onRecoveryChanged,
  presentationOrchestrator,
  tickCallbacks,
  setInterval = globalThis.setInterval,
  clearInterval = globalThis.clearInterval,
}) {
  const unsubscribe = recovery.subscribe(onRecoveryChanged)
  const presentationTimerId = setInterval(() => {
    runPresentationIntervalTick(
      presentationOrchestrator,
      DUNGEON_RUNNER_PRESENTATION_ADVANCE_MS,
      tickCallbacks,
    )
  }, DUNGEON_RUNNER_PRESENTATION_ADVANCE_MS)
  return { unsubscribe, presentationTimerId, clearInterval }
}

/**
 * @param {{
 *   unsubscribe?: (() => void) | null
 *   presentationTimerId?: ReturnType<typeof setInterval> | null
 *   aiTurnTimerId?: ReturnType<typeof setTimeout> | null
 *   autoResolveTimerId?: ReturnType<typeof setTimeout> | null
 *   confirmationDialogResolve?: ((value: boolean) => void) | null
 *   clearInterval?: typeof globalThis.clearInterval
 *   clearTimeout?: typeof globalThis.clearTimeout
 * }} state
 */
export function deactivateLiveMatchShellLifecycle({
  unsubscribe = null,
  presentationTimerId = null,
  aiTurnTimerId = null,
  autoResolveTimerId = null,
  confirmationDialogResolve = null,
  clearInterval = globalThis.clearInterval,
  clearTimeout = globalThis.clearTimeout,
}) {
  unsubscribe?.()
  if (presentationTimerId != null) clearInterval(presentationTimerId)
  if (aiTurnTimerId != null) clearTimeout(aiTurnTimerId)
  if (autoResolveTimerId != null) clearTimeout(autoResolveTimerId)
  if (typeof confirmationDialogResolve === 'function') {
    confirmationDialogResolve(false)
  }
}
