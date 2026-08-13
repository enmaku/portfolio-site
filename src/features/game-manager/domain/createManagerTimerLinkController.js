/**
 * Injectable manager ↔ timer link orchestration (testable without Vue).
 */

import {
  buildGameTimerLinkedRoute,
  resolveLinkEntryKind,
  shouldApplyLaunchSeats,
  shouldAutoHost,
  shouldEndRoomOnTakeover,
} from './timerLinkOrchestration.js'

/**
 * @param {{
 *   getLinkState: () => { active: boolean, playSessionId: string | null, launchConfig: object | null, lastSyncPosture: 'local' | 'host' },
 *   beginLink: (input: { playSessionId: string, launchConfig: object }) => void,
 *   clearLink: () => void,
 *   setLastSyncPosture: (posture: 'local' | 'host') => void,
 *   applyLaunchConfig: (launchConfig: object) => void,
 *   isHosting: () => boolean,
 *   leaveSession: () => void,
 *   startAsHost: () => Promise<unknown>,
 *   navigate: (route: { path: string, query: Record<string, string> }) => void,
 * }} deps
 */
export function createManagerTimerLinkController(deps) {
  /**
   * @param {{ playSessionId: string, launchConfig: { seats: unknown[] }, forceApplySeats?: boolean }} input
   */
  async function enterLinkedTimer({ playSessionId, launchConfig, forceApplySeats = false }) {
    const existing = deps.getLinkState()
    const kind = resolveLinkEntryKind(existing, playSessionId)

    if (kind === 'takeover' && shouldEndRoomOnTakeover({ isHosting: deps.isHosting() })) {
      deps.leaveSession()
    }

    if (forceApplySeats || shouldApplyLaunchSeats(kind)) {
      deps.beginLink({ playSessionId, launchConfig })
      deps.applyLaunchConfig(launchConfig)
    }

    const posture = deps.getLinkState().lastSyncPosture
    if (shouldAutoHost(posture)) {
      await deps.startAsHost()
    }

    deps.navigate(buildGameTimerLinkedRoute({ playSessionId }))
    return { kind }
  }

  function clearAfterSuccessfulGameEnd() {
    deps.clearLink()
  }

  /**
   * @param {{ isHosting: boolean }} input
   */
  function recordPostureFromSession({ isHosting }) {
    deps.setLastSyncPosture(isHosting ? 'host' : 'local')
  }

  return {
    enterLinkedTimer,
    clearAfterSuccessfulGameEnd,
    recordPostureFromSession,
  }
}
