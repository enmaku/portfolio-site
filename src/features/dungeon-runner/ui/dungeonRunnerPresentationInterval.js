export const DUNGEON_RUNNER_PRESENTATION_ADVANCE_MS = 50

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
  orchestrator.advance(deltaMs)
  hooks.syncPresentationLabel()
  hooks.scheduleAiTurnIfReady()
  hooks.scheduleHumanAutoResolveIfReady()
}
