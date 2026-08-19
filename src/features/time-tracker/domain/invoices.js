import { durationMs } from './timeEntries.js'

export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
}

const MS_PER_HOUR = 3_600_000

/**
 * @param {number} durationMsValue
 * @param {number} hourlyRateUsd
 * @returns {number}
 */
export function lineAmountCents(durationMsValue, hourlyRateUsd) {
  return Math.round((durationMsValue / MS_PER_HOUR) * hourlyRateUsd * 100)
}

/**
 * @param {number} lastNumber
 * @returns {number}
 */
export function nextInvoiceNumber(lastNumber) {
  return (Number(lastNumber) || 0) + 1
}

/**
 * @param {{
 *   timeEntries: Array<{ id: string, projectId: string, startedAt: number, endedAt: number, invoiceId?: string | null }>,
 *   projects: Array<{ id: string, clientId: string | null, billable: boolean }>,
 *   clientId: string,
 *   range?: { start?: number, end?: number } | null,
 * }} input
 */
export function qualifyingTimeEntries(input) {
  const projectById = new Map((input.projects ?? []).map((project) => [project.id, project]))
  return (input.timeEntries ?? []).filter((entry) => {
    if (entry.invoiceId) return false
    const project = projectById.get(entry.projectId)
    if (!project?.billable) return false
    if (project.clientId !== input.clientId) return false
    if (input.range?.start != null && entry.startedAt < input.range.start) return false
    if (input.range?.end != null && entry.startedAt > input.range.end) return false
    return true
  })
}

/**
 * @param {{
 *   timeEntries: object[],
 *   projects: Array<{ id: string, clientId: string | null, billable: boolean, hourlyRateUsd: number }>,
 *   clientId: string,
 *   range?: { start?: number, end?: number } | null,
 *   issuedAt: number,
 *   issuerName?: string,
 * }} input
 */
export function previewInvoice(input) {
  const qualifying = qualifyingTimeEntries(input)
  if (qualifying.length === 0) {
    throw new Error('No qualifying time entries for invoice generation')
  }
  const projectById = new Map(input.projects.map((project) => [project.id, project]))
  const lines = qualifying.map((entry) => {
    const project = projectById.get(entry.projectId)
    const duration = durationMs(entry)
    return {
      timeEntryId: entry.id,
      projectId: entry.projectId,
      projectName: project.name,
      durationMs: duration,
      hourlyRateUsd: project.hourlyRateUsd,
      amountCents: lineAmountCents(duration, project.hourlyRateUsd),
      description: entry.description || '',
    }
  })
  return {
    clientId: input.clientId,
    issuedAt: input.issuedAt,
    issuerName: String(input.issuerName || ''),
    lines,
    invoiceTotalCents: lines.reduce((sum, line) => sum + line.amountCents, 0),
    totalDurationMs: lines.reduce((sum, line) => sum + line.durationMs, 0),
  }
}

/**
 * @param {{ preview: object, invoiceId: string, invoiceNumber: number }} input
 */
export function confirmInvoice(input) {
  const preview = input.preview
  return {
    id: input.invoiceId,
    clientId: preview.clientId,
    invoiceNumber: input.invoiceNumber,
    issuedAt: preview.issuedAt,
    issuerName: preview.issuerName || '',
    lines: preview.lines,
    invoiceTotalCents: preview.invoiceTotalCents,
    totalDurationMs: preview.totalDurationMs,
    amountPaidCents: 0,
    linkSecret: null,
  }
}

/**
 * @param {Array<{ id: string, invoiceId: string | null }>} timeEntries
 * @param {string} invoiceId
 * @param {string[]} timeEntryIds
 */
export function attachInvoiceToTimeEntries(timeEntries, invoiceId, timeEntryIds) {
  const idSet = new Set(timeEntryIds)
  return timeEntries.map((entry) => (idSet.has(entry.id) ? { ...entry, invoiceId } : entry))
}

/**
 * @param {{ invoiceTotalCents: number, amountPaidCents: number }} invoice
 */
export function paymentStatus(invoice) {
  const paid = Number(invoice.amountPaidCents) || 0
  const total = Number(invoice.invoiceTotalCents) || 0
  if (paid <= 0) return PAYMENT_STATUS.UNPAID
  if (paid >= total) return PAYMENT_STATUS.PAID
  return PAYMENT_STATUS.PARTIAL
}

/**
 * @param {object} invoice
 * @param {number} amountPaidCents
 */
export function setAmountPaid(invoice, amountPaidCents) {
  const next = Math.max(0, Number(amountPaidCents) || 0)
  return { ...invoice, amountPaidCents: next }
}

/**
 * @param {Array<{ invoiceTotalCents: number, amountPaidCents: number }>} invoices
 */
export function unpaidBalanceCents(invoices) {
  return (invoices ?? []).reduce((sum, invoice) => {
    if (paymentStatus(invoice) === PAYMENT_STATUS.PAID) return sum
    return sum + Math.max(0, invoice.invoiceTotalCents - (invoice.amountPaidCents || 0))
  }, 0)
}

/**
 * @param {Array<{ invoiceTotalCents: number, amountPaidCents: number }>} invoices
 */
export function payAllInvoices(invoices) {
  return invoices.map((invoice) =>
    paymentStatus(invoice) === PAYMENT_STATUS.PAID
      ? invoice
      : { ...invoice, amountPaidCents: invoice.invoiceTotalCents },
  )
}

/**
 * @param {{ amountPaidCents: number }} invoice
 */
export function canDeleteInvoice(invoice) {
  return paymentStatus(invoice) === PAYMENT_STATUS.UNPAID
}

/**
 * @param {Array<{ invoiceId: string | null }>} timeEntries
 * @param {string} invoiceId
 */
export function releaseTimeEntries(timeEntries, invoiceId) {
  return timeEntries.map((entry) =>
    entry.invoiceId === invoiceId ? { ...entry, invoiceId: null } : entry,
  )
}
