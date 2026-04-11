import { computed } from 'vue'
import {
  joinRoom,
  leaveSession,
  resumeP2PSessionIfNeeded,
  sessionPhase,
  sessionSuffix,
  startAsHost,
} from '../p2p/session.js'

/**
 * Reactive multiplayer session state and actions (wraps `session.js` refs and exports).
 * @returns {{
 *   phase: import('vue').Ref<'idle' | 'connecting' | 'reconnecting' | 'hosting' | 'guest_connected'>,
 *   suffix: import('vue').Ref<string | null>,
 *   isInSession: import('vue').ComputedRef<boolean>,
 *   isHosting: import('vue').ComputedRef<boolean>,
 *   isGuest: import('vue').ComputedRef<boolean>,
 *   startAsHost: typeof startAsHost,
 *   joinRoom: typeof joinRoom,
 *   leaveSession: typeof leaveSession,
 *   resumeP2PSessionIfNeeded: typeof resumeP2PSessionIfNeeded,
 * }}
 */
export function useGameTimerP2P() {
  const isInSession = computed(
    () => sessionPhase.value === 'hosting' || sessionPhase.value === 'guest_connected',
  )
  const isHosting = computed(() => sessionPhase.value === 'hosting')
  const isGuest = computed(() => sessionPhase.value === 'guest_connected')

  return {
    phase: sessionPhase,
    suffix: sessionSuffix,
    isInSession,
    isHosting,
    isGuest,
    startAsHost,
    joinRoom,
    leaveSession,
    resumeP2PSessionIfNeeded,
  }
}
