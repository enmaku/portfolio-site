/**
 * @typedef {{
 *   id: string,
 *   projectId: string,
 *   startedAt: number,
 *   endedAt: number,
 *   description: string,
 *   invoiceId: string | null,
 * }} TimeEntry
 */

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
  return {
    id,
    projectId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    description: String(input.description || ''),
    invoiceId: input.invoiceId ? String(input.invoiceId) : null,
  }
}
