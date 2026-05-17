import { DEFAULT_VOTING_METHOD } from './votingMethod.js'

/**
 * Apply RTDB room state to the host store after hydrate (reconnect or fresh claim).
 *
 * @param {{ payload: import('./types.js').MovieVotePublicPayload } | null} parsed
 * @param {{ applyPublicPayload: (p: import('./types.js').MovieVotePublicPayload) => void, votingMethod: string }} store
 */
export function applyHostStoreFromRtdbHydrate(parsed, store) {
  if (parsed) {
    store.applyPublicPayload(parsed.payload)
    return
  }
  store.votingMethod = DEFAULT_VOTING_METHOD
}
