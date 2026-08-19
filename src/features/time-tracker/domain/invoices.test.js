import assert from 'node:assert/strict'
import test from 'node:test'
import { createProject, setProjectBillable } from './projects.js'
import { createTimeEntry } from './timeEntries.js'
import {
  PAYMENT_STATUS,
  attachInvoiceToTimeEntries,
  canDeleteInvoice,
  confirmInvoice,
  lineAmountCents,
  nextInvoiceNumber,
  payAllInvoices,
  paymentStatus,
  previewInvoice,
  qualifyingTimeEntries,
  releaseTimeEntries,
  setAmountPaid,
  unpaidBalanceCents,
} from './invoices.js'

function billedProject(id, clientId, rate) {
  return setProjectBillable({ ...createProject({ id, name: id }), clientId }, {
    billable: true,
    hourlyRateUsd: rate,
  })
}

test('line amounts round duration times hourly rate to the nearest cent', () => {
  assert.equal(lineAmountCents(3_600_000, 150), 15_000)
  assert.equal(lineAmountCents(1_800_000, 100), 5_000)
})

test('invoice generation includes only uninvoiced billable entries for that client', () => {
  const projects = [
    billedProject('p1', 'c1', 100),
    billedProject('p2', 'c1', 200),
    billedProject('p3', null, 50),
    createProject({ id: 'p4', name: 'p4', clientId: 'c1' }),
  ]
  const entries = [
    createTimeEntry({ id: 'e1', projectId: 'p1', startedAt: 0, endedAt: 3_600_000 }),
    createTimeEntry({ id: 'e2', projectId: 'p2', startedAt: 0, endedAt: 3_600_000, invoiceId: 'old' }),
    createTimeEntry({ id: 'e3', projectId: 'p3', startedAt: 0, endedAt: 3_600_000 }),
    createTimeEntry({ id: 'e4', projectId: 'p4', startedAt: 0, endedAt: 3_600_000 }),
    createTimeEntry({ id: 'e5', projectId: 'p1', startedAt: 10_000_000, endedAt: 13_600_000 }),
  ]
  const qualified = qualifyingTimeEntries({
    timeEntries: entries,
    projects,
    clientId: 'c1',
  })
  assert.deepEqual(
    qualified.map((entry) => entry.id).sort(),
    ['e1', 'e5'],
  )
})

test('optional date range limits qualifying time entries by start', () => {
  const projects = [billedProject('p1', 'c1', 100)]
  const entries = [
    createTimeEntry({ id: 'early', projectId: 'p1', startedAt: 0, endedAt: 3_600_000 }),
    createTimeEntry({ id: 'in', projectId: 'p1', startedAt: 5_000, endedAt: 3_605_000 }),
  ]
  const qualified = qualifyingTimeEntries({
    timeEntries: entries,
    projects,
    clientId: 'c1',
    range: { start: 1_000, end: 10_000 },
  })
  assert.deepEqual(
    qualified.map((entry) => entry.id),
    ['in'],
  )
})

test('preview then confirm freezes hourly rate and rejects an empty qualifying set', () => {
  const project = billedProject('p1', 'c1', 100)
  const entries = [
    createTimeEntry({ id: 'e1', projectId: 'p1', startedAt: 0, endedAt: 3_600_000 }),
  ]
  assert.throws(
    () =>
      previewInvoice({
        timeEntries: [],
        projects: [project],
        clientId: 'c1',
        issuedAt: 9,
      }),
    /qualifying/,
  )
  const preview = previewInvoice({
    timeEntries: entries,
    projects: [project],
    clientId: 'c1',
    issuedAt: 9,
    issuerName: '',
  })
  assert.equal(preview.invoiceTotalCents, 10_000)
  assert.equal(preview.lines[0].hourlyRateUsd, 100)
  const invoice = confirmInvoice({
    preview,
    invoiceId: 'inv1',
    invoiceNumber: nextInvoiceNumber(0),
  })
  assert.equal(invoice.invoiceNumber, 1)
  assert.equal(invoice.issuerName, '')
  assert.equal(invoice.amountPaidCents, 0)
  const raised = setProjectBillable(project, { billable: true, hourlyRateUsd: 200 })
  assert.equal(invoice.lines[0].hourlyRateUsd, 100)
  assert.equal(raised.hourlyRateUsd, 200)
  const locked = attachInvoiceToTimeEntries(entries, invoice.id, preview.lines.map((line) => line.timeEntryId))
  assert.equal(locked[0].invoiceId, 'inv1')
})

test('payment status and unpaid balance follow amount paid versus invoice total', () => {
  const invoice = {
    id: 'inv1',
    clientId: 'c1',
    invoiceTotalCents: 10_000,
    amountPaidCents: 0,
  }
  assert.equal(paymentStatus(invoice), PAYMENT_STATUS.UNPAID)
  const partial = setAmountPaid(invoice, 4_000)
  assert.equal(paymentStatus(partial), PAYMENT_STATUS.PARTIAL)
  const paid = setAmountPaid(invoice, 10_000)
  assert.equal(paymentStatus(paid), PAYMENT_STATUS.PAID)
  const over = setAmountPaid(invoice, 12_000)
  assert.equal(paymentStatus(over), PAYMENT_STATUS.PAID)
  assert.equal(unpaidBalanceCents([partial, paid]), 6_000)
})

test('pay all invoices settles every not-fully-paid invoice for a client', () => {
  const invoices = [
    { id: 'a', clientId: 'c1', invoiceTotalCents: 100, amountPaidCents: 0 },
    { id: 'b', clientId: 'c1', invoiceTotalCents: 50, amountPaidCents: 10 },
    { id: 'c', clientId: 'c1', invoiceTotalCents: 20, amountPaidCents: 20 },
  ]
  const next = payAllInvoices(invoices)
  assert.deepEqual(
    next.map((invoice) => invoice.amountPaidCents),
    [100, 50, 20],
  )
})

test('invoice deletion is allowed only while unpaid and then releases time entries', () => {
  const unpaid = { id: 'inv1', invoiceTotalCents: 10, amountPaidCents: 0 }
  const partial = { id: 'inv1', invoiceTotalCents: 10, amountPaidCents: 1 }
  assert.equal(canDeleteInvoice(unpaid), true)
  assert.equal(canDeleteInvoice(partial), false)
  const entries = [
    createTimeEntry({
      id: 'e1',
      projectId: 'p1',
      startedAt: 0,
      endedAt: 1_000,
      invoiceId: 'inv1',
    }),
  ]
  const released = releaseTimeEntries(entries, 'inv1')
  assert.equal(released[0].invoiceId, null)
})
