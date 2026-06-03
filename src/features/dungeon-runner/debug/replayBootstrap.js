import { materializeNewMatchState } from '../setup/materializeNewMatchState.js'

/**
 * Web-authoritative pre-history state for completed-match replays.
 */
export function bootstrapMatchStateForReplay(setup, seed) {
  return materializeNewMatchState(setup, seed)
}
