import { getApps, initializeApp } from 'firebase/app'

/** @type {Promise<string | null> | null} */
let providerReady = null
/** @type {import('firebase/app-check').AppCheck | null} */
let appCheck = null

function env() {
  return typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}
}

async function init() {
  const e = env()
  const siteKey = String(e.VITE_FIREBASE_APPCHECK_SITE_KEY ?? '').trim()
  const apiKey = String(e.VITE_FIREBASE_API_KEY ?? '').trim()
  const projectId = String(e.VITE_FIREBASE_PROJECT_ID ?? '').trim()
  const appId = String(e.VITE_FIREBASE_APP_ID ?? '').trim()
  if (!siteKey || !apiKey || !projectId || !appId) return null
  const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check')
  if (e.DEV && e.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = e.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN
  }
  const app = getApps().length > 0 ? getApps()[0] : initializeApp({
    apiKey,
    projectId,
    appId,
    authDomain: String(e.VITE_FIREBASE_AUTH_DOMAIN ?? '').trim() || undefined,
  })
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  })
  return null
}

/**
 * Firebase App Check token for the sheet function, or null when App Check is not configured
 * (no `VITE_FIREBASE_APPCHECK_SITE_KEY`), e.g. against the emulator.
 * @returns {Promise<string | null>}
 */
export async function getAppCheckToken() {
  providerReady ??= init()
  await providerReady
  if (!appCheck) return null
  const { getToken } = await import('firebase/app-check')
  const { token } = await getToken(appCheck, false)
  return token
}
