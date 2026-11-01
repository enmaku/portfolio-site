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

const DAY_MS = 24 * 60 * 60 * 1000

export const STATISTICS_PERIOD_PRESET_IDS = [
  'day',
  'last24h',
  'week',
  'last7d',
  'month',
  'last30d',
  'year',
  'all',
  'custom',
]

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeStatisticsPreset(value) {
  return STATISTICS_PERIOD_PRESET_IDS.includes(/** @type {string} */ (value))
    ? /** @type {string} */ (value)
    : 'month'
}

/**
 * @param {{
 *   preset: 'day' | 'last24h' | 'week' | 'last7d' | 'month' | 'last30d' | 'year' | 'custom' | 'all',
 *   now?: number,
 *   customStartMs?: number | null,
 *   customEndMs?: number | null,
 *   earliestEntryStartMs?: number | null,
 * }} input
 */
export function resolveStatisticsPeriod(input) {
  const now = Number(input?.now ?? Date.now())
  const date = new Date(now)
  const preset = input?.preset ?? 'month'

  if (preset === 'all') {
    const earliest = input?.earliestEntryStartMs
    if (!Number.isFinite(earliest)) {
      return { ok: true, startMs: Number.NEGATIVE_INFINITY, endMs: Number.POSITIVE_INFINITY }
    }
    return { ok: true, startMs: Number(earliest), endMs: now }
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

  if (preset === 'day') {
    const start = startOfLocalDay(date)
    return { ok: true, startMs: start.getTime(), endMs: endOfLocalDay(start).getTime() }
  }

  if (preset === 'last24h') {
    return { ok: true, startMs: now - DAY_MS, endMs: now }
  }

  if (preset === 'last7d' || preset === 'last30d') {
    const days = preset === 'last7d' ? 7 : 30
    const start = startOfLocalDay(date)
    start.setDate(start.getDate() - (days - 1))
    return { ok: true, startMs: start.getTime(), endMs: endOfLocalDay(date).getTime() }
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

/**
 * Subdivision a fixed preset always uses, or `null` when the span decides.
 *
 * @param {string} preset
 * @returns {'hour' | 'day' | 'month' | 'year' | null}
 */
export function fixedBucketUnitForPreset(preset) {
  if (preset === 'day' || preset === 'last24h') return 'hour'
  if (preset === 'week' || preset === 'last7d' || preset === 'month' || preset === 'last30d') {
    return 'day'
  }
  if (preset === 'year') return 'month'
  return null
}
