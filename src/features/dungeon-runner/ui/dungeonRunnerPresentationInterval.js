import { isDungeonPresentationTraceEnabled } from './dungeonPresentationTrace.js'

export const DUNGEON_RUNNER_PRESENTATION_ADVANCE_MS = 50

let presentationTickCounter = 0

/**
 * @param {ReturnType<typeof import('./presentationOrchestrator.js').createPresentationOrchestrator>} orchestrator
 * @param {number} deltaMs
 * @param {{
 *   syncPresentationLabel: () => void
 *   scheduleAiTurnIfReady: () => void
 *   scheduleHumanAutoResolveIfReady: () => void
 * }} hooks
 */
export function runPresentationIntervalTick(orchestrator, deltaMs, hooks) {
  const snapBefore = isDungeonPresentationTraceEnabled() ? orchestrator.getQueueSnapshot() : []
  orchestrator.advance(deltaMs)
  const snapAfter = isDungeonPresentationTraceEnabled() ? orchestrator.getQueueSnapshot() : []
  if (isDungeonPresentationTraceEnabled()) {
    presentationTickCounter += 1
    const busy = snapAfter.length > 0
    if (busy && presentationTickCounter % 5 === 0) {
      const head = snapAfter[0]
      console.log('[DungeonPresentation][intervalTick]', {
        tick: presentationTickCounter,
        deltaMs,
        queueLen: snapAfter.length,
        headKind: head?.kind,
        headRemainingMs: head?.remainingMs,
        gameplayLocked: orchestrator.isGameplayInputLocked(),
      })
    }
    if (busy && snapBefore.length !== snapAfter.length) {
      console.log('[DungeonPresentation][intervalTick][queueLenChange]', {
        before: snapBefore.length,
        after: snapAfter.length,
      })
    }
  }
  hooks.syncPresentationLabel()
  hooks.scheduleAiTurnIfReady()
  hooks.scheduleHumanAutoResolveIfReady()
}
