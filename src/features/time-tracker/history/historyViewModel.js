import { durationMs, isTimeEntryMutable } from '../domain/timeEntries.js'
import { isPerJobBillable } from '../domain/projects.js'

/**
 * @param {{
 *   timeEntries: object[],
 *   projects?: object[],
 *   runningTimer: { projectId: string, startedAt: number, description?: string } | null,
 *   now: number,
 * }} input
 */
export function historyViewModel(input) {
  const projectById = new Map((input.projects ?? []).map((project) => [project.id, project]))
  const pinned = input.runningTimer
    ? {
        kind: 'running',
        projectId: input.runningTimer.projectId,
        startedAt: input.runningTimer.startedAt,
        description: input.runningTimer.description || '',
        durationMs: input.now - input.runningTimer.startedAt,
        mutable: false,
      }
    : null

  const rows = [...(input.timeEntries ?? [])]
    .sort((left, right) => right.startedAt - left.startedAt)
    .map((entry) => {
      const project = projectById.get(entry.projectId)
      const showEarnings =
        isPerJobBillable(project) && entry.earningsUsdCents != null
      return {
        ...entry,
        kind: 'entry',
        durationMs: durationMs(entry),
        mutable: isTimeEntryMutable(entry),
        earningsUsdCents: showEarnings ? entry.earningsUsdCents : null,
      }
    })

  return { pinned, rows }
}
