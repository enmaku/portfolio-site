import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai'

/** Secondary Firebase app name — keeps WB AI off the portfolio-site singleton. */
export const WORLD_BUILDER_AI_APP_NAME = 'world-builder-ai'

/** Google's public reCAPTCHA v3 test site key — used only when debug App Check is on. */
const RECAPTCHA_TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'

const SETTLEMENT_NAME_ROW_SCHEMA = Schema.object({
  properties: {
    settlementId: Schema.string(),
    mapNumber: Schema.number(),
    name: Schema.string(),
  },
  optionalProperties: ['mapNumber'],
})

const FACTION_NAME_ROW_SCHEMA = Schema.object({
  properties: {
    factionId: Schema.string(),
    name: Schema.string(),
  },
})

const NOTABLE_SETTLEMENT_ROW_SCHEMA = Schema.object({
  properties: {
    settlementId: Schema.string(),
    mapNumber: Schema.number(),
    name: Schema.string(),
    description: Schema.string(),
  },
  optionalProperties: ['mapNumber', 'name'],
})

const FACTION_PROFILE_ROW_SCHEMA = Schema.object({
  properties: {
    factionId: Schema.string(),
    summary: Schema.string(),
  },
})

/** Names-only (ablation / naming experiments without writeup). */
const SETTLEMENT_NAMES_RESPONSE_SCHEMA = Schema.object({
  properties: {
    settlements: Schema.array({ items: SETTLEMENT_NAME_ROW_SCHEMA }),
    factions: Schema.array({ items: FACTION_NAME_ROW_SCHEMA }),
  },
})

/** Live UI: names + required regional writeup in one response. */
const SETTLEMENT_NAMES_WITH_WRITEUP_RESPONSE_SCHEMA = Schema.object({
  properties: {
    settlements: Schema.array({ items: SETTLEMENT_NAME_ROW_SCHEMA }),
    factions: Schema.array({ items: FACTION_NAME_ROW_SCHEMA }),
    factionProfiles: Schema.array({ items: FACTION_PROFILE_ROW_SCHEMA }),
    regionName: Schema.string(),
    overview: Schema.string(),
    notableSettlements: Schema.array({ items: NOTABLE_SETTLEMENT_ROW_SCHEMA }),
    writeupSettlementIds: Schema.array({ items: Schema.string() }),
  },
})

const NAME_JUDGE_RESPONSE_SCHEMA = Schema.object({
  properties: {
    flavorFitA: Schema.number(),
    flavorFitB: Schema.number(),
    diversityA: Schema.number(),
    diversityB: Schema.number(),
    groundednessA: Schema.number(),
    groundednessB: Schema.number(),
    factionDistinctivenessA: Schema.number(),
    factionDistinctivenessB: Schema.number(),
    betterSet: Schema.string(),
    rationale: Schema.string(),
  },
})

/** @type {boolean} */
let appCheckReady = false

/**
 * @param {string} key
 * @returns {string}
 */
function readEnv(key) {
  const meta =
    typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env === 'object'
      ? import.meta.env[key]
      : undefined
  const fromMeta = String(meta ?? '').trim()
  if (fromMeta) return fromMeta
  if (typeof process !== 'undefined' && process.env) {
    return String(process.env[key] ?? '').trim()
  }
  return ''
}

function isDevLike() {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV === true) {
    return true
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV !== 'production'
  }
  return true
}

/**
 * World Builder Gemini uses `enmaku-worldbuilder` credentials
 * (`VITE_WORLD_BUILDER_FIREBASE_*`), separate from portfolio `VITE_FIREBASE_*`.
 *
 * @returns {import('firebase/app').FirebaseApp}
 */
export function ensureWorldBuilderAiApp() {
  if (getApps().some((app) => app.name === WORLD_BUILDER_AI_APP_NAME)) {
    return getApp(WORLD_BUILDER_AI_APP_NAME)
  }

  const apiKey = readEnv('VITE_WORLD_BUILDER_FIREBASE_API_KEY')
  const authDomain = readEnv('VITE_WORLD_BUILDER_FIREBASE_AUTH_DOMAIN')
  const projectId = readEnv('VITE_WORLD_BUILDER_FIREBASE_PROJECT_ID')
  const appId = readEnv('VITE_WORLD_BUILDER_FIREBASE_APP_ID')

  if (!apiKey || !authDomain || !projectId || !appId) {
    throw new Error(
      'World Builder AI is not configured. Set VITE_WORLD_BUILDER_FIREBASE_API_KEY, AUTH_DOMAIN, PROJECT_ID, and APP_ID in .env (enmaku-worldbuilder).',
    )
  }

  /** @type {import('firebase/app').FirebaseOptions} */
  const config = { apiKey, authDomain, projectId, appId }
  const storageBucket = readEnv('VITE_WORLD_BUILDER_FIREBASE_STORAGE_BUCKET')
  if (storageBucket) config.storageBucket = storageBucket
  const messagingSenderId = readEnv('VITE_WORLD_BUILDER_FIREBASE_MESSAGING_SENDER_ID')
  if (messagingSenderId) config.messagingSenderId = messagingSenderId

  return initializeApp(config, WORLD_BUILDER_AI_APP_NAME)
}

/** @deprecated Use ensureWorldBuilderAiApp */
export function ensureFirebaseApp() {
  return ensureWorldBuilderAiApp()
}

/**
 * App Check for the World Builder AI Firebase app.
 * Browser: reCAPTCHA v3 (+ optional debug token).
 * Node: CustomProvider exchanging VITE_WORLD_BUILDER_FIREBASE_APPCHECK_DEBUG_TOKEN.
 *
 * @param {import('firebase/app').FirebaseApp} app
 */
export async function ensureFirebaseAppCheck(app) {
  if (appCheckReady) return

  const debugToken = readEnv('VITE_WORLD_BUILDER_FIREBASE_APPCHECK_DEBUG_TOKEN')
  const { initializeAppCheck, ReCaptchaV3Provider, CustomProvider } = await import(
    'firebase/app-check'
  )

  const isNode = typeof document === 'undefined'
  if (isNode) {
    if (!debugToken) {
      throw new Error(
        'Node Gemini calls need VITE_WORLD_BUILDER_FIREBASE_APPCHECK_DEBUG_TOKEN in .env (App Check → enmaku-worldbuilder web app → Manage debug tokens).',
      )
    }
    const projectId = app.options.projectId
    const appId = app.options.appId
    const apiKey = app.options.apiKey
    if (!projectId || !appId || !apiKey) {
      throw new Error('Firebase app is missing projectId, appId, or apiKey for App Check debug exchange')
    }

    initializeAppCheck(app, {
      provider: new CustomProvider({
        getToken: async () => {
          const url = `https://firebaseappcheck.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/apps/${encodeURIComponent(appId)}:exchangeDebugToken?key=${encodeURIComponent(apiKey)}`
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ debugToken, limitedUse: false }),
          })
          if (!response.ok) {
            const body = await response.text()
            throw new Error(`App Check exchangeDebugToken failed (${response.status}): ${body}`)
          }
          /** @type {{ token?: string, ttl?: string }} */
          const payload = await response.json()
          if (typeof payload.token !== 'string' || !payload.token) {
            throw new Error('App Check exchangeDebugToken returned no token')
          }
          const ttlMatch = typeof payload.ttl === 'string' ? /^(\d+)s$/.exec(payload.ttl) : null
          const ttlSeconds = ttlMatch ? Number(ttlMatch[1]) : 3600
          return {
            token: payload.token,
            expireTimeMillis: Date.now() + ttlSeconds * 1000,
          }
        },
      }),
      isTokenAutoRefreshEnabled: true,
    })
    appCheckReady = true
    return
  }

  if (isDevLike() || debugToken) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken || true
  }

  const siteKey =
    readEnv('VITE_WORLD_BUILDER_FIREBASE_RECAPTCHA_SITE_KEY') ||
    (isDevLike() || debugToken ? RECAPTCHA_TEST_SITE_KEY : '')

  if (!siteKey) {
    throw new Error(
      'Set VITE_WORLD_BUILDER_FIREBASE_RECAPTCHA_SITE_KEY or VITE_WORLD_BUILDER_FIREBASE_APPCHECK_DEBUG_TOKEN for World Builder AI App Check.',
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
 * @param {{ includeRegionWriteup?: boolean }} [options]
 * @returns {Promise<import('firebase/ai').GenerativeModel>}
 */
export async function createSettlementNamesModel(options = {}) {
  const includeRegionWriteup = options.includeRegionWriteup === true
  const app = ensureWorldBuilderAiApp()
  await ensureFirebaseAppCheck(app)
  const ai = getAI(app, { backend: new GoogleAIBackend() })
  return getGenerativeModel(ai, {
    model: 'gemini-3.5-flash-lite',
    generationConfig: {
      temperature: 0.9,
      responseMimeType: 'application/json',
      responseSchema: includeRegionWriteup
        ? SETTLEMENT_NAMES_WITH_WRITEUP_RESPONSE_SCHEMA
        : SETTLEMENT_NAMES_RESPONSE_SCHEMA,
    },
  })
}

/**
 * Gemini judge model for prompt-ablation scoring.
 * @returns {Promise<import('firebase/ai').GenerativeModel>}
 */
export async function createSettlementNameJudgeModel() {
  const app = ensureWorldBuilderAiApp()
  await ensureFirebaseAppCheck(app)
  const ai = getAI(app, { backend: new GoogleAIBackend() })
  return getGenerativeModel(ai, {
    model: 'gemini-3.5-flash-lite',
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: NAME_JUDGE_RESPONSE_SCHEMA,
    },
  })
}
