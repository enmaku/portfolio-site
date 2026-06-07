/**
 * Test-only registry for Movie Vote session facade wire access.
 * Import from tests via `session.testExports.js` — not from production code.
 */

/** @type {Map<symbol, () => unknown>} */
const accessByModuleKey = new Map()

/**
 * @param {symbol} moduleKey
 * @param {() => unknown} getter
 */
export function registerMovieVoteTestWireAccess(moduleKey, getter) {
  accessByModuleKey.set(moduleKey, getter)
}

/**
 * @param {symbol} moduleKey
 */
export function getMovieVoteSessionTestWireAccess(moduleKey) {
  const getter = accessByModuleKey.get(moduleKey)
  if (!getter) {
    throw new Error('Movie Vote session test wire access is not registered for this module instance')
  }
  return getter()
}
