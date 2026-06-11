/**
 * One-time Pinia persist migration: legacy `irvResult` → `electionOutcome`.
 *
 * @param {{ irvResult?: unknown, electionOutcome?: unknown }} store
 * @returns {void}
 */
export function migrateLegacyPersistedElectionOutcome(store) {
  if (store.irvResult != null && store.electionOutcome == null) {
    store.electionOutcome = store.irvResult
    delete store.irvResult
  }
}
