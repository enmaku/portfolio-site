/**
 * @param {Date} date
 */
function startOfLocalDay(date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

/**
 * @param {Date} date
 */
function endOfLocalDay(date) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

/**
 * @param {{
 *   preset: 'week' | 'month' | 'year' | 'custom' | 'all',
 *   now?: number,
 *   customStartMs?: number | null,
 *   customEndMs?: number | null,
 * }} input
 */
export function resolveStatisticsPeriod(input) {
  const now = Number(input?.now ?? Date.now())
  const date = new Date(now)
  const preset = input?.preset ?? 'month'

  if (preset === 'all') {
    return { ok: true, startMs: Number.NEGATIVE_INFINITY, endMs: Number.POSITIVE_INFINITY }
  }

  if (preset === 'custom') {
    const customStartMs = input?.customStartMs
    const customEndMs = input?.customEndMs
    if (customStartMs == null || customEndMs == null) {
      return { ok: false }
    }
    const start = startOfLocalDay(new Date(customStartMs))
    const end = endOfLocalDay(new Date(customEndMs))
    if (end.getTime() < start.getTime()) {
      return { ok: false }
    }
    return { ok: true, startMs: start.getTime(), endMs: end.getTime() }
  }

  if (preset === 'week') {
    const day = date.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const start = startOfLocalDay(date)
    start.setDate(start.getDate() + mondayOffset)
    const end = endOfLocalDay(start)
    end.setDate(end.getDate() + 6)
    return { ok: true, startMs: start.getTime(), endMs: end.getTime() }
  }

  if (preset === 'year') {
    const start = new Date(date.getFullYear(), 0, 1)
    const end = endOfLocalDay(new Date(date.getFullYear(), 11, 31))
    return { ok: true, startMs: start.getTime(), endMs: end.getTime() }
  }

  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = endOfLocalDay(new Date(date.getFullYear(), date.getMonth() + 1, 0))
  return { ok: true, startMs: start.getTime(), endMs: end.getTime() }
}
