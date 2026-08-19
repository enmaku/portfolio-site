import { canChangeProjectClient, canTurnBillableOff } from '../domain/projects.js'

function normalizeClientId(clientId) {
  return clientId ? String(clientId) : null
}

/**
 * @param {{ billable?: boolean, timeEntries?: Array<{ invoiceId?: string | null }> }} input
 */
export function projectEditorFieldLocks(input) {
  const timeEntries = input?.timeEntries ?? []
  return {
    client: !canChangeProjectClient({ timeEntries }),
    billable: Boolean(input?.billable) && !canTurnBillableOff({ timeEntries }),
  }
}

/**
 * @param {{
 *   name: string,
 *   clientId: string | null,
 *   billable: boolean,
 *   hourlyRateUsd: number,
 * } | null} baseline
 * @param {{
 *   name: string,
 *   clientId: string | null,
 *   billable: boolean,
 *   hourlyRateUsd: number,
 * }} draft
 */
export function dirtyProjectEditorPatch(baseline, draft) {
  const name = String(draft?.name || '').trim()
  const clientId = normalizeClientId(draft?.clientId)
  const billable = Boolean(draft?.billable)
  const hourlyRateUsd = Number(draft?.hourlyRateUsd)

  if (!baseline) {
    const patch = { name }
    if (clientId) patch.clientId = clientId
    if (billable) patch.billing = { billable: true, hourlyRateUsd }
    return patch
  }

  const patch = {}
  if (name !== baseline.name) patch.name = name
  if (clientId !== normalizeClientId(baseline.clientId)) patch.clientId = clientId
  if (billable !== Boolean(baseline.billable) || hourlyRateUsd !== Number(baseline.hourlyRateUsd)) {
    patch.billing = { billable, hourlyRateUsd }
  }
  return patch
}

/**
 * Live Projects editor save: only dirty fields hit the workspace.
 *
 * @param {{
 *   createProject: Function,
 *   renameProject: Function,
 *   updateProjectClient: Function,
 *   updateProjectBilling: Function,
 * }} workspace
 * @param {{
 *   projectId: string | null,
 *   baseline: object | null,
 *   draft: object,
 * }} input
 */
export async function saveProjectEditor(workspace, { projectId, baseline, draft }) {
  const patch = dirtyProjectEditorPatch(baseline, draft)
  if (!projectId) {
    const project = await workspace.createProject({ name: patch.name })
    if ('clientId' in patch) await workspace.updateProjectClient(project.id, patch.clientId)
    if (patch.billing) await workspace.updateProjectBilling(project.id, patch.billing)
    return project
  }
  if (patch.name) await workspace.renameProject(projectId, patch.name)
  if ('clientId' in patch) await workspace.updateProjectClient(projectId, patch.clientId)
  if (patch.billing) await workspace.updateProjectBilling(projectId, patch.billing)
}
