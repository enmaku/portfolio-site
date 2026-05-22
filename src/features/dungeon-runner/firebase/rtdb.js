import { ref } from 'firebase/database'
import { createRtdbCore } from '../../p2p/firebase/createRtdbCore.js'

/** RTDB root for completed **match over** payloads ([Replay envelope contract (v1)](../CONTRACT.md#replay-envelope-contract-v1)). */
const COMPLETED_MATCHES_ROOT = 'dungeonRunnerCompletedMatches'

const core = createRtdbCore({ configuredBehavior: 'null' })

/**
 * @returns {boolean}
 */
export function isDungeonRunnerFirebaseConfigured() {
  return core.isConfigured()
}

/**
 * @returns {import('firebase/database').Database | null}
 */
export function getDungeonRunnerDatabase() {
  return core.getDatabase()
}

/**
 * RTDB path for a completed match (no leading slash).
 * Value at this path is the v1 replay envelope body (match id is the path key only).
 * @param {string} matchId
 * @returns {string}
 */
export function dungeonRunnerCompletedMatchPath(matchId) {
  return `${COMPLETED_MATCHES_ROOT}/${matchId}`
}

/**
 * @param {string} matchId
 * @returns {import('firebase/database').DatabaseReference | null}
 */
export function dungeonRunnerCompletedMatchRef(matchId) {
  if (!isDungeonRunnerFirebaseConfigured()) return null
  const db = getDungeonRunnerDatabase()
  if (!db) return null
  return ref(db, dungeonRunnerCompletedMatchPath(matchId))
}

export const sanitizeForRtdb = core.sanitizeForRtdb
export const setRtdb = core.setRtdb
