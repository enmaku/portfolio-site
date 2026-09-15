import assert from 'node:assert/strict'
import test from 'node:test'
import { confirmInvoice, nextInvoiceNumber, previewInvoice } from '../domain/invoices.js'
import { createProject, setProjectBillable } from '../domain/projects.js'
import { createTimeEntry } from '../domain/timeEntries.js'
import { buildStatisticsReport } from './buildStatisticsReport.js'

const range = { startMs: 0, endMs: 10_000_000 }

function hourlyProject(id, clientId, rate) {
  return setProjectBillable({ ...createProject({ id, name: id }), clientId }, {
    billable: true,
    hourlyRateUsd: rate,
  })
}

function perJobProject(id, clientId) {
  return setProjectBillable({ ...createProject({ id, name: id }), clientId }, {
    billable: true,
    perJobBillable: true,
  })
}

function invoicedEntry({ id, projectId, invoice }) {
  return createTimeEntry({
    id,
    projectId,
    startedAt: 1_000,
    endedAt: 3_601_000,
    invoiceId: invoice.id,
  })
}

test('empty report returns zeros and null dollars per hour', () => {
  const report = buildStatisticsReport({
    timeEntries: [],
    projects: [],
    clients: [],
    invoices: [],
    range,
  })
  assert.equal(report.totalHoursMs, 0)
  assert.equal(report.totalIncomeCents, 0)
  assert.equal(report.dollarsPerHour, null)
  assert.deepEqual(report.projectRows, [])
})

test('hours include non-billable work while income stays zero', () => {
  const project = createProject({ id: 'p1', name: 'p1' })
  const report = buildStatisticsReport({
    timeEntries: [
      createTimeEntry({ id: 'e1', projectId: 'p1', startedAt: 0, endedAt: 3_600_000 }),
    ],
    projects: [project],
    clients: [],
    invoices: [],
    range,
  })
  assert.equal(report.totalHoursMs, 3_600_000)
  assert.equal(report.totalIncomeCents, 0)
})

test('per-job blank earnings count hours but not income', () => {
  const project = perJobProject('p1', 'c1')
  const report = buildStatisticsReport({
    timeEntries: [
      createTimeEntry({
        id: 'e1',
        projectId: 'p1',
        startedAt: 0,
        endedAt: 3_600_000,
        earningsUsdCents: null,
      }),
    ],
    projects: [project],
    clients: [{ id: 'c1', name: 'Acme' }],
    invoices: [],
    range,
  })
  assert.equal(report.totalHoursMs, 3_600_000)
  assert.equal(report.totalIncomeCents, 0)
  assert.equal(report.dollarsPerHour, 0)
})

test('per-job recorded earnings are always included', () => {
  const project = perJobProject('p1', 'c1')
  const report = buildStatisticsReport({
    timeEntries: [
      createTimeEntry({
        id: 'e1',
        projectId: 'p1',
        startedAt: 0,
        endedAt: 3_600_000,
        earningsUsdCents: 5_000,
      }),
    ],
    projects: [project],
    clients: [{ id: 'c1', name: 'Acme' }],
    invoices: [],
    range,
    includeUnpaidInvoices: false,
    includeUninvoiced: true,
  })
  assert.equal(report.totalIncomeCents, 5_000)
  assert.equal(report.dollarsPerHour, 50)
})

test('hourly invoiced income uses paid slice only by default', () => {
  const project = hourlyProject('p1', 'c1', 100)
  const entry = createTimeEntry({ id: 'e1', projectId: 'p1', startedAt: 0, endedAt: 3_600_000 })
  const preview = previewInvoice({
    timeEntries: [entry],
    projects: [project],
    clientId: 'c1',
    issuedAt: 1,
  })
  const invoice = {
    ...confirmInvoice({ preview, invoiceId: 'inv1', invoiceNumber: nextInvoiceNumber(0) }),
    amountPaidCents: 4_000,
  }
  const locked = invoicedEntry({ id: 'e1', projectId: 'p1', invoice })
  const report = buildStatisticsReport({
    timeEntries: [locked],
    projects: [project],
    clients: [{ id: 'c1', name: 'Acme' }],
    invoices: [invoice],
    range,
  })
  assert.equal(report.totalIncomeCents, 4_000)
})

test('unpaid toggle includes unpaid invoice lines', () => {
  const project = hourlyProject('p1', 'c1', 100)
  const entry = createTimeEntry({ id: 'e1', projectId: 'p1', startedAt: 0, endedAt: 3_600_000 })
  const preview = previewInvoice({
    timeEntries: [entry],
    projects: [project],
    clientId: 'c1',
    issuedAt: 1,
  })
  const invoice = {
    ...confirmInvoice({ preview, invoiceId: 'inv1', invoiceNumber: nextInvoiceNumber(0) }),
    amountPaidCents: 0,
  }
  const locked = invoicedEntry({ id: 'e1', projectId: 'p1', invoice })
  const report = buildStatisticsReport({
    timeEntries: [locked],
    projects: [project],
    clients: [{ id: 'c1', name: 'Acme' }],
    invoices: [invoice],
    range,
    includeUnpaidInvoices: true,
  })
  assert.equal(report.totalIncomeCents, 10_000)
})

test('uninvoiced hourly income requires both toggles', () => {
  const project = hourlyProject('p1', null, 100)
  const entry = createTimeEntry({ id: 'e1', projectId: 'p1', startedAt: 0, endedAt: 3_600_000 })
  const withBoth = buildStatisticsReport({
    timeEntries: [entry],
    projects: [project],
    clients: [],
    invoices: [],
    range,
    includeUnpaidInvoices: true,
    includeUninvoiced: true,
  })
  assert.equal(withBoth.totalIncomeCents, 10_000)
  const parentOnly = buildStatisticsReport({
    timeEntries: [entry],
    projects: [project],
    clients: [],
    invoices: [],
    range,
    includeUnpaidInvoices: true,
    includeUninvoiced: false,
  })
  assert.equal(parentOnly.totalIncomeCents, 0)
})

test('entry counts by startedAt and uses full duration', () => {
  const project = perJobProject('p1', null)
  const report = buildStatisticsReport({
    timeEntries: [
      createTimeEntry({
        id: 'e1',
        projectId: 'p1',
        startedAt: 5_000,
        endedAt: 20_000_000,
        earningsUsdCents: 100,
      }),
    ],
    projects: [project],
    clients: [],
    invoices: [],
    range,
  })
  assert.equal(report.totalHoursMs, 20_000_000 - 5_000)
})

test('client breakdown hides without clients and buckets unassigned work', () => {
  const assigned = perJobProject('p1', 'c1')
  const unassigned = perJobProject('p2', null)
  const withoutClients = buildStatisticsReport({
    timeEntries: [
      createTimeEntry({
        id: 'e1',
        projectId: 'p2',
        startedAt: 0,
        endedAt: 3_600_000,
        earningsUsdCents: 100,
      }),
    ],
    projects: [unassigned],
    clients: [],
    invoices: [],
    range,
  })
  assert.equal(withoutClients.showClientBreakdown, false)
  assert.deepEqual(withoutClients.clientRows, [])

  const withClients = buildStatisticsReport({
    timeEntries: [
      createTimeEntry({
        id: 'e1',
        projectId: 'p1',
        startedAt: 0,
        endedAt: 3_600_000,
        earningsUsdCents: 200,
      }),
      createTimeEntry({
        id: 'e2',
        projectId: 'p2',
        startedAt: 0,
        endedAt: 1_800_000,
        earningsUsdCents: 100,
      }),
    ],
    projects: [assigned, unassigned],
    clients: [{ id: 'c1', name: 'Acme' }],
    invoices: [],
    range,
  })
  assert.equal(withClients.showClientBreakdown, true)
  const clientIds = withClients.clientRows.map((row) => row.id)
  assert.deepEqual(clientIds, ['c1', null])
  assert.equal(withClients.clientRows[0].hoursMs, 3_600_000)
})

test('rows sort by hours descending', () => {
  const shortProject = perJobProject('p-short', 'c1')
  const longProject = perJobProject('p-long', 'c1')
  const report = buildStatisticsReport({
    timeEntries: [
      createTimeEntry({
        id: 'e1',
        projectId: 'p-short',
        startedAt: 0,
        endedAt: 1_800_000,
        earningsUsdCents: 100,
      }),
      createTimeEntry({
        id: 'e2',
        projectId: 'p-long',
        startedAt: 0,
        endedAt: 3_600_000,
        earningsUsdCents: 200,
      }),
    ],
    projects: [shortProject, longProject],
    clients: [{ id: 'c1', name: 'Acme' }],
    invoices: [],
    range,
  })
  assert.deepEqual(
    report.projectRows.map((row) => row.id),
    ['p-long', 'p-short'],
  )
})
