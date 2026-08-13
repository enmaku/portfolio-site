/**
 * Pure launch config / timer export shapes for Game Manager ↔ Game Timer handoff.
 */

/**
 * @typedef {object} LaunchConfigSeat
 * @property {string} recordedPlayerId
 * @property {string} name
 * @property {string} color
 */

/**
 * @typedef {object} LaunchConfig
 * @property {LaunchConfigSeat[]} seats
 */

/**
 * @typedef {object} TimerExportSeat
 * @property {string} [recordedPlayerId]
 * @property {string} name
 * @property {string} color
 * @property {number} bankedMs
 */

/**
 * @typedef {object} TimerExport
 * @property {number} durationMs
 * @property {TimerExportSeat[]} seats
 */

/**
 * @param {Array<{ recordedPlayerId: string, name: string, color: string }>} presentPlayers
 * @returns {LaunchConfig}
 */
export function buildLaunchConfigFromPresentPlayers(presentPlayers) {
  const list = Array.isArray(presentPlayers) ? presentPlayers : []
  return {
    seats: list.map((p) => ({
      recordedPlayerId: p.recordedPlayerId,
      name: p.name,
      color: p.color,
    })),
  }
}

/**
 * Restore a linked timer from a stored **timer export** (roster + banked times + duration).
 * @param {unknown} timerExport
 * @returns {(LaunchConfig & { durationMs: number, seats: Array<LaunchConfigSeat & { bankedMs: number }> }) | null}
 */
export function buildLaunchConfigFromTimerExport(timerExport) {
  const normalized = normalizeTimerExport(timerExport)
  if (!normalized) return null
  return {
    durationMs: normalized.durationMs,
    seats: normalized.seats.map((s) => {
      /** @type {LaunchConfigSeat & { bankedMs: number }} */
      const seat = {
        name: s.name,
        color: s.color,
        bankedMs: s.bankedMs,
      }
      if (typeof s.recordedPlayerId === 'string' && s.recordedPlayerId) {
        seat.recordedPlayerId = s.recordedPlayerId
      }
      return seat
    }),
  }
}

/**
 * @param {unknown} raw
 * @returns {TimerExport | null}
 */
export function normalizeTimerExport(raw) {
  if (!raw || typeof raw !== 'object') return null
  const durationMs = /** @type {{ durationMs?: unknown }} */ (raw).durationMs
  const seatsRaw = /** @type {{ seats?: unknown }} */ (raw).seats
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) return null
  if (!Array.isArray(seatsRaw)) return null
  /** @type {TimerExportSeat[]} */
  const seats = []
  for (const s of seatsRaw) {
    if (!s || typeof s !== 'object') return null
    const name = /** @type {{ name?: unknown }} */ (s).name
    const color = /** @type {{ color?: unknown }} */ (s).color
    const bankedMs = /** @type {{ bankedMs?: unknown }} */ (s).bankedMs
    if (typeof name !== 'string' || typeof color !== 'string') return null
    if (typeof bankedMs !== 'number' || !Number.isFinite(bankedMs) || bankedMs < 0) return null
    /** @type {TimerExportSeat} */
    const seat = { name, color, bankedMs }
    const rid = /** @type {{ recordedPlayerId?: unknown }} */ (s).recordedPlayerId
    if (typeof rid === 'string' && rid) seat.recordedPlayerId = rid
    seats.push(seat)
  }
  return { durationMs, seats }
}
