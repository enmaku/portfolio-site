import { buildMatchOutcomeRecord } from '../analytics/buildMatchOutcomeRecord.js'
import { MATCH_PHASES } from '../engine/kernel.js'
import {
  createFirestoreDoc,
  dungeonRunnerMatchOutcomeRef,
  isDungeonRunnerFirebaseConfigured,
} from './firestore.js'

/**
 * @param {Array<{ id?: string, role?: { type?: string } }> | undefined} seats
 * @returns {string}
 */
export function resolveHumanPlayerSeatId(seats) {
  return seats?.find((seat) => seat.role?.type === 'human')?.id ?? ''
}

/**
 * @typedef {object} CompletedMatchOutcomeUploadDeps
 * @property {() => boolean} [isConfigured]
 * @property {typeof buildMatchOutcomeRecord} [buildRecord]
 * @property {(matchId: string, record: unknown) => Promise<void>} [createOutcome]
 */

/**
 * @param {string} matchId
 * @param {unknown} record
 */
async function defaultCreateOutcome(matchId, record) {
  const docRef = dungeonRunnerMatchOutcomeRef(matchId)
  if (!docRef) return
  await createFirestoreDoc(docRef, record)
}

/**
 * Builds and persists a v1 **completed match outcome** at **match over**.
 * Caller supplies `createdAt` (live: same instant as paired replay envelope).
 * @param {import('../engine/kernel.js').Match | { id?: string, setup?: unknown, state?: { phase?: string, seats?: unknown[], history?: unknown[], scoreboard?: unknown, matchWinnerSeatId?: string }, presentationSpeedProfile?: string } | null | undefined} match
 * @param {string} createdAt — ISO-8601; must match paired replay envelope `createdAt`
 * @param {CompletedMatchOutcomeUploadDeps} deps
 */
export async function maybeCreateCompletedMatchOutcome(match, createdAt, deps = {}) {
  try {
    if (!match?.id || match.state?.phase !== MATCH_PHASES.MATCH_OVER) return
    if (typeof createdAt !== 'string' || !createdAt) return

    const isConfigured = deps.isConfigured ?? isDungeonRunnerFirebaseConfigured
    if (!isConfigured()) return

    const seats = match.state?.seats ?? []
    const humanPlayerSeatId = resolveHumanPlayerSeatId(seats)
    const buildRecord = deps.buildRecord ?? buildMatchOutcomeRecord
    const record = buildRecord({
      matchId: match.id,
      createdAt,
      setup: match.setup,
      state: match.state,
      seats,
      humanPlayerSeatId,
      presentationSpeedProfile: match.presentationSpeedProfile,
    })

    const createOutcome = deps.createOutcome ?? defaultCreateOutcome
    await createOutcome(match.id, record)
  } catch {
    // Never throw to caller.
  }
}
