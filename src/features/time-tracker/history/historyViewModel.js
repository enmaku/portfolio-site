import { durationMs, isTimeEntryMutable } from '../domain/timeEntries.js'

/**
 * @param {{
 *   timeEntries: object[],
 *   runningTimer: { projectId: string, startedAt: number, description?: string } | null,
 *   now: number,
 * }} input
 */
export function historyViewModel(input) {
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
    .map((entry) => ({
      ...entry,
      kind: 'entry',
      durationMs: durationMs(entry),
      mutable: isTimeEntryMutable(entry),
    }))

  return { pinned, rows }
}
