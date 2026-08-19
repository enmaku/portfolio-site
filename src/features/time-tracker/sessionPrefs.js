import { TRACKER_SURFACES } from './composables/trackerSurfaces.js'
import { DEFAULT_TIMER_COLOR, parseTimerColor } from './timerAccent.js'

export const TRACKER_SURFACE_IDS = TRACKER_SURFACES.map((item) => item.id)

/**
 * @returns {{
 *   issuerName: string,
 *   activeSurface: string,
 *   selectedProjectId: string | null,
 *   description: string,
 *   runningTimer: { projectId: string, startedAt: number, description: string } | null,
 *   timerColor: string,
 * }}
 */
export function defaultOwnerPrefs() {
  return {
    issuerName: '',
    activeSurface: 'timer',
    selectedProjectId: null,
    description: '',
    runningTimer: null,
    timerColor: DEFAULT_TIMER_COLOR,
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeActiveSurface(value) {
  return TRACKER_SURFACE_IDS.includes(value) ? value : 'timer'
}

/**
 * @param {unknown} raw
 * @returns {{ projectId: string, startedAt: number, description: string } | null}
 */
export function normalizeRunningTimer(raw) {
  if (!raw || typeof raw !== 'object') return null
  const projectId = String(/** @type {{ projectId?: unknown }} */ (raw).projectId || '')
  const startedAt = /** @type {{ startedAt?: unknown }} */ (raw).startedAt
  if (!projectId || typeof startedAt !== 'number' || !Number.isFinite(startedAt)) return null
  return {
    projectId,
    startedAt,
    description: String(/** @type {{ description?: unknown }} */ (raw).description || ''),
  }
}

/**
 * @param {unknown} raw
 */
export function normalizeOwnerPrefs(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const selected = /** @type {{ selectedProjectId?: unknown }} */ (src).selectedProjectId
  const surface = /** @type {{ activeSurface?: unknown }} */ (src).activeSurface
  const color = /** @type {{ timerColor?: unknown }} */ (src).timerColor
  return {
    issuerName: String(/** @type {{ issuerName?: unknown }} */ (src).issuerName || ''),
    activeSurface: normalizeActiveSurface(surface),
    selectedProjectId: selected ? String(selected) : null,
    description: String(/** @type {{ description?: unknown }} */ (src).description || ''),
    runningTimer: normalizeRunningTimer(/** @type {{ runningTimer?: unknown }} */ (src).runningTimer),
    timerColor: parseTimerColor(color) ?? DEFAULT_TIMER_COLOR,
  }
}

/**
 * @param {{ sessionName?: unknown, storeName?: unknown, defaultName?: unknown, hasSession?: boolean }} input
 * @returns {string}
 */
export function resolveIssuerName(input) {
  if (input.hasSession) return String(input.sessionName || '').trim()
  const stored = String(input.storeName || '').trim()
  if (stored) return stored
  return String(input.defaultName || '').trim()
}

/**
 * @param {{ preferredId?: string | null, fallbackId?: string | null, projectIds: string[] }} input
 * @returns {string | null}
 */
export function resolveSelectedProjectId(input) {
  const ids = input.projectIds
  if (input.preferredId && ids.includes(input.preferredId)) return input.preferredId
  if (input.fallbackId && ids.includes(input.fallbackId)) return input.fallbackId
  return ids[0] || null
}
