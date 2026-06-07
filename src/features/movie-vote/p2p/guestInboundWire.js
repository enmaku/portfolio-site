import { useMovieVoteStore } from '../../../stores/movieVote.js'
import {
  isHostEndedNotice,
  isHostPing,
  parseHostVisibility,
  parseState,
  parseWelcome,
} from './protocol.js'

/**
 * @param {object} deps
 * @param {import('vue').Ref<boolean>} deps.remoteHostTabVisible
 * @param {() => number} deps.getLastSeenSeq
 * @param {(n: number) => void} deps.setLastSeenSeq
 * @param {(payload: import('../types.js').MovieVotePublicPayload) => void} deps.applyPublicPayload
 * @param {() => void} deps.onGuestHostEnded
 */
export function createGuestInboundWire(deps) {
  /**
   * @param {unknown} raw
   */
  function handleGuestWelcome(raw) {
    const welcome = parseWelcome(raw)
    if (!welcome) return
    useMovieVoteStore().setMyParticipantId(welcome.participantId)
  }

  /**
   * @param {unknown} raw
   */
  function handleGuestState(raw) {
    const st = parseState(raw)
    if (!st) return
    if (st.seq <= deps.getLastSeenSeq()) return
    deps.setLastSeenSeq(st.seq)
    try {
      deps.applyPublicPayload(st.payload)
    } catch {
      return
    }
  }

  /**
   * @param {unknown} raw
   */
  function handleGuestInbound(raw) {
    if (isHostEndedNotice(raw)) {
      deps.onGuestHostEnded()
      return
    }
    if (isHostPing(raw)) {
      return
    }
    const vis = parseHostVisibility(raw)
    if (vis) {
      deps.remoteHostTabVisible.value = vis.visible
      return
    }
    if (parseWelcome(raw)) {
      handleGuestWelcome(raw)
      return
    }
    handleGuestState(raw)
  }

  return { handleGuestWelcome, handleGuestState, handleGuestInbound }
}
