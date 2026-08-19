import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assignProjectClient,
  canChangeProjectClient,
  canDeleteClient,
  canDeleteProject,
  canTurnBillableOff,
  createClient,
  createProject,
  setProjectBillable,
  unassignProjectsForDeletedClient,
} from './projects.js'

test('new projects are not billable and may have no client', () => {
  const project = createProject({ id: 'p1', name: ' Personal ' })
  assert.deepEqual(project, {
    id: 'p1',
    name: 'Personal',
    clientId: null,
    billable: false,
    hourlyRateUsd: 0,
  })
})

test('turning billable on requires an hourly rate greater than zero', () => {
  const project = createProject({ id: 'p1', name: 'Work' })
  assert.throws(() => setProjectBillable(project, { billable: true, hourlyRateUsd: 0 }), /rate/)
  const billed = setProjectBillable(project, { billable: true, hourlyRateUsd: 150 })
  assert.equal(billed.billable, true)
  assert.equal(billed.hourlyRateUsd, 150)
})

test('turning billable off keeps the stored hourly rate', () => {
  const billed = setProjectBillable(createProject({ id: 'p1', name: 'Work' }), {
    billable: true,
    hourlyRateUsd: 150,
  })
  const off = setProjectBillable(billed, { billable: false })
  assert.equal(off.billable, false)
  assert.equal(off.hourlyRateUsd, 150)
})

test('project deletion is blocked while any time entries remain', () => {
  assert.equal(canDeleteProject({ timeEntries: [] }), true)
  assert.equal(canDeleteProject({ timeEntries: [{ id: 'e1', projectId: 'p1' }] }), false)
})

test('client deletion is blocked while any invoices remain', () => {
  assert.equal(canDeleteClient({ invoices: [] }), true)
  assert.equal(canDeleteClient({ invoices: [{ id: 'inv1', clientId: 'c1' }] }), false)
})

test('project client may change only when none of its time entries are invoiced', () => {
  assert.equal(canChangeProjectClient({ timeEntries: [{ id: 'e1', invoiceId: null }] }), true)
  assert.equal(canChangeProjectClient({ timeEntries: [{ id: 'e1', invoiceId: 'inv1' }] }), false)
})

test('billable may turn off only when none of the project time entries are invoiced', () => {
  const billed = setProjectBillable(createProject({ id: 'p1', name: 'Work' }), {
    billable: true,
    hourlyRateUsd: 80,
  })
  assert.equal(canTurnBillableOff({ timeEntries: [{ invoiceId: null }] }), true)
  assert.equal(canTurnBillableOff({ timeEntries: [{ invoiceId: 'inv1' }] }), false)
  assert.throws(
    () => setProjectBillable(billed, { billable: false, timeEntries: [{ invoiceId: 'inv1' }] }),
    /invoice/,
  )
})

test('assigning a client is blocked when invoiced time entries exist on the project', () => {
  const project = createProject({ id: 'p1', name: 'Work' })
  assert.throws(
    () => assignProjectClient(project, { clientId: 'c1', timeEntries: [{ invoiceId: 'inv1' }] }),
    /invoice/,
  )
  const next = assignProjectClient(project, { clientId: 'c1', timeEntries: [] })
  assert.equal(next.clientId, 'c1')
})

test('keeping the same client is not a client change when time entries are invoiced', () => {
  const project = { ...createProject({ id: 'p1', name: 'Work' }), clientId: 'c1' }
  const next = assignProjectClient(project, {
    clientId: 'c1',
    timeEntries: [{ invoiceId: 'inv1' }],
  })
  assert.equal(next, project)
  assert.equal(next.clientId, 'c1')
})

test('deleting a client with no invoices unassigns its projects', () => {
  const client = createClient({ id: 'c1', name: ' Acme ' })
  assert.equal(client.name, 'Acme')
  const projects = [
    { ...createProject({ id: 'p1', name: 'A' }), clientId: 'c1' },
    createProject({ id: 'p2', name: 'B' }),
  ]
  const next = unassignProjectsForDeletedClient(projects, client.id)
  assert.equal(next[0].clientId, null)
  assert.equal(next[1].clientId, null)
})
