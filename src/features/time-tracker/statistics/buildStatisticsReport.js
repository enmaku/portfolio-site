import {
  lineAmountCents,
  paidAndUnpaidSliceCentsForEntry,
} from '../domain/invoices.js'
import { isHourlyBillable, isPerJobBillable } from '../domain/projects.js'
import { durationMs, recordedEarningsCents } from '../domain/timeEntries.js'

/**
 * @param {number} incomeCents
 * @param {number} hoursMs
 * @returns {number | null}
 */
export function statisticsDollarsPerHour(incomeCents, hoursMs) {
  if (!(hoursMs > 0)) return null
  return (incomeCents / 100) / (hoursMs / 3_600_000)
}

/**
 * @param {number} startedAt
 * @param {{ startMs: number, endMs: number }} range
 */
function entryInRange(startedAt, range) {
  return startedAt >= range.startMs && startedAt <= range.endMs
}

/**
 * @param {{
 *   timeEntries: object[],
 *   projects: object[],
 *   clients: object[],
 *   invoices: object[],
 *   range: { startMs: number, endMs: number },
 *   includeUnpaidInvoices?: boolean,
 *   includeUninvoiced?: boolean,
 * }} input
 */
export function buildStatisticsReport(input) {
  const projectById = new Map((input.projects ?? []).map((project) => [project.id, project]))
  const invoiceById = new Map((input.invoices ?? []).map((invoice) => [invoice.id, invoice]))
  const includeUnpaidInvoices = input.includeUnpaidInvoices === true
  const includeUninvoiced = includeUnpaidInvoices && input.includeUninvoiced === true

  /** @type {Map<string | null, { hoursMs: number, incomeCents: number }>} */
  const clientBuckets = new Map()
  /** @type {Map<string, { hoursMs: number, incomeCents: number }>} */
  const projectBuckets = new Map()

  let totalHoursMs = 0
  let totalIncomeCents = 0

  for (const entry of input.timeEntries ?? []) {
    if (!entryInRange(entry.startedAt, input.range)) continue
    const project = projectById.get(entry.projectId)
    const hoursMs = durationMs(entry)
    const incomeCents = incomeForEntry(entry, project, invoiceById, {
      includeUnpaidInvoices,
      includeUninvoiced,
    })

    totalHoursMs += hoursMs
    totalIncomeCents += incomeCents

    const clientId = project?.clientId ? String(project.clientId) : null
    accumulateBucket(clientBuckets, clientId, hoursMs, incomeCents)
    accumulateBucket(projectBuckets, entry.projectId, hoursMs, incomeCents)
  }

  const showClientBreakdown = (input.clients ?? []).length > 0
  return {
    totalHoursMs,
    totalIncomeCents,
    dollarsPerHour: statisticsDollarsPerHour(totalIncomeCents, totalHoursMs),
    showClientBreakdown,
    clientRows: showClientBreakdown ? rowsFromBuckets(clientBuckets) : [],
    projectRows: rowsFromBuckets(projectBuckets),
  }
}

/**
 * @param {Map<string | null, { hoursMs: number, incomeCents: number }>} buckets
 */
function rowsFromBuckets(buckets) {
  return [...buckets.entries()]
    .map(([id, bucket]) => ({
      id,
      hoursMs: bucket.hoursMs,
      incomeCents: bucket.incomeCents,
      dollarsPerHour: statisticsDollarsPerHour(bucket.incomeCents, bucket.hoursMs),
    }))
    .sort((left, right) => right.hoursMs - left.hoursMs || String(left.id).localeCompare(String(right.id)))
}

/**
 * @param {Map<string | null, { hoursMs: number, incomeCents: number }>} buckets
 * @param {string | null} id
 */
function accumulateBucket(buckets, id, hoursMs, incomeCents) {
  const current = buckets.get(id) ?? { hoursMs: 0, incomeCents: 0 }
  buckets.set(id, {
    hoursMs: current.hoursMs + hoursMs,
    incomeCents: current.incomeCents + incomeCents,
  })
}

/**
 * @param {object} entry
 * @param {object | undefined} project
 * @param {Map<string, object>} invoiceById
 * @param {{ includeUnpaidInvoices: boolean, includeUninvoiced: boolean }} options
 */
function incomeForEntry(entry, project, invoiceById, options) {
  if (!project) return 0
  if (isPerJobBillable(project)) {
    return recordedEarningsCents(entry)
  }
  if (!isHourlyBillable(project)) {
    return 0
  }
  if (entry.invoiceId) {
    const invoice = invoiceById.get(entry.invoiceId)
    const { paidCents, unpaidCents } = paidAndUnpaidSliceCentsForEntry(invoice, entry.id)
    return paidCents + (options.includeUnpaidInvoices ? unpaidCents : 0)
  }
  if (options.includeUninvoiced) {
    return lineAmountCents(durationMs(entry), project.hourlyRateUsd)
  }
  return 0
}
