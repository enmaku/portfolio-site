import { getApps } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { createRtdbCore } from '../../p2p/firebase/createRtdbCore.js'

const core = createRtdbCore({ configuredBehavior: 'null', label: 'Account owner Firebase' })

/** @type {ReadonlySet<string>} */
const ACCOUNT_OWNER_PROVIDER_IDS = new Set(['google.com', 'password'])

/** @type {import('firebase/auth').Auth | null} */
let authInstance = null

/**
 * @returns {boolean}
 */
export function isPortfolioFirebaseConfigured() {
  return core.isConfigured()
}

/**
 * @returns {import('firebase/auth').Auth | null}
 */
export function getPortfolioAuth() {
  if (!isPortfolioFirebaseConfigured()) return null
  if (authInstance) return authInstance

  core.getDatabase()
  const app = getApps()[0]
  if (!app) return null

  authInstance = getAuth(app)
  return authInstance
}

/**
 * @param {import('firebase/auth').User | null | undefined} user
 * @returns {boolean}
 */
export function isAccountOwnerUser(user) {
  if (!user || user.isAnonymous) return false

  const providerData = user.providerData ?? []
  if (providerData.length === 0) return false

  return providerData.some(
    (provider) => provider?.providerId && ACCOUNT_OWNER_PROVIDER_IDS.has(provider.providerId),
  )
}

/**
 * @param {(user: import('firebase/auth').User | null) => void} onChange
 * @returns {() => void}
 */
export function subscribeAccountOwnerAuthState(onChange) {
  const auth = getPortfolioAuth()
  if (!auth) {
    onChange(null)
    return () => {}
  }

  return onAuthStateChanged(auth, onChange)
}

/**
 * @returns {Promise<import('firebase/auth').User | null>}
 */
export async function signInWithGooglePopup() {
  const auth = getPortfolioAuth()
  if (!auth) return null

  const provider = new GoogleAuthProvider()
  const credential = await signInWithPopup(auth, provider)
  return credential.user
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').User | null>}
 */
export async function createAccountWithEmailPassword(email, password) {
  const auth = getPortfolioAuth()
  if (!auth) return null

  const credential = await createUserWithEmailAndPassword(auth, email, password)
  return credential.user
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').User | null>}
 */
export async function signInWithEmailPassword(email, password) {
  const auth = getPortfolioAuth()
  if (!auth) return null

  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

/**
 * @returns {Promise<void>}
 */
export async function signOutAccountOwner() {
  const auth = getPortfolioAuth()
  if (!auth) return
  await signOut(auth)
}
