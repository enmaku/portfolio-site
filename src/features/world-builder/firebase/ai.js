import { getApps } from 'firebase/app'
import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'
import { createRtdbCore } from '../../p2p/firebase/createRtdbCore.js'

/** Google's public reCAPTCHA v3 test site key — used only when debug App Check is on. */
const RECAPTCHA_TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'

const SETTLEMENT_NAMES_RESPONSE_SCHEMA = Schema.object({
  properties: {
    settlements: Schema.array({
      items: Schema.object({
        properties: {
          settlementId: Schema.string(),
          mapNumber: Schema.number(),
          name: Schema.string(),
        },
        optionalProperties: ['mapNumber'],
      }),
    }),
    factions: Schema.array({
      items: Schema.object({
        properties: {
          factionId: Schema.string(),
          name: Schema.string(),
        },
      }),
    }),
  },
})

/** @type {boolean} */
let appCheckReady = false

/**
 * Ensures the shared Firebase app exists (same singleton as RTDB features).
 * @returns {import('firebase/app').FirebaseApp}
 */
export function ensureFirebaseApp() {
  const existing = getApps()[0]
  if (existing) return existing

  const core = createRtdbCore({ configuredBehavior: 'throw', label: 'Firebase AI Logic' })
  core.getDatabase()
  const app = getApps()[0]
  if (!app) {
    throw new Error('Firebase app failed to initialize')
  }
  return app
}

/**
 * App Check is enforced for Firebase AI Logic. Local spike uses the debug provider:
 * set VITE_FIREBASE_APPCHECK_DEBUG_TOKEN to a console-registered UUID (preferred),
 * or leave unset in DEV to print a new token in the browser console to register.
 *
 * @param {import('firebase/app').FirebaseApp} app
 */
export async function ensureFirebaseAppCheck(app) {
  if (appCheckReady) return

  const debugToken = String(import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN ?? '').trim()
  if (import.meta.env.DEV || debugToken) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken || true
  }

  const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check')
  const siteKey =
    String(import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY ?? '').trim() ||
    (import.meta.env.DEV || debugToken ? RECAPTCHA_TEST_SITE_KEY : '')

  if (!siteKey) {
    throw new Error(
      'Set VITE_FIREBASE_RECAPTCHA_SITE_KEY in .env (Firebase Console → App Check → register web app), or set VITE_FIREBASE_APPCHECK_DEBUG_TOKEN for local spike use.',
    )
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  })
  appCheckReady = true
}

/**
 * Gemini Developer API model for World Builder settlement-name experiments.
 * @returns {Promise<import('firebase/ai').GenerativeModel>}
 */
export async function createSettlementNamesModel() {
  const app = ensureFirebaseApp()
  await ensureFirebaseAppCheck(app)
  const ai = getAI(app, { backend: new GoogleAIBackend() })
  return getGenerativeModel(ai, {
    model: 'gemini-flash-latest',
    generationConfig: {
      temperature: 0.9,
      responseMimeType: 'application/json',
      responseSchema: SETTLEMENT_NAMES_RESPONSE_SCHEMA,
    },
  })
}
