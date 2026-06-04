import { MATCH_PHASES } from '../engine/kernel.js'

export const PLAY_SHELL = {
  PLAY_SETUP: 'play-setup',
  LIVE_MATCH: 'live-match',
  MATCH_OVER: 'match-over',
}

/**
 * @param {{
 *   match: { state?: { phase?: string } } | null
 *   neuralRefreshTerminalSurfaced: boolean
 *   matchNeuralLoadGateInFlight?: boolean
 * }} inputs
 * @returns {{
 *   hasCurrentMatch: boolean
 *   matchPhase: string | null
 *   neuralRefreshTerminalSurfaced: boolean
 *   matchNeuralLoadGateInFlight: boolean
 * }}
 */
export function buildPlayShellSnapshot({
  match,
  neuralRefreshTerminalSurfaced,
  matchNeuralLoadGateInFlight = false,
}) {
  return {
    hasCurrentMatch: Boolean(match),
    matchPhase: match?.state?.phase ?? null,
    neuralRefreshTerminalSurfaced,
    matchNeuralLoadGateInFlight,
  }
}

/**
 * @param {{
 *   hasCurrentMatch: boolean
 *   matchPhase: string | null
 *   neuralRefreshTerminalSurfaced: boolean
 *   matchNeuralLoadGateInFlight?: boolean
 * }} snapshot
 * @returns {typeof PLAY_SHELL[keyof typeof PLAY_SHELL]}
 */
export function resolveActivePlayShell(snapshot) {
  if (!snapshot.hasCurrentMatch) {
    return PLAY_SHELL.PLAY_SETUP
  }
  if (snapshot.neuralRefreshTerminalSurfaced) {
    return PLAY_SHELL.LIVE_MATCH
  }
  if (snapshot.matchNeuralLoadGateInFlight) {
    if (snapshot.matchPhase === MATCH_PHASES.MATCH_OVER) {
      return PLAY_SHELL.MATCH_OVER
    }
    return PLAY_SHELL.LIVE_MATCH
  }
  if (snapshot.matchPhase === MATCH_PHASES.MATCH_OVER) {
    return PLAY_SHELL.MATCH_OVER
  }
  return PLAY_SHELL.LIVE_MATCH
}
