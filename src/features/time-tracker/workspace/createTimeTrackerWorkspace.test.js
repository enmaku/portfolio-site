import assert from 'node:assert/strict'
import test from 'node:test'
import { saveProjectEditor } from '../projects/projectEditor.js'
import { createTimeTrackerWorkspace } from './createTimeTrackerWorkspace.js'

function memoryStore() {
  /** @type {Record<string, any>} */
  const bag = {
    settings: null,
    clients: {},
    projects: {},
    timeEntries: {},
    invoices: {},
    links: {},
  }
  return {
    bag,
    async getOwnerSettings() {
      return bag.settings
    },
    async upsertOwnerSettings(_uid, settings) {
      bag.settings = { ...(bag.settings || {}), ...settings }
    },
    async listClients() {
      return Object.values(bag.clients)
    },
    async upsertClient(_uid, id, client) {
      bag.clients[id] = { id, ...client }
    },
    async deleteClient(_uid, id) {
      delete bag.clients[id]
    },
    async listProjects() {
      return Object.values(bag.projects)
    },
    async upsertProject(_uid, id, project) {
      bag.projects[id] = { id, ...project }
    },
    async deleteProject(_uid, id) {
      delete bag.projects[id]
    },
    async listTimeEntries() {
      return Object.values(bag.timeEntries)
    },
    async upsertTimeEntry(_uid, id, entry) {
      bag.timeEntries[id] = { id, ...entry }
    },
    async deleteTimeEntry(_uid, id) {
      delete bag.timeEntries[id]
    },
    async listInvoices() {
      return Object.values(bag.invoices)
    },
    async upsertInvoice(_uid, id, invoice) {
      bag.invoices[id] = { id, ...invoice }
    },
    async deleteInvoice(_uid, id) {
      delete bag.invoices[id]
    },
    async getInvoiceLink(secret) {
      return bag.links[secret] || null
    },
    async upsertInvoiceLink(secret, payload) {
      bag.links[secret] = { id: secret, ...payload }
    },
    async deleteInvoiceLink(secret) {
      delete bag.links[secret]
    },
  }
}

function memoryStorage() {
  /** @type {Record<string, string>} */
  const data = {}
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null
    },
    setItem(key, value) {
      data[key] = String(value)
    },
    removeItem(key) {
      delete data[key]
    },
  }
}

test('play then pause writes a time entry through the tracker store', async () => {
  const store = memoryStore()
  let now = 1_000
  let ids = 0
  const workspace = createTimeTrackerWorkspace({
    store,
    storage: memoryStorage(),
    now: () => now,
    randomId: () => `id-${++ids}`,
    randomSecret: () => 'secret-1',
  })
  await workspace.load('uid-1', { displayName: 'Ada' })
  await workspace.createProject({ name: 'Alpha' })
  await workspace.play()
  now = 5_000
  await workspace.pause()
  assert.equal(Object.keys(store.bag.timeEntries).length, 1)
  const entry = Object.values(store.bag.timeEntries)[0]
  assert.equal(entry.projectId, 'id-1')
  assert.equal(entry.startedAt, 1_000)
  assert.equal(entry.endedAt, 5_000)
  assert.equal(workspace.state.runningTimer, null)
})

test('sub-second pause does not write a time entry', async () => {
  const store = memoryStore()
  let now = 1_000
  const workspace = createTimeTrackerWorkspace({
    store,
    storage: memoryStorage(),
    now: () => now,
    randomId: () => 'p1',
    randomSecret: () => 'secret-1',
  })
  await workspace.load('uid-1', {})
  await workspace.createProject({ name: 'Alpha' })
  await workspace.play()
  now = 1_500
  await workspace.pause()
  assert.equal(Object.keys(store.bag.timeEntries).length, 0)
})

test('changing project while running files the current time entry and starts a new running timer', async () => {
  const store = memoryStore()
  let now = 1_000
  let ids = 0
  const workspace = createTimeTrackerWorkspace({
    store,
    storage: memoryStorage(),
    now: () => now,
    randomId: () => `id-${++ids}`,
    randomSecret: () => 'secret-1',
  })
  await workspace.load('uid-1', {})
  await workspace.createProject({ name: 'Alpha' })
  await workspace.createProject({ name: 'Beta' })
  await workspace.selectProject('id-1')
  await workspace.play()
  now = 8_000
  await workspace.selectProject('id-2')
  assert.equal(Object.keys(store.bag.timeEntries).length, 1)
  assert.equal(workspace.state.runningTimer.projectId, 'id-2')
  assert.equal(workspace.state.runningTimer.startedAt, 8_000)
})

test('load restores issuer name, tab, and selected project from the UI session', async () => {
  const store = memoryStore()
  const ui = {
    issuerName: 'Jane',
    activeSurface: 'clients',
    selectedProjectId: 'id-2',
    description: 'notes',
    runningTimer: null,
  }
  const writes = []
  let ids = 0
  const workspace = createTimeTrackerWorkspace({
    store,
    storage: memoryStorage(),
    now: () => 1,
    randomId: () => `id-${++ids}`,
    randomSecret: () => 'secret-1',
    readUi: () => ui,
    writeUi: (_uid, patch) => {
      writes.push(patch)
      Object.assign(ui, patch)
    },
  })
  await workspace.load('uid-1', { displayName: 'Ada' })
  const first = await workspace.createProject({ name: 'Alpha' })
  const second = await workspace.createProject({ name: 'Beta' })
  ui.selectedProjectId = second.id
  await workspace.load('uid-1', { displayName: 'Ada' })
  assert.equal(workspace.state.settings.issuerName, 'Jane')
  assert.equal(workspace.state.activeSurface, 'clients')
  assert.equal(workspace.state.selectedProjectId, second.id)
  assert.equal(workspace.state.description, 'notes')
  assert.notEqual(workspace.state.selectedProjectId, first.id)
  assert.ok(writes.length > 0)
})

test('setIssuerName writes the UI session before the tracker store', async () => {
  const store = memoryStore()
  const writes = []
  const workspace = createTimeTrackerWorkspace({
    store,
    storage: memoryStorage(),
    now: () => 1,
    randomId: () => 'id-1',
    randomSecret: () => 'secret-1',
    writeUi: (_uid, patch) => writes.push(patch),
  })
  await workspace.load('uid-1', {})
  await workspace.setIssuerName('  Jane  ')
  assert.equal(workspace.state.settings.issuerName, 'Jane')
  assert.equal(writes.at(-1)?.issuerName, 'Jane')
  assert.equal(store.bag.settings.issuerName, 'Jane')
})

test('project editor can change hourly rate after time entries are invoiced', async () => {
  const store = memoryStore()
  let ids = 0
  const workspace = createTimeTrackerWorkspace({
    store,
    storage: memoryStorage(),
    now: () => 3_600_000,
    randomId: () => `id-${++ids}`,
    randomSecret: () => 'secret-1',
  })
  await workspace.load('uid-1', {})
  const client = await workspace.createClient({ name: 'Acme' })
  const project = await workspace.createProject({ name: 'Aether' })
  await workspace.updateProjectClient(project.id, client.id)
  await workspace.updateProjectBilling(project.id, { billable: true, hourlyRateUsd: 12 })
  await workspace.addManualTimeEntry({
    projectId: project.id,
    startedAt: 0,
    endedAt: 3_600_000,
  })
  await workspace.generateInvoice({ clientId: client.id })

  const baseline = workspace.state.projects.find((item) => item.id === project.id)
  await saveProjectEditor(workspace, {
    projectId: project.id,
    baseline,
    draft: {
      name: 'Aether',
      clientId: client.id,
      billable: true,
      hourlyRateUsd: 15,
    },
  })

  const next = workspace.state.projects.find((item) => item.id === project.id)
  assert.equal(next.hourlyRateUsd, 15)
  assert.equal(next.clientId, client.id)
  assert.equal(next.billable, true)
})

test('pause on per-job stores frozen endedAt and earnings', async () => {
  const store = memoryStore()
  let now = 1_000
  let ids = 0
  const workspace = createTimeTrackerWorkspace({
    store,
    storage: memoryStorage(),
    now: () => now,
    randomId: () => `id-${++ids}`,
    randomSecret: () => 'secret-1',
  })
  await workspace.load('uid-1', {})
  const project = await workspace.createProject({ name: 'Per job' })
  await workspace.updateProjectBilling(project.id, { billable: true, perJobBillable: true })
  await workspace.play()
  now = 5_000
  await workspace.pause({ endedAt: 4_500, earningsUsdCents: 2_500 })
  now = 9_000
  const entry = Object.values(store.bag.timeEntries)[0]
  assert.equal(entry.endedAt, 4_500)
  assert.equal(entry.earningsUsdCents, 2_500)
})

test('pause on per-job with omitted earnings stores null', async () => {
  const store = memoryStore()
  let now = 1_000
  const workspace = createTimeTrackerWorkspace({
    store,
    storage: memoryStorage(),
    now: () => now,
    randomId: () => 'id-1',
    randomSecret: () => 'secret-1',
  })
  await workspace.load('uid-1', {})
  const project = await workspace.createProject({ name: 'Per job' })
  await workspace.updateProjectBilling(project.id, { billable: true, perJobBillable: true })
  await workspace.play()
  now = 5_000
  await workspace.pause({ endedAt: 5_000 })
  const entry = Object.values(store.bag.timeEntries)[0]
  assert.equal(entry.earningsUsdCents, null)
})

test('pause on hourly ignores passed earnings', async () => {
  const store = memoryStore()
  let now = 1_000
  const workspace = createTimeTrackerWorkspace({
    store,
    storage: memoryStorage(),
    now: () => now,
    randomId: () => 'id-1',
    randomSecret: () => 'secret-1',
  })
  await workspace.load('uid-1', {})
  const project = await workspace.createProject({ name: 'Hourly' })
  await workspace.updateProjectBilling(project.id, { billable: true, hourlyRateUsd: 50 })
  await workspace.play()
  now = 5_000
  await workspace.pause({ endedAt: 5_000, earningsUsdCents: 500 })
  const entry = Object.values(store.bag.timeEntries)[0]
  assert.equal(entry.earningsUsdCents, null)
})

test('selectProject while running files per-job earnings on the completed entry', async () => {
  const store = memoryStore()
  let now = 1_000
  let ids = 0
  const workspace = createTimeTrackerWorkspace({
    store,
    storage: memoryStorage(),
    now: () => now,
    randomId: () => `id-${++ids}`,
    randomSecret: () => 'secret-1',
  })
  await workspace.load('uid-1', {})
  const perJob = await workspace.createProject({ name: 'Per job' })
  const other = await workspace.createProject({ name: 'Other' })
  await workspace.updateProjectBilling(perJob.id, { billable: true, perJobBillable: true })
  await workspace.selectProject(perJob.id)
  await workspace.play()
  now = 8_000
  await workspace.selectProject(other.id, { at: 7_500, completedEarningsUsdCents: 900 })
  const entry = Object.values(store.bag.timeEntries)[0]
  assert.equal(entry.endedAt, 7_500)
  assert.equal(entry.earningsUsdCents, 900)
})

test('editTimeEntry clears earnings when moving from per-job to hourly', async () => {
  const store = memoryStore()
  let ids = 0
  const workspace = createTimeTrackerWorkspace({
    store,
    storage: memoryStorage(),
    now: () => 1,
    randomId: () => `id-${++ids}`,
    randomSecret: () => 'secret-1',
  })
  await workspace.load('uid-1', {})
  const perJob = await workspace.createProject({ name: 'Per job' })
  const hourly = await workspace.createProject({ name: 'Hourly' })
  await workspace.updateProjectBilling(perJob.id, { billable: true, perJobBillable: true })
  await workspace.updateProjectBilling(hourly.id, { billable: true, hourlyRateUsd: 40 })
  const entry = await workspace.addManualTimeEntry({
    projectId: perJob.id,
    startedAt: 0,
    endedAt: 3_600_000,
    earningsUsdCents: 1_000,
  })
  await workspace.editTimeEntry(entry.id, { projectId: hourly.id })
  const next = workspace.state.timeEntries.find((item) => item.id === entry.id)
  assert.equal(next.earningsUsdCents, null)
})

test('generateInvoice excludes per-job entries', async () => {
  const store = memoryStore()
  let ids = 0
  const workspace = createTimeTrackerWorkspace({
    store,
    storage: memoryStorage(),
    now: () => 3_600_000,
    randomId: () => `id-${++ids}`,
    randomSecret: () => 'secret-1',
  })
  await workspace.load('uid-1', {})
  const client = await workspace.createClient({ name: 'Acme' })
  const hourly = await workspace.createProject({ name: 'Hourly' })
  const perJob = await workspace.createProject({ name: 'Per job' })
  await workspace.updateProjectClient(hourly.id, client.id)
  await workspace.updateProjectClient(perJob.id, client.id)
  await workspace.updateProjectBilling(hourly.id, { billable: true, hourlyRateUsd: 100 })
  await workspace.updateProjectBilling(perJob.id, { billable: true, perJobBillable: true })
  await workspace.addManualTimeEntry({
    projectId: hourly.id,
    startedAt: 0,
    endedAt: 3_600_000,
  })
  await workspace.addManualTimeEntry({
    projectId: perJob.id,
    startedAt: 0,
    endedAt: 3_600_000,
    earningsUsdCents: 5_000,
  })
  const invoice = await workspace.generateInvoice({ clientId: client.id })
  assert.equal(invoice.lines.length, 1)
  assert.equal(invoice.invoiceTotalCents, 10_000)
})

test('updateProjectBilling persists perJobBillable', async () => {
  const store = memoryStore()
  const workspace = createTimeTrackerWorkspace({
    store,
    storage: memoryStorage(),
    now: () => 1,
    randomId: () => 'id-1',
    randomSecret: () => 'secret-1',
  })
  await workspace.load('uid-1', {})
  const project = await workspace.createProject({ name: 'Work' })
  await workspace.updateProjectBilling(project.id, { billable: true, perJobBillable: true })
  const next = workspace.state.projects.find((item) => item.id === project.id)
  assert.equal(next.perJobBillable, true)
})

test('load normalizes missing perJobBillable and earningsUsdCents', async () => {
  const store = memoryStore()
  store.bag.projects['p1'] = { id: 'p1', name: 'A', clientId: null, billable: true, hourlyRateUsd: 10 }
  store.bag.timeEntries['e1'] = {
    id: 'e1',
    projectId: 'p1',
    startedAt: 0,
    endedAt: 1_000,
    description: '',
  }
  const workspace = createTimeTrackerWorkspace({
    store,
    storage: memoryStorage(),
    now: () => 1,
    randomId: () => 'id-1',
    randomSecret: () => 'secret-1',
  })
  await workspace.load('uid-1', {})
  assert.equal(workspace.state.projects[0].perJobBillable, false)
  assert.equal(workspace.state.timeEntries[0].earningsUsdCents, null)
})
