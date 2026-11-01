export const BUCKET_UNITS = /** @type {const} */ (['hour', 'day', 'month', 'year'])

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000
const SIXTY_TWO_DAYS_MS = 62 * 24 * 60 * 60 * 1000
const TWENTY_FOUR_MONTHS_MS = 24 * 30.44 * 24 * 60 * 60 * 1000

const axisHour = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: true })
const axisDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const axisMonth = new Intl.DateTimeFormat('en-US', { month: 'short' })
const axisMonthWithYear = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })
const axisYear = new Intl.DateTimeFormat('en-US', { year: 'numeric' })

const titleHour = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  hour12: true,
})
const titleDay = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const titleMonth = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })
const titleYear = new Intl.DateTimeFormat('en-US', { year: 'numeric' })

/**
 * @param {{ startMs: number, endMs: number }} range
 * @returns {'hour' | 'day' | 'month' | 'year'}
 */
export function chooseBucketUnit({ startMs, endMs }) {
  const span = Math.max(0, endMs - startMs)
  if (span <= TWO_DAYS_MS) return 'hour'
  if (span <= SIXTY_TWO_DAYS_MS) return 'day'
  if (span <= TWENTY_FOUR_MONTHS_MS) return 'month'
  return 'year'
}

/**
 * Clock-aligned start of the bucket containing `ms`, in the device local timezone.
 *
 * @param {number} ms
 * @param {'hour' | 'day' | 'month' | 'year'} unit
 * @returns {number}
 */
export function quantizeBucketKey(ms, unit) {
  const date = new Date(ms)
  if (unit === 'hour') {
    date.setMinutes(0, 0, 0)
  } else if (unit === 'day') {
    date.setHours(0, 0, 0, 0)
  } else if (unit === 'month') {
    date.setDate(1)
    date.setHours(0, 0, 0, 0)
  } else {
    date.setMonth(0, 1)
    date.setHours(0, 0, 0, 0)
  }
  return date.getTime()
}

/**
 * @param {Date} date
 * @param {'hour' | 'day' | 'month' | 'year'} unit
 */
function stepKey(date, unit) {
  if (unit === 'hour') date.setHours(date.getHours() + 1)
  else if (unit === 'day') date.setDate(date.getDate() + 1)
  else if (unit === 'month') date.setMonth(date.getMonth() + 1)
  else date.setFullYear(date.getFullYear() + 1)
}

/**
 * @param {number} ms
 * @param {'hour' | 'day' | 'month' | 'year'} unit
 */
function axisLabel(ms, unit) {
  const date = new Date(ms)
  if (unit === 'hour') return axisHour.format(date)
  if (unit === 'day') return axisDay.format(date)
  if (unit === 'month') {
    return date.getMonth() === 0 ? axisMonthWithYear.format(date) : axisMonth.format(date)
  }
  return axisYear.format(date)
}

/**
 * @param {number} ms
 * @param {'hour' | 'day' | 'month' | 'year'} unit
 */
function titleLabel(ms, unit) {
  const date = new Date(ms)
  if (unit === 'hour') return titleHour.format(date)
  if (unit === 'day') return titleDay.format(date)
  if (unit === 'month') return titleMonth.format(date)
  return titleYear.format(date)
}

/**
 * Buckets clipping to the range's real bounds — never padded outside it.
 *
 * @param {{
 *   startMs: number,
 *   endMs: number,
 *   unit: 'hour' | 'day' | 'month' | 'year',
 * }} input
 * @returns {{ unit: string, keys: number[], bucketStartMs: number[], labels: string[], titles: string[] }}
 */
export function buildBuckets({ startMs, endMs, unit }) {
  const keys = []
  const bucketStartMs = []
  const cursor = new Date(quantizeBucketKey(startMs, unit))
  let key = cursor.getTime()
  while (key <= endMs) {
    keys.push(key)
    bucketStartMs.push(Math.max(key, startMs))
    stepKey(cursor, unit)
    key = cursor.getTime()
  }
  return {
    unit,
    keys,
    bucketStartMs,
    labels: keys.map((value) => axisLabel(value, unit)),
    titles: keys.map((value) => titleLabel(value, unit)),
  }
}
