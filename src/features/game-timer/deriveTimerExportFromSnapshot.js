/**
 * @import './types.js'
 * Compact Game Manager timer export derived from a live Timer snapshot.
 */

import { displayedMsForPlayer, totalGameElapsedMs } from './core.js'

/**
 * @typedef {object} TimerExportSeat
 * @property {string} [recordedPlayerId]
 * @property {string} name
 * @property {string} color
 * @property {number} bankedMs
 */

/**
 * @typedef {object} TimerExport
 * @property {number} durationMs Sitting wall-clock total game elapsed.
 * @property {TimerExportSeat[]} seats
 */

/**
 * Build a compact **timer export** from the authoritative timer snapshot at `nowMs`.
 * Per-seat `bankedMs` includes any open turn segment (as displayed).
 *
 * @param {{
 *   totalGameStartedAt?: number | null,
 *   players: Array<GameTimerPlayer & { recordedPlayerId?: string }>,
 *   activePlayerId: string | null,
 *   turnStartedAt: number | null,
 * }} snapshot
 * @param {number} nowMs
 * @returns {TimerExport}
 */
export function deriveTimerExportFromSnapshot(snapshot, nowMs) {
  const session = {
    activePlayerId: snapshot.activePlayerId ?? null,
    turnStartedAt: snapshot.turnStartedAt ?? null,
  }
  const seats = (snapshot.players || []).map((p) => {
    /** @type {TimerExportSeat} */
    const seat = {
      name: typeof p.name === 'string' ? p.name : '',
      color: typeof p.color === 'string' ? p.color : '',
      bankedMs: displayedMsForPlayer(p, session, nowMs),
    }
    if (typeof p.recordedPlayerId === 'string' && p.recordedPlayerId) {
      seat.recordedPlayerId = p.recordedPlayerId
    }
    return seat
  })
  return {
    durationMs: totalGameElapsedMs(snapshot, nowMs),
    seats,
  }
}
