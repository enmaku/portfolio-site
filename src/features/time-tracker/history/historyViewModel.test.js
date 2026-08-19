import assert from 'node:assert/strict'
import test from 'node:test'
import { confirmInvoice, nextInvoiceNumber, previewInvoice } from '../domain/invoices.js'
import { createProject, setProjectBillable } from '../domain/projects.js'
import { createTimeEntry } from '../domain/timeEntries.js'
import { historyViewModel } from './historyViewModel.js'
import { invoiceExpansionViewModel } from '../invoices/invoiceExpansionViewModel.js'

test('history pins the running timer above completed rows and marks it immutable', () => {
  const entries = [
    createTimeEntry({ id: 'e1', projectId: 'p1', startedAt: 1_000, endedAt: 2_000 }),
    createTimeEntry({ id: 'e2', projectId: 'p2', startedAt: 3_000, endedAt: 4_000 }),
  ]
  const model = historyViewModel({
    timeEntries: entries,
    runningTimer: { projectId: 'p3', startedAt: 5_000, description: 'live' },
    now: 8_000,
  })
  assert.deepEqual(model.pinned, {
    kind: 'running',
    projectId: 'p3',
    startedAt: 5_000,
    description: 'live',
    durationMs: 3_000,
    mutable: false,
  })
  assert.deepEqual(
    model.rows.map((row) => row.id),
    ['e2', 'e1'],
  )
  assert.equal(model.rows[0].mutable, true)
})

test('invoice expansion nests project aggregates under the invoice then time entries', () => {
  const projects = [
    setProjectBillable({ ...createProject({ id: 'p1', name: 'Alpha' }), clientId: 'c1' }, {
      billable: true,
      hourlyRateUsd: 100,
    }),
    setProjectBillable({ ...createProject({ id: 'p2', name: 'Beta' }), clientId: 'c1' }, {
      billable: true,
      hourlyRateUsd: 200,
    }),
  ]
  const timeEntries = [
    createTimeEntry({
      id: 'e1',
      projectId: 'p1',
      startedAt: 0,
      endedAt: 3_600_000,
      description: 'alpha work',
    }),
    createTimeEntry({
      id: 'e2',
      projectId: 'p2',
      startedAt: 0,
      endedAt: 1_800_000,
    }),
  ]
  const preview = previewInvoice({
    timeEntries,
    projects,
    clientId: 'c1',
    issuedAt: 9,
  })
  const invoice = confirmInvoice({
    preview,
    invoiceId: 'inv1',
    invoiceNumber: nextInvoiceNumber(0),
  })
  const model = invoiceExpansionViewModel({ invoice, projects, timeEntries })
  assert.equal(model.invoiceNumber, 1)
  assert.equal(model.invoiceTotalCents, 20_000)
  assert.equal(model.projects.length, 2)
  assert.equal(model.projects[0].name, 'Alpha')
  assert.equal(model.projects[0].amountCents, 10_000)
  assert.equal(model.projects[0].timeEntries[0].description, 'alpha work')
  assert.equal(model.projects[1].name, 'Beta')
  assert.equal(model.projects[1].amountCents, 10_000)
})
