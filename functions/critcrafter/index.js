'use strict'
// critcrafterSheet wiring: store -> resolver (warm-instance cache) -> sheet builder -> HTTP handler.
const { createHandler } = require('./handler')
const { createResolver } = require('./resolve')
const { buildSheetFor } = require('./assemble')

/**
 * @param {object} deps
 * @param {object} deps.store corpus store (store.js, or an in-memory one in tests)
 * @param {(req) => Promise<boolean>} [deps.verifyAppCheck]
 * @param {object} [deps.log]
 * @param {() => Date} [deps.now]
 */
function createSheetHandler({ store, verifyAppCheck, log, now }) {
  const resolver = createResolver({ store })
  return createHandler({
    buildSheet: (build) => buildSheetFor(build, { resolver, now }),
    verifyAppCheck,
    log,
  })
}

module.exports = { createSheetHandler }
