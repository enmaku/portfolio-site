/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   clientId: string | null,
 *   billable: boolean,
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
    hourlyRateUsd: 0,
  }
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
 *   timeEntries?: InvoiceLockable[],
 * }} input
 * @returns {TrackerProject}
 */
export function setProjectBillable(project, input) {
  if (input.billable) {
    const rate = Number(input.hourlyRateUsd)
    if (!(rate > 0)) {
      throw new Error('Billable projects require an hourly rate greater than zero')
    }
    return { ...project, billable: true, hourlyRateUsd: rate }
  }
  if (!canTurnBillableOff({ timeEntries: input.timeEntries ?? [] })) {
    throw new Error('Cannot turn billable off while time entries are on an invoice')
  }
  return { ...project, billable: false }
}

/**
 * @param {TrackerProject} project
 * @param {{ clientId: string | null, timeEntries?: InvoiceLockable[] }} input
 * @returns {TrackerProject}
 */
export function assignProjectClient(project, input) {
  if (!canChangeProjectClient({ timeEntries: input.timeEntries ?? [] })) {
    throw new Error('Cannot change project client while time entries are on an invoice')
  }
  return { ...project, clientId: input.clientId ? String(input.clientId) : null }
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
