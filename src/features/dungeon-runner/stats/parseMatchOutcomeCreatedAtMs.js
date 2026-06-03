/**
 * @param {unknown} createdAt
 * @returns {number | null}
 */
export function parseMatchOutcomeCreatedAtMs(createdAt) {
  if (typeof createdAt === 'string' && createdAt.length > 0) {
    const parsed = Date.parse(createdAt)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (createdAt && typeof createdAt === 'object') {
    const seconds = createdAt.seconds
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      const nanos = typeof createdAt.nanoseconds === 'number' ? createdAt.nanoseconds : 0
      return seconds * 1000 + Math.floor(nanos / 1e6)
    }
    if (typeof createdAt.toDate === 'function') {
      const date = createdAt.toDate()
      const ms = date?.getTime?.()
      return Number.isFinite(ms) ? ms : null
    }
  }
  return null
}
