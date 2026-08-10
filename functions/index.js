const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { bggSearchHandler } = require('./bgg/bggSearch')
const { bggThingHandler } = require('./bgg/bggThing')

const gameManagerApiKey = defineSecret('GAME_MANAGER_API_KEY')

const region = 'us-central1'

exports.bggSearch = onRequest(
  {
    cors: true,
    region,
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
