const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { bggSearchHandler } = require('./bgg/bggSearch')
const { bggThingHandler } = require('./bgg/bggThing')

const gameManagerApiKey = defineSecret('GAME_MANAGER_API_KEY')

const sharedOptions = {
  cors: true,
  secrets: [gameManagerApiKey],
  region: 'us-central1',
}

exports.bggSearch = onRequest(sharedOptions, bggSearchHandler)
exports.bggThing = onRequest(sharedOptions, bggThingHandler)
