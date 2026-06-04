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
 * @returns {typeof PLAY_SHELL[keyof typeof PLAY_SHELL]}
 */
export function resolveActivePlayShell({
  match,
  neuralRefreshTerminalSurfaced,
  matchNeuralLoadGateInFlight = false,
}) {
  if (!match) {
    return PLAY_SHELL.PLAY_SETUP
  }
  if (neuralRefreshTerminalSurfaced) {
    return PLAY_SHELL.LIVE_MATCH
  }
  const matchPhase = match.state?.phase ?? null
  if (matchNeuralLoadGateInFlight) {
    if (matchPhase === MATCH_PHASES.MATCH_OVER) {
      return PLAY_SHELL.MATCH_OVER
    }
    return PLAY_SHELL.LIVE_MATCH
  }
  if (matchPhase === MATCH_PHASES.MATCH_OVER) {
    return PLAY_SHELL.MATCH_OVER
  }
  return PLAY_SHELL.LIVE_MATCH
}
