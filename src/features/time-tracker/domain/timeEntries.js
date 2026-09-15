import { isPerJobBillable } from './projects.js'

/**
 * @typedef {{
 *   id: string,
 *   projectId: string,
 *   startedAt: number,
 *   endedAt: number,
 *   description: string,
 *   earningsUsdCents: number | null,
 *   invoiceId: string | null,
 * }} TimeEntry
 */

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function normalizeEarningsUsdCents(value) {
  if (value === null || value === undefined || value === '') return null
  const cents = Number(value)
  if (!Number.isFinite(cents)) {
    throw new Error('Earnings must be a valid amount')
  }
  if (cents < 0) {
    throw new Error('Earnings cannot be negative')
  }
  return Math.round(cents)
}

/**
 * @param {{ earningsUsdCents?: number | null }} entry
 * @returns {number}
 */
export function recordedEarningsCents(entry) {
  if (entry?.earningsUsdCents == null) return 0
  return entry.earningsUsdCents
}

/**
 * @param {{ project: object, requested?: number | null }} input
 * @returns {number | null}
 */
export function earningsUsdCentsForSave({ project, requested }) {
  if (!isPerJobBillable(project)) return null
  if (requested === undefined) return null
  return normalizeEarningsUsdCents(requested)
}

/**
 * @param {{
 *   fromProject: object,
 *   toProject: object,
 *   previous?: number | null,
 *   requested?: number | null,
 * }} input
 * @returns {number | null}
 */
export function earningsUsdCentsForProjectReassign(input) {
  if (!isPerJobBillable(input.toProject)) return null
  if (input.requested !== undefined) return normalizeEarningsUsdCents(input.requested)
  if (isPerJobBillable(input.fromProject)) return input.previous ?? null
  return null
}

/**
 * @param {Pick<TimeEntry, 'startedAt' | 'endedAt'>} entry
 * @returns {number}
 */
export function durationMs(entry) {
  return entry.endedAt - entry.startedAt
}

/**
 * @param {Pick<TimeEntry, 'invoiceId'>} entry
 */
export function isTimeEntryMutable(entry) {
  return !entry?.invoiceId
}

/**
 * @param {Pick<TimeEntry, 'invoiceId'>} entry
 */
export function assertTimeEntryMutable(entry) {
  if (!isTimeEntryMutable(entry)) {
    throw new Error('Time entries on an invoice cannot be edited or deleted')
  }
}

/**
 * @param {{
 *   id: string,
 *   projectId: string,
 *   startedAt: number,
 *   endedAt: number,
 *   description?: string,
 *   earningsUsdCents?: number | null,
 *   invoiceId?: string | null,
 * }} input
 * @returns {TimeEntry}
 */
export function createTimeEntry(input) {
  const id = String(input?.id || '').trim()
  const projectId = String(input?.projectId || '').trim()
  if (!id) throw new Error('Time entry id is required')
  if (!projectId) throw new Error('Time entry project is required')
  if (typeof input.startedAt !== 'number' || typeof input.endedAt !== 'number') {
    throw new Error('Time entry start and end are required')
  }
  if (!(input.startedAt < input.endedAt)) {
    throw new Error('Start must be before end')
  }
  const earningsUsdCents =
    input.earningsUsdCents === undefined
      ? null
      : normalizeEarningsUsdCents(input.earningsUsdCents)

  return {
    id,
    projectId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    description: String(input.description || ''),
    earningsUsdCents,
    invoiceId: input.invoiceId ? String(input.invoiceId) : null,
  }
}

/**
 * @param {unknown} raw
 * @returns {TimeEntry}
 */
export function normalizeTimeEntry(raw) {
  return createTimeEntry({
    id: String(raw?.id || ''),
    projectId: String(raw?.projectId || ''),
    startedAt: Number(raw?.startedAt),
    endedAt: Number(raw?.endedAt),
    description: String(raw?.description || ''),
    earningsUsdCents:
      raw?.earningsUsdCents === undefined || raw?.earningsUsdCents === null
        ? null
        : normalizeEarningsUsdCents(raw.earningsUsdCents),
    invoiceId: raw?.invoiceId ? String(raw.invoiceId) : null,
  })
}
