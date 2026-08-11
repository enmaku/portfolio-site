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
  const quorumRequired = opts.quorumRequired !== false
  return {
    picks: Array.isArray(opts.picks) ? opts.picks : [],
    ready: quorumRequired ? Boolean(opts.ready) : false,
    name: typeof opts.name === 'string' ? opts.name : '',
    quorumRequired,
  }
}

/**
 * @param {import('./types.js').MovieVoteGuestDraft | null | undefined} draft
 * @returns {boolean}
 */
export function isQuorumRequired(draft) {
  return draft?.quorumRequired !== false
}

/**
 * @param {import('./types.js').MovieVoteGuestDraft} draft
 * @param {boolean} required
 * @returns {import('./types.js').MovieVoteGuestDraft}
 */
export function withGuestQuorum(draft, required) {
  const nextRequired = Boolean(required)
  return {
    ...draft,
    quorumRequired: nextRequired,
    ready: nextRequired ? Boolean(draft.ready) : false,
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
  const quorumRequired = isQuorumRequired(base)
  return {
    picks: entry.picks,
    ready: quorumRequired ? Boolean(entry.ready) : false,
    name: base.name,
    quorumRequired,
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
        quorumRequired: isQuorumRequired(g),
        picks: [],
        ready: false,
      }),
    )
  }
}
