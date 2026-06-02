import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore'
import { getDungeonRunnerFirestore, MATCH_OUTCOMES_COLLECTION } from './firestore.js'

export const HUMAN_WIN_SERIES_FETCH_LIMIT = 500

/**
 * @typedef {object} HumanWinSeriesRecord
 * @property {boolean} humanWon
 * @property {unknown} createdAt
 */

/**
 * @typedef {object} HumanWinSeriesQueryDeps
 * @property {() => import('firebase/firestore').Firestore | null} [getFirestore]
 * @property {typeof collection} [collection]
 * @property {typeof query} [query]
 * @property {typeof orderBy} [orderBy]
 * @property {typeof limit} [limit]
 * @property {typeof getDocs} [getDocs]
 */

/**
 * @param {HumanWinSeriesQueryDeps} [deps]
 * @returns {Promise<HumanWinSeriesRecord[]>}
 */
export async function fetchHumanWinSeries(deps = {}) {
  const db = (deps.getFirestore ?? getDungeonRunnerFirestore)()
  if (!db) throw new Error('Dungeon Runner Firestore is not configured')

  const coll = (deps.collection ?? collection)(db, MATCH_OUTCOMES_COLLECTION)
  const seriesQuery = (deps.query ?? query)(
    coll,
    (deps.orderBy ?? orderBy)('createdAt', 'desc'),
    (deps.limit ?? limit)(HUMAN_WIN_SERIES_FETCH_LIMIT),
  )
  const snapshot = await (deps.getDocs ?? getDocs)(seriesQuery)

  /** @type {HumanWinSeriesRecord[]} */
  const records = snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      humanWon: data.humanWon === true,
      createdAt: data.createdAt,
    }
  })

  return records.reverse()
}
