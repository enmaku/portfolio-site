export function formatUsd(amount) {
  return `$${Number(amount).toFixed(2)}`
}

export function formatUsdFromCents(cents) {
  return formatUsd(Number(cents) / 100)
}

export function formatDurationMs(ms) {
  const totalSec = Math.max(0, Math.floor(Number(ms) / 1000))
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const LOCAL_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/**
 * @param {number} ms
 * @returns {string}
 */
export function toLocalDateTimeInput(ms) {
  const date = new Date(ms)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function parseLocalDateTimeInput(value) {
  const match = String(value || '').match(LOCAL_DATE_TIME_RE)
  if (!match) return Number.NaN
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  ).getTime()
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatLocalDateTimeLabel(value) {
  const ms = parseLocalDateTimeInput(value)
  if (!Number.isFinite(ms)) return ''
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(ms))
}
