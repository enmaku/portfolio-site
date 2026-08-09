import { getApps } from 'firebase/app'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
} from 'firebase/firestore'
import { getGameManagerAuth, isGameManagerFirebaseConfigured } from './auth.js'

export const GAME_MANAGER_OWNERS_COLLECTION = 'gameManagerOwners'

/** @type {import('firebase/firestore').Firestore | null} */
let firestoreInstance = null

export { isGameManagerFirebaseConfigured }

/**
 * @returns {import('firebase/firestore').Firestore | null}
 */
export function getGameManagerFirestore() {
  if (!isGameManagerFirebaseConfigured()) return null
  if (firestoreInstance) return firestoreInstance

  const auth = getGameManagerAuth()
  if (!auth) return null

  const app = getApps()[0]
  if (!app) return null

  firestoreInstance = getFirestore(app)
  return firestoreInstance
}

/**
 * @param {string} uid
 */
export function gameManagerOwnerPath(uid) {
  return `${GAME_MANAGER_OWNERS_COLLECTION}/${uid}`
}

/**
 * @param {string} uid
 * @param {string} personId
 */
export function gameManagerPersonPath(uid, personId) {
  return `${gameManagerOwnerPath(uid)}/people/${personId}`
}

/**
 * @param {string} uid
 * @param {string} itemId
 */
export function gameManagerCollectionItemPath(uid, itemId) {
  return `${gameManagerOwnerPath(uid)}/collection/${itemId}`
}

/**
 * @param {string} uid
 * @param {string} sessionId
 */
export function gameManagerPlaySessionPath(uid, sessionId) {
  return `${gameManagerOwnerPath(uid)}/playSessions/${sessionId}`
}

/**
 * @param {string} uid
 * @param {string} personId
 * @param {object} person
 */
export async function upsertManagerPerson(uid, personId, person) {
  const db = getGameManagerFirestore()
  if (!db) throw new Error('Game Manager Firestore is not configured')
  await setDoc(doc(db, gameManagerPersonPath(uid, personId)), person, { merge: true })
}

/**
 * @param {string} uid
 */
export async function listManagerPeople(uid) {
  const db = getGameManagerFirestore()
  if (!db) return []
  const snap = await getDocs(collection(db, `${gameManagerOwnerPath(uid)}/people`))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * @param {string} uid
 * @param {string} personId
 */
export async function deleteManagerPerson(uid, personId) {
  const db = getGameManagerFirestore()
  if (!db) throw new Error('Game Manager Firestore is not configured')
  await deleteDoc(doc(db, gameManagerPersonPath(uid, personId)))
}

/**
 * @param {string} uid
 * @param {string} itemId
 * @param {object} item
 */
export async function upsertManagerCollectionItem(uid, itemId, item) {
  const db = getGameManagerFirestore()
  if (!db) throw new Error('Game Manager Firestore is not configured')
  await setDoc(doc(db, gameManagerCollectionItemPath(uid, itemId)), item, { merge: true })
}

/**
 * @param {string} uid
 */
export async function listManagerCollection(uid) {
  const db = getGameManagerFirestore()
  if (!db) return []
  const snap = await getDocs(collection(db, `${gameManagerOwnerPath(uid)}/collection`))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * @param {string} uid
 * @param {string} itemId
 */
export async function deleteManagerCollectionItem(uid, itemId) {
  const db = getGameManagerFirestore()
  if (!db) throw new Error('Game Manager Firestore is not configured')
  await deleteDoc(doc(db, gameManagerCollectionItemPath(uid, itemId)))
}

/**
 * @param {string} uid
 * @param {string} sessionId
 * @param {object} session
 */
export async function upsertManagerPlaySession(uid, sessionId, session) {
  const db = getGameManagerFirestore()
  if (!db) throw new Error('Game Manager Firestore is not configured')
  await setDoc(doc(db, gameManagerPlaySessionPath(uid, sessionId)), session, { merge: true })
}

/**
 * @param {string} uid
 * @param {string} sessionId
 */
export async function getManagerPlaySession(uid, sessionId) {
  const db = getGameManagerFirestore()
  if (!db) return null
  const snap = await getDoc(doc(db, gameManagerPlaySessionPath(uid, sessionId)))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/**
 * @param {string} uid
 */
export async function listManagerPlaySessions(uid) {
  const db = getGameManagerFirestore()
  if (!db) return []
  const snap = await getDocs(collection(db, `${gameManagerOwnerPath(uid)}/playSessions`))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * @param {string} uid
 * @param {string} sessionId
 */
export async function deleteManagerPlaySession(uid, sessionId) {
  const db = getGameManagerFirestore()
  if (!db) throw new Error('Game Manager Firestore is not configured')
  await deleteDoc(doc(db, gameManagerPlaySessionPath(uid, sessionId)))
}
