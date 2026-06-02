import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore'
import { getDungeonRunnerFirestore, MATCH_OUTCOMES_COLLECTION } from './firestore.js'

export const MATCH_LENGTH_SERIES_FETCH_LIMIT = 500

/**
 * @typedef {object} MatchLengthSeriesRecord
 * @property {string} createdAt
 * @property {number} historyStepCount
 */

/**
 * @typedef {object} MatchLengthSeriesQueryDeps
 * @property {() => import('firebase/firestore').Firestore | null} [getFirestore]
 * @property {typeof collection} [collection]
 * @property {typeof query} [query]
 * @property {typeof orderBy} [orderBy]
 * @property {typeof limit} [limit]
 * @property {typeof getDocs} [getDocs]
 */

/**
 * @param {MatchLengthSeriesQueryDeps} [deps]
 * @returns {Promise<MatchLengthSeriesRecord[]>}
 */
export async function fetchMatchLengthSeries(deps = {}) {
  const db = (deps.getFirestore ?? getDungeonRunnerFirestore)()
  if (!db) throw new Error('Dungeon Runner Firestore is not configured')

  const coll = (deps.collection ?? collection)(db, MATCH_OUTCOMES_COLLECTION)
  const seriesQuery = (deps.query ?? query)(
    coll,
    (deps.orderBy ?? orderBy)('createdAt', 'desc'),
    (deps.limit ?? limit)(MATCH_LENGTH_SERIES_FETCH_LIMIT),
  )
  const snapshot = await (deps.getDocs ?? getDocs)(seriesQuery)

  /** @type {MatchLengthSeriesRecord[]} */
  const records = []
  for (const doc of snapshot.docs) {
    const data = doc.data()
    const createdAt = data.createdAt
    const historyStepCount = data.historyStepCount
    if (typeof createdAt !== 'string' || createdAt.length === 0 || !Number.isFinite(Date.parse(createdAt))) {
      continue
    }
    if (!Number.isInteger(historyStepCount) || historyStepCount < 0) continue
    records.push({ createdAt, historyStepCount })
  }

  return records.reverse()
}
