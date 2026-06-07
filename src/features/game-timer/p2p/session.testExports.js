/**
 * Test-only helpers for Game Timer session facade contract tests.
 * Import from tests only — not from production code.
 */

import { getGameTimerSessionTestWireAccess } from './session.testWireAccess.js'

/**
 * @param {{ GAME_TIMER_SESSION_TEST_MODULE_KEY: symbol }} sessionMod
 * @returns {ReturnType<typeof getGameTimerSessionTestWireAccess>}
 */
function wireAccess(sessionMod) {
  return /** @type {ReturnType<typeof getGameTimerSessionTestWireAccess>} */ (
    getGameTimerSessionTestWireAccess(sessionMod.GAME_TIMER_SESSION_TEST_MODULE_KEY)
  )
}

/**
 * @param {{ GAME_TIMER_SESSION_TEST_MODULE_KEY: symbol }} sessionMod
 * @returns {void}
 */
export function bumpGameTimerReconnectGenerationForTests(sessionMod) {
  wireAccess(sessionMod).core.bumpReconnectGeneration()
}

/**
 * @param {{ GAME_TIMER_SESSION_TEST_MODULE_KEY: symbol }} sessionMod
 * @returns {void}
 */
export function resetGameTimerP2PWireStateForTests(sessionMod) {
  const access = wireAccess(sessionMod)
  access.remoteHostTabVisible.value = true
  access.remoteHostPresent.value = true
  access.resetHostGuestWireState()
  access.core.destroyWireOnly()
  access.core.setPhase('idle')
  access.core.setSuffix(null)
  access.setHandlers(access.emptyHandlers())
}
