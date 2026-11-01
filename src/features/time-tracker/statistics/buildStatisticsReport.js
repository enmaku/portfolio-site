import {
  lineAmountCents,
  paidAndUnpaidSliceCentsForEntry,
} from '../domain/invoices.js'
import { isHourlyBillable, isPerJobBillable } from '../domain/projects.js'
import { durationMs, recordedEarningsCents } from '../domain/timeEntries.js'
import { buildBuckets, chooseBucketUnit, quantizeBucketKey } from './statisticsBucketization.js'
import { MAX_STACKED_SERIES } from './statsChartColors.js'

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
 *   bucketUnit?: 'hour' | 'day' | 'month' | 'year',
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
  /** @type {{ projectId: string, startedAt: number, incomeCents: number }[]} */
  const inRangeEntries = []

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
    inRangeEntries.push({ projectId: entry.projectId, startedAt: entry.startedAt, incomeCents })

    const clientId = project?.clientId ? String(project.clientId) : null
    accumulateBucket(clientBuckets, clientId, hoursMs, incomeCents)
    accumulateBucket(projectBuckets, entry.projectId, hoursMs, incomeCents)
  }

  const showClientBreakdown = (input.clients ?? []).length > 0
  const projectRows = rowsFromBuckets(projectBuckets)

  return {
    totalHoursMs,
    totalIncomeCents,
    dollarsPerHour: statisticsDollarsPerHour(totalIncomeCents, totalHoursMs),
    showClientBreakdown,
    clientRows: showClientBreakdown ? rowsFromBuckets(clientBuckets) : [],
    projectRows,
    bucketSeries: buildBucketSeries({
      range: input.range,
      bucketUnit: input.bucketUnit,
      projectRows,
      projectById,
      inRangeEntries,
    }),
  }
}

/**
 * @param {Map<string, { hoursMs: number, incomeCents: number }>} buckets
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
 * @param {{
 *   range: { startMs: number, endMs: number },
 *   bucketUnit?: 'hour' | 'day' | 'month' | 'year',
 *   projectRows: { id: string }[],
 *   projectById: Map<string, object>,
 *   inRangeEntries: { projectId: string, startedAt: number, incomeCents: number }[],
 * }} input
 */
function buildBucketSeries(input) {
  const { startMs, endMs } = input.range
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    return {
      unit: 'day',
      labels: [],
      titles: [],
      bucketStartMs: [],
      series: [],
      otherValuesCents: [],
    }
  }

  const unit = input.bucketUnit ?? chooseBucketUnit(input.range)
  const buckets = buildBuckets({ startMs, endMs, unit })
  const indexByKey = new Map(buckets.keys.map((key, index) => [key, index]))

  const stackedRows = input.projectRows.slice(0, MAX_STACKED_SERIES)
  const foldedIds = new Set(input.projectRows.slice(MAX_STACKED_SERIES).map((row) => row.id))

  const series = stackedRows.map((row) => ({
    projectId: row.id,
    label: input.projectById.get(row.id)?.name || row.id,
    valuesCents: new Array(buckets.keys.length).fill(0),
  }))
  const seriesByProjectId = new Map(series.map((item) => [item.projectId, item]))
  const otherValuesCents = new Array(buckets.keys.length).fill(0)

  for (const entry of input.inRangeEntries) {
    if (!entry.incomeCents) continue
    const index = indexByKey.get(quantizeBucketKey(entry.startedAt, unit))
    if (index == null) continue
    if (foldedIds.has(entry.projectId)) {
      otherValuesCents[index] += entry.incomeCents
      continue
    }
    const target = seriesByProjectId.get(entry.projectId)
    if (target) target.valuesCents[index] += entry.incomeCents
  }

  return {
    unit,
    labels: buckets.labels,
    titles: buckets.titles,
    bucketStartMs: buckets.bucketStartMs,
    series,
    otherValuesCents,
  }
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
