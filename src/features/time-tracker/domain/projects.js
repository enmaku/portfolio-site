/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   clientId: string | null,
 *   billable: boolean,
 *   perJobBillable: boolean,
 *   hourlyRateUsd: number,
 * }} TrackerProject
 * @typedef {{ id: string, name: string }} TrackerClient
 * @typedef {{ invoiceId?: string | null }} InvoiceLockable
 */

/**
 * @param {{ id: string, name: string, clientId?: string | null }} input
 * @returns {TrackerProject}
 */
export function createProject(input) {
  const name = String(input?.name || '').trim()
  if (!name) {
    throw new Error('Project name is required')
  }
  const id = String(input?.id || '').trim()
  if (!id) {
    throw new Error('Project id is required')
  }
  return {
    id,
    name,
    clientId: input.clientId ? String(input.clientId) : null,
    billable: false,
    perJobBillable: false,
    hourlyRateUsd: 0,
  }
}

/**
 * @param {unknown} raw
 * @returns {TrackerProject}
 */
export function normalizeProject(raw) {
  const base = createProject({
    id: String(raw?.id || ''),
    name: String(raw?.name || ''),
    clientId: raw?.clientId ? String(raw.clientId) : null,
  })
  return {
    ...base,
    billable: raw?.billable === true,
    perJobBillable: raw?.perJobBillable === true,
    hourlyRateUsd: Number(raw?.hourlyRateUsd) || 0,
  }
}

/**
 * @param {{ billable?: boolean, perJobBillable?: boolean } | null | undefined} project
 */
export function isHourlyBillable(project) {
  return Boolean(project?.billable) && !project?.perJobBillable
}

/**
 * @param {{ billable?: boolean, perJobBillable?: boolean } | null | undefined} project
 */
export function isPerJobBillable(project) {
  return Boolean(project?.billable) && Boolean(project?.perJobBillable)
}

/**
 * @param {{ id: string, name: string }} input
 * @returns {TrackerClient}
 */
export function createClient(input) {
  const name = String(input?.name || '').trim()
  if (!name) {
    throw new Error('Client name is required')
  }
  const id = String(input?.id || '').trim()
  if (!id) {
    throw new Error('Client id is required')
  }
  return { id, name }
}

/**
 * @param {{ timeEntries?: InvoiceLockable[] }} input
 */
export function canDeleteProject(input) {
  return (input?.timeEntries ?? []).length === 0
}

/**
 * @param {{ invoices?: unknown[] }} input
 */
export function canDeleteClient(input) {
  return (input?.invoices ?? []).length === 0
}

/**
 * @param {{ timeEntries?: InvoiceLockable[] }} input
 */
export function projectHasInvoicedTimeEntries(input) {
  return (input?.timeEntries ?? []).some((entry) => Boolean(entry?.invoiceId))
}

/**
 * @param {{ timeEntries?: InvoiceLockable[] }} input
 */
export function canChangeProjectClient(input) {
  return !projectHasInvoicedTimeEntries(input)
}

/**
 * @param {{ timeEntries?: InvoiceLockable[] }} input
 */
export function canTurnBillableOff(input) {
  return !projectHasInvoicedTimeEntries(input)
}

/**
 * @param {TrackerProject} project
 * @param {{
 *   billable: boolean,
 *   hourlyRateUsd?: number,
 *   perJobBillable?: boolean,
 *   timeEntries?: InvoiceLockable[],
 * }} input
 * @returns {TrackerProject}
 */
export function setProjectBillable(project, input) {
  const billable = Boolean(input.billable)
  const perJobBillable =
    input.perJobBillable !== undefined ? Boolean(input.perJobBillable) : Boolean(project.perJobBillable)
  const timeEntries = input.timeEntries ?? []
  const billingModeChanging =
    Boolean(project.billable) && billable && perJobBillable !== Boolean(project.perJobBillable)

  if (!billable || billingModeChanging) {
    if (!canTurnBillableOff({ timeEntries })) {
      throw new Error('Cannot turn billable off while time entries are on an invoice')
    }
  }

  if (!billable) {
    return { ...project, billable: false }
  }

  if (perJobBillable) {
    const hourlyRateUsd =
      input.hourlyRateUsd !== undefined ? Number(input.hourlyRateUsd) : project.hourlyRateUsd
    return { ...project, billable: true, perJobBillable: true, hourlyRateUsd }
  }

  const rate = Number(input.hourlyRateUsd ?? project.hourlyRateUsd)
  if (!(rate > 0)) {
    throw new Error('Billable projects require an hourly rate greater than zero')
  }
  return { ...project, billable: true, perJobBillable: false, hourlyRateUsd: rate }
}

function normalizeClientId(clientId) {
  return clientId ? String(clientId) : null
}

/**
 * @param {TrackerProject} project
 * @param {{ clientId: string | null, timeEntries?: InvoiceLockable[] }} input
 * @returns {TrackerProject}
 */
export function assignProjectClient(project, input) {
  const clientId = normalizeClientId(input.clientId)
  if (normalizeClientId(project.clientId) === clientId) {
    return project
  }
  if (!canChangeProjectClient({ timeEntries: input.timeEntries ?? [] })) {
    throw new Error('Cannot change project client while time entries are on an invoice')
  }
  return { ...project, clientId }
}

/**
 * @param {TrackerProject[]} projects
 * @param {string} clientId
 * @returns {TrackerProject[]}
 */
export function unassignProjectsForDeletedClient(projects, clientId) {
  return projects.map((project) =>
    project.clientId === clientId ? { ...project, clientId: null } : project,
  )
}
