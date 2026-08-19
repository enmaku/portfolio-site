import {
  assertTimeEntryMutable,
  assignProjectClient,
  attachInvoiceToTimeEntries,
  canDeleteClient,
  canDeleteInvoice,
  canDeleteProject,
  completeRunningTimer,
  confirmInvoice,
  createClient,
  createProject,
  createTimeEntry,
  defaultIssuerName,
  nextInvoiceNumber,
  payAllInvoices,
  previewInvoice,
  releaseTimeEntries,
  setAmountPaid,
  setProjectBillable,
  startRunningTimer,
  switchRunningTimerProject,
  unassignProjectsForDeletedClient,
} from '../domain/index.js'
import {
  clearRunningTimer,
  loadRunningTimer,
  saveRunningTimer,
} from '../runningTimerPersistence.js'
import {
  normalizeActiveSurface,
  normalizeRunningTimer,
  resolveIssuerName,
  resolveSelectedProjectId,
} from '../sessionPrefs.js'

function lastProjectKey(uid) {
  return `time-tracker:last-project:${uid}`
}

/**
 * Live Time Tracker orchestration: domain decisions, then tracker store writes.
 *
 * @param {{
 *   store: object,
 *   storage: { getItem: Function, setItem: Function, removeItem: Function },
 *   now: () => number,
 *   randomId: () => string,
 *   randomSecret: () => string,
 *   readUi?: (uid: string) => object | null,
 *   writeUi?: (uid: string, patch: object) => void,
 * }} deps
 */
export function createTimeTrackerWorkspace(deps) {
  const state = deps.state || {
    uid: /** @type {string | null} */ (null),
    clients: /** @type {object[]} */ ([]),
    projects: /** @type {object[]} */ ([]),
    timeEntries: /** @type {object[]} */ ([]),
    invoices: /** @type {object[]} */ ([]),
    settings: { issuerName: '', nextInvoiceNumber: 1 },
    runningTimer: /** @type {null | { projectId: string, startedAt: number, description: string }} */ (
      null
    ),
    selectedProjectId: /** @type {string | null} */ (null),
    description: '',
    activeSurface: 'timer',
  }

  function requireUid() {
    if (!state.uid) throw new Error('Not signed in')
    return state.uid
  }

  function persistRunning() {
    const uid = requireUid()
    if (state.runningTimer) {
      saveRunningTimer({ ownerUid: uid, running: state.runningTimer, storage: deps.storage })
    } else {
      clearRunningTimer({ ownerUid: uid, storage: deps.storage })
    }
  }

  function persistLastProject() {
    if (!state.uid || !state.selectedProjectId) return
    deps.storage.setItem(lastProjectKey(state.uid), state.selectedProjectId)
  }

  function persistUi() {
    if (!state.uid || !deps.writeUi) return
    deps.writeUi(state.uid, {
      issuerName: state.settings.issuerName,
      activeSurface: state.activeSurface,
      selectedProjectId: state.selectedProjectId,
      description: state.description,
      runningTimer: state.runningTimer,
    })
  }

  async function replaceProject(project) {
    await deps.store.upsertProject(requireUid(), project.id, project)
    state.projects = state.projects.map((item) => (item.id === project.id ? project : item))
  }

  /**
   * @param {string} uid
   * @param {{ displayName?: string | null } | null | undefined} user
   */
  async function load(uid, user) {
    state.uid = uid
    const [clients, projects, timeEntries, invoices, existingSettings] = await Promise.all([
      deps.store.listClients(uid),
      deps.store.listProjects(uid),
      deps.store.listTimeEntries(uid),
      deps.store.listInvoices(uid),
      deps.store.getOwnerSettings(uid),
    ])
    state.clients = clients
    state.projects = projects
    state.timeEntries = timeEntries
    state.invoices = invoices

    const ui = deps.readUi?.(uid) || null
    const issuerName = resolveIssuerName({
      hasSession: Boolean(ui),
      sessionName: ui?.issuerName,
      storeName: existingSettings?.issuerName,
      defaultName: defaultIssuerName(user),
    })
    const nextInvoiceNumber = Number(existingSettings?.nextInvoiceNumber) || 1
    state.settings = { issuerName, nextInvoiceNumber }
    if (!existingSettings || issuerName !== String(existingSettings.issuerName || '')) {
      await deps.store.upsertOwnerSettings(uid, state.settings)
    }

    if (ui?.activeSurface) state.activeSurface = normalizeActiveSurface(ui.activeSurface)

    const fromUi = normalizeRunningTimer(ui?.runningTimer)
    state.runningTimer = fromUi || loadRunningTimer({ ownerUid: uid, storage: deps.storage })
    const projectIds = projects.map((project) => project.id)
    if (state.runningTimer) {
      state.selectedProjectId = state.runningTimer.projectId
      state.description = state.runningTimer.description || ''
    } else {
      const last = deps.storage.getItem(lastProjectKey(uid))
      state.selectedProjectId = resolveSelectedProjectId({
        preferredId: ui?.selectedProjectId || null,
        fallbackId: last,
        projectIds,
      })
      state.description = String(ui?.description || '')
    }
    persistUi()
  }

  async function play() {
    if (!state.selectedProjectId) {
      throw new Error('A project is required to start a running timer')
    }
    state.runningTimer = startRunningTimer({
      existing: state.runningTimer,
      projectId: state.selectedProjectId,
      startedAt: deps.now(),
      description: state.description,
    })
    persistRunning()
    persistUi()
  }

  async function fileCompleted(completed) {
    if (completed.discarded || !completed.timeEntry) return
    const id = deps.randomId()
    const entry = createTimeEntry({ id, ...completed.timeEntry })
    await deps.store.upsertTimeEntry(requireUid(), id, entry)
    state.timeEntries = [...state.timeEntries, entry]
  }

  async function pause() {
    if (!state.runningTimer) return
    const completed = completeRunningTimer(state.runningTimer, { endedAt: deps.now() })
    await fileCompleted(completed)
    state.runningTimer = null
    persistRunning()
    persistUi()
  }

  async function selectProject(projectId) {
    if (state.runningTimer && projectId !== state.runningTimer.projectId) {
      const { completed, nextRunning } = switchRunningTimerProject(state.runningTimer, {
        projectId,
        at: deps.now(),
        description: '',
      })
      await fileCompleted(completed)
      state.runningTimer = nextRunning
      state.description = ''
      persistRunning()
    }
    state.selectedProjectId = projectId
    persistLastProject()
    persistUi()
  }

  function setDescription(description) {
    state.description = description
    if (state.runningTimer) {
      state.runningTimer = { ...state.runningTimer, description }
      persistRunning()
    }
    persistUi()
  }

  function setActiveSurface(surfaceId) {
    state.activeSurface = normalizeActiveSurface(surfaceId)
    persistUi()
  }

  async function createProjectRecord({ name }) {
    const project = createProject({ id: deps.randomId(), name })
    await deps.store.upsertProject(requireUid(), project.id, project)
    state.projects = [...state.projects, project]
    if (!state.selectedProjectId) {
      state.selectedProjectId = project.id
      persistLastProject()
      persistUi()
    }
    return project
  }

  async function renameProject(projectId, name) {
    const current = state.projects.find((project) => project.id === projectId)
    if (!current) throw new Error('Project not found')
    await replaceProject({ ...current, name: createProject({ id: projectId, name }).name })
  }

  async function updateProjectBilling(projectId, { billable, hourlyRateUsd }) {
    const current = state.projects.find((project) => project.id === projectId)
    if (!current) throw new Error('Project not found')
    const next = setProjectBillable(current, {
      billable,
      hourlyRateUsd,
      timeEntries: state.timeEntries.filter((entry) => entry.projectId === projectId),
    })
    await replaceProject(next)
  }

  async function updateProjectClient(projectId, clientId) {
    const current = state.projects.find((project) => project.id === projectId)
    if (!current) throw new Error('Project not found')
    const next = assignProjectClient(current, {
      clientId,
      timeEntries: state.timeEntries.filter((entry) => entry.projectId === projectId),
    })
    if (next === current) return
    await replaceProject(next)
  }

  async function removeProject(projectId) {
    const entries = state.timeEntries.filter((entry) => entry.projectId === projectId)
    if (!canDeleteProject({ timeEntries: entries })) {
      throw new Error('Project deletion is blocked while time entries remain')
    }
    await deps.store.deleteProject(requireUid(), projectId)
    state.projects = state.projects.filter((project) => project.id !== projectId)
    if (state.selectedProjectId === projectId) {
      state.selectedProjectId = state.projects[0]?.id || null
      persistLastProject()
      persistUi()
    }
  }

  async function createClientRecord({ name }) {
    const client = {
      ...createClient({ id: deps.randomId(), name }),
      invoiceLinkSecret: deps.randomSecret(),
    }
    const uid = requireUid()
    await deps.store.upsertClient(uid, client.id, client)
    await deps.store.upsertInvoiceLink(client.invoiceLinkSecret, {
      ownerUid: uid,
      clientId: client.id,
      clientName: client.name,
    })
    state.clients = [...state.clients, client]
    return client
  }

  async function renameClient(clientId, name) {
    const current = state.clients.find((client) => client.id === clientId)
    if (!current) throw new Error('Client not found')
    const next = { ...current, name: createClient({ id: clientId, name }).name }
    await deps.store.upsertClient(requireUid(), clientId, next)
    if (next.invoiceLinkSecret) {
      await deps.store.upsertInvoiceLink(next.invoiceLinkSecret, {
        ownerUid: requireUid(),
        clientId,
        clientName: next.name,
      })
    }
    state.clients = state.clients.map((client) => (client.id === clientId ? next : client))
  }

  async function removeClient(clientId) {
    const invoices = state.invoices.filter((invoice) => invoice.clientId === clientId)
    if (!canDeleteClient({ invoices })) {
      throw new Error('Client deletion is blocked while invoices remain')
    }
    const current = state.clients.find((client) => client.id === clientId)
    const uid = requireUid()
    const nextProjects = unassignProjectsForDeletedClient(state.projects, clientId)
    await Promise.all(
      nextProjects
        .filter((project, index) => project.clientId !== state.projects[index].clientId)
        .map((project) => deps.store.upsertProject(uid, project.id, project)),
    )
    if (current?.invoiceLinkSecret) {
      await deps.store.deleteInvoiceLink(current.invoiceLinkSecret)
    }
    await deps.store.deleteClient(uid, clientId)
    state.projects = nextProjects
    state.clients = state.clients.filter((client) => client.id !== clientId)
  }

  async function addManualTimeEntry(input) {
    const entry = createTimeEntry({ id: deps.randomId(), ...input })
    await deps.store.upsertTimeEntry(requireUid(), entry.id, entry)
    state.timeEntries = [...state.timeEntries, entry]
    return entry
  }

  async function editTimeEntry(entryId, patch) {
    const current = state.timeEntries.find((entry) => entry.id === entryId)
    if (!current) throw new Error('Time entry not found')
    assertTimeEntryMutable(current)
    const entry = createTimeEntry({ ...current, ...patch, id: entryId, invoiceId: null })
    await deps.store.upsertTimeEntry(requireUid(), entryId, entry)
    state.timeEntries = state.timeEntries.map((item) => (item.id === entryId ? entry : item))
  }

  async function removeTimeEntry(entryId) {
    const current = state.timeEntries.find((entry) => entry.id === entryId)
    if (!current) throw new Error('Time entry not found')
    assertTimeEntryMutable(current)
    await deps.store.deleteTimeEntry(requireUid(), entryId)
    state.timeEntries = state.timeEntries.filter((entry) => entry.id !== entryId)
  }

  async function generateInvoice({ clientId, range = null }) {
    const preview = previewInvoice({
      timeEntries: state.timeEntries,
      projects: state.projects,
      clientId,
      range,
      issuedAt: deps.now(),
      issuerName: state.settings.issuerName,
    })
    const client = state.clients.find((item) => item.id === clientId)
    const invoice = {
      ...confirmInvoice({
        preview,
        invoiceId: deps.randomId(),
        invoiceNumber: nextInvoiceNumber(state.settings.nextInvoiceNumber - 1),
      }),
      linkSecret: client?.invoiceLinkSecret || null,
    }
    const uid = requireUid()
    await deps.store.upsertInvoice(uid, invoice.id, invoice)
    const locked = attachInvoiceToTimeEntries(
      state.timeEntries,
      invoice.id,
      preview.lines.map((line) => line.timeEntryId),
    )
    await Promise.all(
      locked
        .filter((entry, index) => entry.invoiceId !== state.timeEntries[index].invoiceId)
        .map((entry) => deps.store.upsertTimeEntry(uid, entry.id, entry)),
    )
    state.timeEntries = locked
    state.invoices = [...state.invoices, invoice]
    state.settings = {
      ...state.settings,
      nextInvoiceNumber: invoice.invoiceNumber + 1,
    }
    await deps.store.upsertOwnerSettings(uid, state.settings)
    return invoice
  }

  async function updateInvoicePaid(invoiceId, amountPaidCents) {
    const current = state.invoices.find((invoice) => invoice.id === invoiceId)
    if (!current) throw new Error('Invoice not found')
    const next = setAmountPaid(current, amountPaidCents)
    await deps.store.upsertInvoice(requireUid(), invoiceId, next)
    state.invoices = state.invoices.map((invoice) => (invoice.id === invoiceId ? next : invoice))
  }

  async function payAllForClient(clientId) {
    const invoices = state.invoices.filter((invoice) => invoice.clientId === clientId)
    const next = payAllInvoices(invoices)
    const uid = requireUid()
    await Promise.all(next.map((invoice) => deps.store.upsertInvoice(uid, invoice.id, invoice)))
    const byId = new Map(next.map((invoice) => [invoice.id, invoice]))
    state.invoices = state.invoices.map((invoice) => byId.get(invoice.id) || invoice)
  }

  async function removeInvoice(invoiceId) {
    const current = state.invoices.find((invoice) => invoice.id === invoiceId)
    if (!current) throw new Error('Invoice not found')
    if (!canDeleteInvoice(current)) {
      throw new Error('Invoice deletion is allowed only while unpaid')
    }
    const uid = requireUid()
    const released = releaseTimeEntries(state.timeEntries, invoiceId)
    await Promise.all(
      released
        .filter((entry, index) => entry.invoiceId !== state.timeEntries[index].invoiceId)
        .map((entry) => deps.store.upsertTimeEntry(uid, entry.id, entry)),
    )
    await deps.store.deleteInvoice(uid, invoiceId)
    state.timeEntries = released
    state.invoices = state.invoices.filter((invoice) => invoice.id !== invoiceId)
  }

  async function regenerateClientLink(clientId) {
    const current = state.clients.find((client) => client.id === clientId)
    if (!current) throw new Error('Client not found')
    const uid = requireUid()
    const newSecret = deps.randomSecret()
    const oldSecret = current.invoiceLinkSecret
    const nextClient = { ...current, invoiceLinkSecret: newSecret }
    const nextInvoices = state.invoices.map((invoice) =>
      invoice.clientId === clientId ? { ...invoice, linkSecret: newSecret } : invoice,
    )
    await Promise.all(
      nextInvoices
        .filter((invoice) => invoice.clientId === clientId)
        .map((invoice) => deps.store.upsertInvoice(uid, invoice.id, invoice)),
    )
    await deps.store.upsertClient(uid, clientId, nextClient)
    await deps.store.upsertInvoiceLink(newSecret, {
      ownerUid: uid,
      clientId,
      clientName: nextClient.name,
    })
    if (oldSecret) await deps.store.deleteInvoiceLink(oldSecret)
    state.clients = state.clients.map((client) => (client.id === clientId ? nextClient : client))
    state.invoices = nextInvoices
    return newSecret
  }

  async function setIssuerName(issuerName) {
    state.settings = { ...state.settings, issuerName: String(issuerName || '').trim() }
    persistUi()
    await deps.store.upsertOwnerSettings(requireUid(), state.settings)
  }

  async function signOutPause() {
    if (!state.runningTimer) return { writeSucceeded: true }
    try {
      await pause()
      return { writeSucceeded: true }
    } catch {
      return { writeSucceeded: false }
    }
  }

  return {
    state,
    load,
    play,
    pause,
    selectProject,
    setDescription,
    createProject: createProjectRecord,
    renameProject,
    updateProjectBilling,
    updateProjectClient,
    removeProject,
    createClient: createClientRecord,
    renameClient,
    removeClient,
    addManualTimeEntry,
    editTimeEntry,
    removeTimeEntry,
    generateInvoice,
    updateInvoicePaid,
    payAllForClient,
    removeInvoice,
    regenerateClientLink,
    setIssuerName,
    setActiveSurface,
    signOutPause,
  }
}
