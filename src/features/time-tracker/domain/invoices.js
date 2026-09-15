import { isHourlyBillable, isPerJobBillable } from './projects.js'
import { durationMs, recordedEarningsCents } from './timeEntries.js'

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
 * @param {{ elapsedMs?: number, project?: { billable?: boolean, perJobBillable?: boolean, hourlyRateUsd?: number } | null }} input
 * @returns {number | null}
 */
export function sessionAmountCents(input) {
  const project = input?.project
  if (!isHourlyBillable(project)) return null
  const rate = Number(project.hourlyRateUsd)
  if (!Number.isFinite(rate) || rate <= 0) return null
  return lineAmountCents(Math.max(0, Number(input.elapsedMs) || 0), rate)
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
    if (!isHourlyBillable(project)) return false
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
export function paidAmountCents(invoices) {
  return (invoices ?? []).reduce((sum, invoice) => {
    const paid = Math.max(0, Number(invoice.amountPaidCents) || 0)
    const total = Math.max(0, Number(invoice.invoiceTotalCents) || 0)
    return sum + Math.min(paid, total)
  }, 0)
}

/**
 * @param {{
 *   timeEntries?: object[],
 *   projects?: Array<{ id: string, clientId: string | null, billable: boolean, hourlyRateUsd: number }>,
 *   clientId: string,
 * }} input
 */
export function uninvoicedHourlyAmountCents(input) {
  const projects = input.projects ?? []
  const projectById = new Map(projects.map((project) => [project.id, project]))
  return qualifyingTimeEntries(input).reduce((sum, entry) => {
    const project = projectById.get(entry.projectId)
    return sum + lineAmountCents(durationMs(entry), project.hourlyRateUsd)
  }, 0)
}

/**
 * @param {{
 *   timeEntries?: object[],
 *   projects?: object[],
 *   clientId: string,
 * }} input
 */
export function perJobUninvoicedEarningsCents(input) {
  const projectById = new Map((input.projects ?? []).map((project) => [project.id, project]))
  return (input.timeEntries ?? []).reduce((sum, entry) => {
    if (entry.invoiceId) return sum
    const project = projectById.get(entry.projectId)
    if (!isPerJobBillable(project) || project.clientId !== input.clientId) return sum
    return sum + recordedEarningsCents(entry)
  }, 0)
}

/**
 * @param {{ lines?: Array<{ timeEntryId: string, amountCents: number }>, invoiceTotalCents: number, amountPaidCents: number }} invoice
 * @param {string} timeEntryId
 */
export function paidAndUnpaidSliceCentsForEntry(invoice, timeEntryId) {
  const lines = invoice?.lines ?? []
  const line = lines.find((item) => item.timeEntryId === timeEntryId)
  if (!line) {
    return { paidCents: 0, unpaidCents: 0, lineCents: 0 }
  }
  const lineCents = Math.max(0, Number(line.amountCents) || 0)
  const invoiceTotal = Math.max(0, Number(invoice.invoiceTotalCents) || 0)
  const allocablePaid = Math.min(
    Math.max(0, Number(invoice.amountPaidCents) || 0),
    invoiceTotal,
  )
  if (invoiceTotal === 0 || lines.length === 0) {
    return { paidCents: 0, unpaidCents: lineCents, lineCents }
  }

  const slices = lines.map((item) => {
    const cents = Math.max(0, Number(item.amountCents) || 0)
    const exact = (allocablePaid * cents) / invoiceTotal
    const floor = Math.floor(exact)
    return {
      timeEntryId: item.timeEntryId,
      lineCents: cents,
      paidCents: floor,
      remainder: exact - floor,
    }
  })
  let remainderCents = allocablePaid - slices.reduce((sum, item) => sum + item.paidCents, 0)
  const byRemainder = [...slices].sort(
    (left, right) => right.remainder - left.remainder || left.timeEntryId.localeCompare(right.timeEntryId),
  )
  for (let index = 0; remainderCents > 0 && index < byRemainder.length; index += 1) {
    byRemainder[index].paidCents += 1
    remainderCents -= 1
  }

  const target = slices.find((item) => item.timeEntryId === timeEntryId)
  if (!target) {
    return { paidCents: 0, unpaidCents: lineCents, lineCents }
  }
  const matched = byRemainder.find((item) => item.timeEntryId === timeEntryId) || target
  const paidCents = matched.paidCents
  return { paidCents, unpaidCents: lineCents - paidCents, lineCents }
}

/**
 * @param {{
 *   clientId: string,
 *   invoices?: Array<{ clientId: string, invoiceTotalCents: number, amountPaidCents: number }>,
 *   timeEntries?: object[],
 *   projects?: object[],
 * }} input
 */
export function clientMoneySummary(input) {
  const invoices = (input.invoices ?? []).filter((invoice) => invoice.clientId === input.clientId)
  const paidCents = paidAmountCents(invoices)
  const unpaidCents = unpaidBalanceCents(invoices)
  const uninvoicedCents =
    uninvoicedHourlyAmountCents({
      timeEntries: input.timeEntries,
      projects: input.projects,
      clientId: input.clientId,
    }) +
    perJobUninvoicedEarningsCents({
      timeEntries: input.timeEntries,
      projects: input.projects,
      clientId: input.clientId,
    })
  return {
    totalCents: paidCents + unpaidCents + uninvoicedCents,
    paidCents,
    unpaidCents,
    uninvoicedCents,
  }
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
