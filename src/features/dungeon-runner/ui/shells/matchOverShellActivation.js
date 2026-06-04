/**
 * Side effects when the match-over shell becomes active (replay + outcome upload).
 *
 * @param {{
 *   match: import('../../engine/kernel.js').Match | null | undefined
 *   uploadTracker: { maybeUpload: (match: unknown) => void } | null | undefined
 * }} inputs
 */
export function runMatchOverShellActivation({ match, uploadTracker }) {
  uploadTracker?.maybeUpload(match ?? null)
}
