/**
 * @typedef {{ projectId: string, startedAt: number, description: string }} RunningTimer
 * @typedef {{ projectId: string, startedAt: number, endedAt: number, description: string }} CompletedTimeEntry
 */

/**
 * @param {{
 *   projectId: string,
 *   startedAt: number,
 *   description?: string,
 *   existing?: RunningTimer | null,
 * }} input
 * @returns {RunningTimer}
 */
export function startRunningTimer(input) {
  if (input?.existing) {
    throw new Error('A running timer already exists')
  }
  const projectId = String(input?.projectId || '').trim()
  if (!projectId) {
    throw new Error('A project is required to start a running timer')
  }
  if (typeof input?.startedAt !== 'number' || !Number.isFinite(input.startedAt)) {
    throw new Error('startedAt is required')
  }
  return {
    projectId,
    startedAt: input.startedAt,
    description: String(input.description || ''),
  }
}

/**
 * @param {RunningTimer} running
 * @param {{ endedAt: number }} input
 * @returns {{ discarded: true, timeEntry: null } | { discarded: false, timeEntry: CompletedTimeEntry }}
 */
export function completeRunningTimer(running, input) {
  if (!running) {
    throw new Error('No running timer')
  }
  const endedAt = input?.endedAt
  if (typeof endedAt !== 'number' || !Number.isFinite(endedAt)) {
    throw new Error('endedAt is required')
  }
  const durationMs = endedAt - running.startedAt
  if (durationMs < 1000) {
    return { discarded: true, timeEntry: null }
  }
  return {
    discarded: false,
    timeEntry: {
      projectId: running.projectId,
      startedAt: running.startedAt,
      endedAt,
      description: running.description || '',
    },
  }
}

/**
 * @param {RunningTimer} running
 * @param {{ projectId: string, at: number, description?: string }} input
 */
export function switchRunningTimerProject(running, input) {
  const completed = completeRunningTimer(running, { endedAt: input.at })
  const nextRunning = startRunningTimer({
    projectId: input.projectId,
    startedAt: input.at,
    description: input.description || '',
  })
  return { completed, nextRunning }
}
