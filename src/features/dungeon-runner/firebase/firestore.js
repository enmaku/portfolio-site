import { getApps } from 'firebase/app'
import { doc, getFirestore, setDoc } from 'firebase/firestore'
import {
  getDungeonRunnerDatabase,
  isDungeonRunnerFirebaseConfigured,
  sanitizeForRtdb,
} from './rtdb.js'

/** Firestore collection for **completed match outcome** ([Match outcome record (v1)](../CONTRACT.md#match-outcome-record-v1)). */
export const MATCH_OUTCOMES_COLLECTION = 'dungeonRunnerMatchOutcomes'

/** @type {import('firebase/firestore').Firestore | null} */
let firestoreInstance = null

export { isDungeonRunnerFirebaseConfigured }

/**
 * @returns {import('firebase/firestore').Firestore | null}
 */
export function getDungeonRunnerFirestore() {
  if (!isDungeonRunnerFirebaseConfigured()) return null
  if (firestoreInstance) return firestoreInstance

  getDungeonRunnerDatabase()
  const app = getApps()[0]
  if (!app) return null

  firestoreInstance = getFirestore(app)
  return firestoreInstance
}

/**
 * @param {string} matchId
 * @returns {string}
 */
export function dungeonRunnerMatchOutcomePath(matchId) {
  return `${MATCH_OUTCOMES_COLLECTION}/${matchId}`
}

/**
 * @param {string} matchId
 * @returns {import('firebase/firestore').DocumentReference | null}
 */
export function dungeonRunnerMatchOutcomeRef(matchId) {
  const db = getDungeonRunnerFirestore()
  if (!db) return null
  return doc(db, MATCH_OUTCOMES_COLLECTION, matchId)
}

/**
 * Create-only write; rules deny update when the doc already exists.
 * @param {import('firebase/firestore').DocumentReference} docRef
 * @param {unknown} value
 */
export async function createFirestoreDoc(docRef, value) {
  await setDoc(docRef, sanitizeForRtdb(value))
}
