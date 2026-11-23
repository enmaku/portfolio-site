const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { bggSearchHandler } = require('./bgg/bggSearch')
const { bggThingHandler } = require('./bgg/bggThing')
const { bggThumbHandler } = require('./bgg/bggThumb')

const gameManagerApiKey = defineSecret('GAME_MANAGER_API_KEY')

const region = 'us-central1'

exports.bggSearch = onRequest(
  {
    cors: true,
    region,
    memory: '512MiB',
    secrets: [gameManagerApiKey],
  },
  bggSearchHandler,
)

exports.bggThing = onRequest(
  {
    cors: true,
    secrets: [gameManagerApiKey],
    region,
  },
  bggThingHandler,
)

exports.bggThumb = onRequest(
  {
    cors: true,
    secrets: [gameManagerApiKey],
    region,
  },
  bggThumbHandler,
)

// CritCrafter sheet builder (docs/critcrafter/SPEC.md "Function boundary"). onRequest, not callable, so
// App Check is verified in the handler (the viewer sends the token in X-Firebase-AppCheck).
let critcrafterHandler
function getCritcrafterHandler() {
  if (!critcrafterHandler) {
    const admin = require('firebase-admin')
    const logger = require('firebase-functions/logger')
    const { createSheetHandler } = require('./critcrafter')
    const { firestoreStore } = require('./critcrafter/store')
    const { verifyAppCheckToken } = require('./critcrafter/appCheck')
    if (!admin.apps.length) admin.initializeApp()
    const inEmulator = process.env.FUNCTIONS_EMULATOR === 'true'
    critcrafterHandler = createSheetHandler({
      store: firestoreStore(admin.firestore()),
      verifyAppCheck: inEmulator ? undefined : (req) => verifyAppCheckToken(req, admin),
      log: logger,
    })
  }
  return critcrafterHandler
}

exports.critcrafterSheet = onRequest(
  {
    cors: true,
    region,
    memory: '512MiB',
    minInstances: 0,
    maxInstances: 10,
    timeoutSeconds: 30,
  },
  (req, res) => getCritcrafterHandler()(req, res),
)
