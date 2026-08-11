import { parseNameRejected } from './protocol.js'

/**
 * Guest welcome + kick listeners (name-rejected multiplexed on welcome path).
 *
 * @param {object} deps
 * @param {(suffix: string, path: string) => import('firebase/database').DatabaseReference} deps.roomChild
 * @param {typeof import('firebase/database').onValue} deps.onValue
 * @param {(unsub: () => void) => void} deps.trackFeatureUnsub
 * @param {(raw: unknown) => void} deps.handleGuestWelcome
 * @param {(message: string, type?: string) => void} deps.notifyP2P
 * @param {() => void} deps.clearRoomPersistence
 * @param {() => void} deps.resetLocalStateAfterRoomExit
 */
export function createGuestWelcomeKickWire(deps) {
  /**
   * @param {string} suffix
   * @param {string} stableId
   */
  function wireGuestWelcome(suffix, stableId) {
    deps.trackFeatureUnsub(
      deps.onValue(deps.roomChild(suffix, `welcome/${stableId}`), (snap) => {
        const raw = snap.val()
        if (raw == null) return
        if (parseNameRejected(raw)) {
          deps.notifyP2P('That name is already taken in this room.', 'negative')
          deps.clearRoomPersistence()
          deps.resetLocalStateAfterRoomExit()
          return
        }
        deps.handleGuestWelcome(raw)
      }),
    )
    let kickListenerPrimed = false
    deps.trackFeatureUnsub(
      deps.onValue(deps.roomChild(suffix, `kicked/${stableId}`), (snap) => {
        const kicked = snap.val() === true
        // Residual true from a prior eject must not abort a deliberate rejoin.
        if (!kickListenerPrimed) {
          kickListenerPrimed = true
          if (kicked) return
        }
        if (!kicked) return
        deps.notifyP2P('You were removed from the room.', 'info')
        deps.clearRoomPersistence()
        deps.resetLocalStateAfterRoomExit()
      }),
    )
  }

  return { wireGuestWelcome }
}
