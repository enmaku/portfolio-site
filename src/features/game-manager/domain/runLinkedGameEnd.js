/**
 * Fail-closed game-end attach → scoring handoff for manager-linked Timer.
 */

/**
 * @param {{
 *   canPersist: () => boolean,
 *   playSessionId: () => string | null,
 *   isHosting: () => boolean,
 *   deriveExport: () => object,
 *   attachExport: (timerExport: object) => Promise<unknown>,
 *   transitionToScoring: () => Promise<unknown>,
 *   leaveSession: () => void,
 *   clearLink: () => void,
 *   recordPosture: (input: { isHosting: boolean }) => void,
 *   navigateToManagerScoring: (playSessionId: string) => void,
 * }} deps
 * @returns {Promise<{ ok: true } | { ok: false, reason: 'auth' | 'attach' | 'transition' | 'link', error?: unknown }>}
 */
export async function runLinkedGameEnd(deps) {
  if (!deps.canPersist()) {
    return { ok: false, reason: 'auth' }
  }
  const playSessionId = deps.playSessionId()
  if (!playSessionId) {
    return { ok: false, reason: 'link' }
  }

  const timerExport = deps.deriveExport()
  try {
    await deps.attachExport(timerExport)
  } catch (error) {
    return { ok: false, reason: 'attach', error }
  }

  try {
    await deps.transitionToScoring()
  } catch (error) {
    return { ok: false, reason: 'transition', error }
  }

  const wasHosting = deps.isHosting()
  if (wasHosting) {
    deps.leaveSession()
  }
  deps.recordPosture({ isHosting: wasHosting })
  deps.clearLink()
  deps.navigateToManagerScoring(playSessionId)
  return { ok: true }
}
