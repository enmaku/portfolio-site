/**
 * @import '../types.js'
 */

import { computed } from 'vue'
import {
  isMovieVoteP2PSessionActive,
  joinRoom,
  leaveSession,
  remoteHostTabVisible,
  resumeMovieVoteSessionIfNeeded,
  sessionPhase,
  sessionSuffix,
  startAsHost,
} from '../p2p/session.js'

/**
 * Reactive multiplayer session state and actions (wraps `session.js` refs and exports).
 *
 * @returns {{
 *   phase: import('vue').Ref<MovieVoteSessionPhase>,
 *   suffix: import('vue').Ref<string | null>,
 *   isInSession: import('vue').ComputedRef<boolean>,
 *   isHosting: import('vue').ComputedRef<boolean>,
 *   isGuest: import('vue').ComputedRef<boolean>,
 *   remoteHostTabVisible: typeof remoteHostTabVisible,
 *   startAsHost: typeof startAsHost,
 *   joinRoom: typeof joinRoom,
 *   leaveSession: typeof leaveSession,
 *   resumeMovieVoteSessionIfNeeded: typeof resumeMovieVoteSessionIfNeeded,
 * }}
 */
export function useMovieVoteP2P() {
  const isInSession = computed(() => isMovieVoteP2PSessionActive())
  const isHosting = computed(() => sessionPhase.value === 'hosting')
  const isGuest = computed(() => sessionPhase.value === 'guest_connected')

  return {
    phase: sessionPhase,
    suffix: sessionSuffix,
    isInSession,
    isHosting,
    isGuest,
    remoteHostTabVisible,
    startAsHost,
    joinRoom,
    leaveSession,
    resumeMovieVoteSessionIfNeeded,
  }
}
