import { getApps } from 'firebase/app'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { getTimeTrackerAuth, isTimeTrackerFirebaseConfigured } from './auth.js'

export const TIME_TRACKER_OWNERS_COLLECTION = 'timeTrackerOwners'
export const TIME_TRACKER_INVOICE_LINKS_COLLECTION = 'timeTrackerInvoiceLinks'

/** @type {import('firebase/firestore').Firestore | null} */
let firestoreInstance = null

export { isTimeTrackerFirebaseConfigured }

/**
 * @returns {import('firebase/firestore').Firestore | null}
 */
export function getTimeTrackerFirestore() {
  if (!isTimeTrackerFirebaseConfigured()) return null
  if (firestoreInstance) return firestoreInstance

  const auth = getTimeTrackerAuth()
  if (!auth) return null

  const app = getApps()[0]
  if (!app) return null

  firestoreInstance = getFirestore(app)
  return firestoreInstance
}

/**
 * @param {string} uid
 */
export function timeTrackerOwnerPath(uid) {
  return `${TIME_TRACKER_OWNERS_COLLECTION}/${uid}`
}

/**
 * @param {string} uid
 * @param {string} clientId
 */
export function timeTrackerClientPath(uid, clientId) {
  return `${timeTrackerOwnerPath(uid)}/clients/${clientId}`
}

/**
 * @param {string} uid
 * @param {string} projectId
 */
export function timeTrackerProjectPath(uid, projectId) {
  return `${timeTrackerOwnerPath(uid)}/projects/${projectId}`
}

/**
 * @param {string} uid
 * @param {string} entryId
 */
export function timeTrackerTimeEntryPath(uid, entryId) {
  return `${timeTrackerOwnerPath(uid)}/timeEntries/${entryId}`
}

/**
 * @param {string} uid
 * @param {string} invoiceId
 */
export function timeTrackerInvoicePath(uid, invoiceId) {
  return `${timeTrackerOwnerPath(uid)}/invoices/${invoiceId}`
}

/**
 * @param {string} secret
 */
export function timeTrackerInvoiceLinkPath(secret) {
  return `${TIME_TRACKER_INVOICE_LINKS_COLLECTION}/${secret}`
}

function requireDb() {
  const db = getTimeTrackerFirestore()
  if (!db) throw new Error('Time Tracker Firestore is not configured')
  return db
}

/**
 * @param {string} path
 * @param {object} data
 */
async function upsertAt(path, data) {
  await setDoc(doc(requireDb(), path), data, { merge: true })
}

/**
 * @param {string} path
 */
async function getAt(path) {
  const db = getTimeTrackerFirestore()
  if (!db) return null
  const snap = await getDoc(doc(db, path))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

/**
 * @param {string} path
 */
async function listAt(path) {
  const db = getTimeTrackerFirestore()
  if (!db) return []
  const snap = await getDocs(collection(db, path))
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }))
}

/**
 * @param {string} path
 */
async function deleteAt(path) {
  await deleteDoc(doc(requireDb(), path))
}

export function getOwnerSettings(uid) {
  return getAt(timeTrackerOwnerPath(uid))
}

export function upsertOwnerSettings(uid, settings) {
  return upsertAt(timeTrackerOwnerPath(uid), settings)
}

export function listClients(uid) {
  return listAt(`${timeTrackerOwnerPath(uid)}/clients`)
}

export function upsertClient(uid, clientId, client) {
  return upsertAt(timeTrackerClientPath(uid, clientId), client)
}

export function deleteClient(uid, clientId) {
  return deleteAt(timeTrackerClientPath(uid, clientId))
}

export function listProjects(uid) {
  return listAt(`${timeTrackerOwnerPath(uid)}/projects`)
}

export function upsertProject(uid, projectId, project) {
  return upsertAt(timeTrackerProjectPath(uid, projectId), project)
}

export function deleteProject(uid, projectId) {
  return deleteAt(timeTrackerProjectPath(uid, projectId))
}

export function listTimeEntries(uid) {
  return listAt(`${timeTrackerOwnerPath(uid)}/timeEntries`)
}

export function upsertTimeEntry(uid, entryId, entry) {
  return upsertAt(timeTrackerTimeEntryPath(uid, entryId), entry)
}

export function deleteTimeEntry(uid, entryId) {
  return deleteAt(timeTrackerTimeEntryPath(uid, entryId))
}

export function listInvoices(uid) {
  return listAt(`${timeTrackerOwnerPath(uid)}/invoices`)
}

export function upsertInvoice(uid, invoiceId, invoice) {
  return upsertAt(timeTrackerInvoicePath(uid, invoiceId), invoice)
}

export function deleteInvoice(uid, invoiceId) {
  return deleteAt(timeTrackerInvoicePath(uid, invoiceId))
}

export function getInvoiceLink(secret) {
  return getAt(timeTrackerInvoiceLinkPath(secret))
}

export function upsertInvoiceLink(secret, payload) {
  return upsertAt(timeTrackerInvoiceLinkPath(secret), payload)
}

export function deleteInvoiceLink(secret) {
  return deleteAt(timeTrackerInvoiceLinkPath(secret))
}

/**
 * @param {string} uid
 * @param {string} secret
 * @param {string} clientId
 */
export async function listInvoicesForLinkSecret(uid, secret, clientId) {
  const db = getTimeTrackerFirestore()
  if (!db) return []
  const snap = await getDocs(
    query(
      collection(db, `${timeTrackerOwnerPath(uid)}/invoices`),
      where('clientId', '==', clientId),
      where('linkSecret', '==', secret),
    ),
  )
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }))
}

/**
 * @param {string} uid
 * @param {string} invoiceId
 * @param {number} amountPaidCents
 */
export function updateInvoiceAmountPaid(uid, invoiceId, amountPaidCents) {
  return upsertAt(timeTrackerInvoicePath(uid, invoiceId), { amountPaidCents })
}
