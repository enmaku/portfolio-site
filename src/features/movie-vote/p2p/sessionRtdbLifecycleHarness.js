/**
 * Movie Vote RTDB lifecycle harness — thin wrapper over shared star-room test mocks.
 * Requires `node --experimental-test-module-mocks`.
 *
 * ## Module hygiene
 *
 * - Prefer {@link importMovieVoteSession} with a unique nonce per test so each case gets a fresh
 *   `session.js` instance (isolated maps, seq counters, and listener registrations).
 * - When reusing one session module (e.g. static `import('./session.js')`), call
 *   `teardownSession()` then reset helpers from `session.testExports.js` in `afterEach`.
 * - Use {@link createRtdbLifecycleAfterEach} for standard mock/timer cleanup after each case.
 */

export {
  createRtdbLifecycleAfterEach,
  installRtdbLifecycleMocks,
  refPath,
  withFirebaseEnv,
} from '../../p2p/test/rtdbLifecycleHarness.js'

/** @param {string} nonce */
export async function importMovieVoteSession(nonce) {
  return import(`./session.js?mv-rtdb-lifecycle=${nonce}`)
}
