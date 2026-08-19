export function runningTimerStorageKey(ownerUid) {
  return `time-tracker:running-timer:${ownerUid}`
}

/**
 * @param {{ ownerUid: string, storage: { getItem: (key: string) => string | null } }} input
 * @returns {{ projectId: string, startedAt: number, description: string } | null}
 */
export function loadRunningTimer(input) {
  const raw = input.storage.getItem(runningTimerStorageKey(input.ownerUid))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed?.projectId || typeof parsed.startedAt !== 'number') return null
    return {
      projectId: String(parsed.projectId),
      startedAt: parsed.startedAt,
      description: String(parsed.description || ''),
    }
  } catch {
    return null
  }
}

/**
 * @param {{
 *   ownerUid: string,
 *   running: { projectId: string, startedAt: number, description?: string },
 *   storage: { setItem: (key: string, value: string) => void },
 * }} input
 */
export function saveRunningTimer(input) {
  input.storage.setItem(
    runningTimerStorageKey(input.ownerUid),
    JSON.stringify({
      projectId: input.running.projectId,
      startedAt: input.running.startedAt,
      description: input.running.description || '',
    }),
  )
}

/**
 * @param {{ ownerUid: string, storage: { removeItem: (key: string) => void } }} input
 */
export function clearRunningTimer(input) {
  input.storage.removeItem(runningTimerStorageKey(input.ownerUid))
}

/**
 * @param {{ writeSucceeded: boolean }} input
 * @returns {'clear' | 'keep'}
 */
export function decideSignOutRunningTimer(input) {
  return input.writeSucceeded ? 'clear' : 'keep'
}
