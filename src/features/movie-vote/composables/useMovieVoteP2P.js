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
 * Reactive multiplayer session state (no side-effect watchers — add those once on the page).
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
