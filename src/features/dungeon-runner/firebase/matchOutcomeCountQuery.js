import { collection, getCountFromServer, query, where } from 'firebase/firestore'
import { getDungeonRunnerFirestore, MATCH_OUTCOMES_COLLECTION } from './firestore.js'

/**
 * @typedef {object} MatchOutcomeCountQueryDeps
 * @property {() => import('firebase/firestore').Firestore | null} [getFirestore]
 * @property {typeof collection} [collection]
 * @property {typeof query} [query]
 * @property {typeof where} [where]
 * @property {typeof getCountFromServer} [getCountFromServer]
 */

/**
 * @param {MatchOutcomeCountQueryDeps} [deps]
 * @returns {Promise<number>}
 */
export async function countAllMatchOutcomes(deps = {}) {
  const db = (deps.getFirestore ?? getDungeonRunnerFirestore)()
  if (!db) throw new Error('Dungeon Runner Firestore is not configured')
  const coll = (deps.collection ?? collection)(db, MATCH_OUTCOMES_COLLECTION)
  const snapshot = await (deps.getCountFromServer ?? getCountFromServer)(coll)
  return snapshot.data().count
}

/**
 * @param {string} field
 * @param {unknown} value
 * @param {MatchOutcomeCountQueryDeps} [deps]
 * @returns {Promise<number>}
 */
export async function countMatchOutcomesWhere(field, value, deps = {}) {
  const db = (deps.getFirestore ?? getDungeonRunnerFirestore)()
  if (!db) throw new Error('Dungeon Runner Firestore is not configured')
  const coll = (deps.collection ?? collection)(db, MATCH_OUTCOMES_COLLECTION)
  const filtered = (deps.query ?? query)(
    coll,
    (deps.where ?? where)(field, '==', value),
  )
  const snapshot = await (deps.getCountFromServer ?? getCountFromServer)(filtered)
  return snapshot.data().count
}
