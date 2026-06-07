/**
 * Test-only helpers for Game Timer session facade contract tests.
 * Import from tests only — not from production code.
 */

/**
 * @param {{ getGameTimerSessionTestWireAccess: () => ReturnType<typeof import('./session.js').getGameTimerSessionTestWireAccess> }} sessionMod
 * @returns {void}
 */
export function bumpGameTimerReconnectGenerationForTests(sessionMod) {
  sessionMod.getGameTimerSessionTestWireAccess().core.bumpReconnectGeneration()
}

/**
 * @param {{ getGameTimerSessionTestWireAccess: () => ReturnType<typeof import('./session.js').getGameTimerSessionTestWireAccess> }} sessionMod
 * @returns {void}
 */
export function resetGameTimerP2PWireStateForTests(sessionMod) {
  const access = sessionMod.getGameTimerSessionTestWireAccess()
  access.remoteHostTabVisible.value = true
  access.remoteHostPresent.value = true
  access.resetHostGuestWireState()
  access.core.destroyWireOnly()
  access.core.setPhase('idle')
  access.core.setSuffix(null)
  access.setHandlers(access.emptyHandlers())
}
