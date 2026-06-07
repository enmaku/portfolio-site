/**
 * Test-only registry for Game Timer session facade wire access.
 * Import from tests via `session.testExports.js` — not from production code.
 */

/** @type {Map<symbol, () => unknown>} */
const accessByModuleKey = new Map()

/**
 * @param {symbol} moduleKey
 * @param {() => unknown} getter
 */
export function registerGameTimerTestWireAccess(moduleKey, getter) {
  accessByModuleKey.set(moduleKey, getter)
}

/**
 * @param {symbol} moduleKey
 */
export function getGameTimerSessionTestWireAccess(moduleKey) {
  const getter = accessByModuleKey.get(moduleKey)
  if (!getter) {
    throw new Error('Game Timer session test wire access is not registered for this module instance')
  }
  return getter()
}
