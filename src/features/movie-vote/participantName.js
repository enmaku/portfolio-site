/**
 * @param {unknown} raw
 * @returns {string} Trimmed spelling for display, or '' if empty after trim.
 */
export function normalizeParticipantName(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

/**
 * Case-insensitive uniqueness key for a participant name.
 * @param {unknown} raw
 * @returns {string}
 */
export function participantNameKey(raw) {
  return normalizeParticipantName(raw).toLowerCase()
}

/**
 * @param {string} candidate Display spelling (will be normalized for compare)
 * @param {Iterable<{ name?: string }>} seats Current seats with display names
 * @param {{ excludeId?: string }} [opts]
 * @returns {boolean}
 */
export function isParticipantNameTaken(candidate, seats, opts = {}) {
  const key = participantNameKey(candidate)
  if (!key) return false
  const excludeId = opts.excludeId
  for (const seat of seats) {
    if (excludeId != null && seat && 'id' in seat && seat.id === excludeId) continue
    if (participantNameKey(seat?.name) === key) return true
  }
  return false
}
