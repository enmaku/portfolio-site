/**
 * @import './types.js'
 */

/**
 * @param {{
 *   name?: string,
 *   quorumRequired?: boolean,
 *   picks?: import('./types.js').MoviePick[],
 *   ready?: boolean,
 * }} [opts]
 * @returns {import('./types.js').MovieVoteGuestDraft}
 */
export function createGuestDraft(opts = {}) {
  return {
    picks: Array.isArray(opts.picks) ? opts.picks : [],
    ready: Boolean(opts.ready),
    name: typeof opts.name === 'string' ? opts.name : '',
    quorumRequired: true,
  }
}

/**
 * @returns {boolean}
 */
export function isQuorumRequired() {
  return true
}

/**
 * Seat-retention policy for disconnect grace. Required seats stick offline;
 * optional seats may be auto-dropped. Distinct from presence timers.
 *
 * @returns {boolean}
 */
export function retainsSeatWhenOffline() {
  return true
}

/**
 * @param {import('./types.js').MovieVoteGuestDraft} draft
 * @returns {import('./types.js').MovieVoteGuestDraft}
 */
export function withGuestQuorum(draft) {
  return {
    ...draft,
    quorumRequired: true,
  }
}

/**
 * Guest inbox may update picks/ready only. Name and quorum stay host/hello/hydrate-owned.
 *
 * @param {import('./types.js').MovieVoteGuestDraft | null | undefined} prev
 * @param {{ picks: import('./types.js').MoviePick[], ready: boolean }} entry
 * @returns {import('./types.js').MovieVoteGuestDraft}
 */
export function applyGuestInboxUpdate(prev, entry) {
  const base = prev ?? createGuestDraft()
  return {
    picks: entry.picks,
    ready: Boolean(entry.ready),
    name: base.name,
    quorumRequired: true,
  }
}

/**
 * Start-over: drop ready flags and guest movie picks. Name and quorum stay.
 *
 * @param {Map<string, import('./types.js').MovieVoteGuestDraft>} guestDrafts
 */
export function resetGuestDraftsForSuggestRound(guestDrafts) {
  for (const [pid, g] of guestDrafts) {
    guestDrafts.set(
      pid,
      createGuestDraft({
        name: typeof g.name === 'string' ? g.name : '',
        picks: [],
        ready: false,
      }),
    )
  }
}
