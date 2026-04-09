/** @import './types.js' */

/** Default palette for new players (hex). */
export const DEFAULT_PLAYER_COLORS = [
  '#5c6bc0',
  '#26a69a',
  '#ef5350',
  '#ffa726',
  '#ab47bc',
  '#42a5f5',
  '#66bb6a',
  '#ec407a',
]

export function createPlayerId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

/**
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
function hexToRgb(hex) {
  const h = String(hex).trim().replace(/^#/, '')
  if (h.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(h)) {
    return { r: 128, g: 128, b: 128 }
  }
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHex(r, g, b) {
  return '#' + [clampByte(r), clampByte(g), clampByte(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

function mixToward(hex, tr, tg, tb, amount) {
  const t = Math.max(0, Math.min(1, amount))
  const { r, g, b } = hexToRgb(hex)
  return rgbToHex(r + (tr - r) * t, g + (tg - g) * t, b + (tb - b) * t)
}

/**
 * Full-width progress track: dark-tinted player hue (dark UI) or pale tint (light UI).
 * @param {string} hex
 * @param {boolean} isDark
 * @returns {string}
 */
export function playerBarTrackColor(hex, isDark) {
  return isDark ? mixToward(hex, 22, 24, 32, 0.78) : mixToward(hex, 238, 240, 246, 0.38)
}

/**
 * Progress fill: brighter / more vivid than {@link playerBarTrackColor} for the same player.
 * @param {string} hex
 * @param {boolean} isDark
 * @returns {string}
 */
export function playerBarFillColor(hex, isDark) {
  return isDark ? mixToward(hex, 255, 255, 255, 0.34) : mixToward(hex, 255, 255, 255, 0.12)
}

/**
 * Slightly darker than {@link playerBarTrackColor} for the unfilled part of the thin bottom bar.
 * @param {string} hex
 * @param {boolean} isDark
 * @returns {string}
 */
export function playerBarRailColor(hex, isDark) {
  const track = playerBarTrackColor(hex, isDark)
  return isDark ? mixToward(track, 0, 0, 0, 0.52) : mixToward(track, 150, 152, 160, 0.38)
}

/**
 * @param {GameTimerPlayer} player
 * @param {{ activePlayerId: string | null, turnStartedAt: number | null }} session
 * @param {number} nowMs
 */
export function displayedMsForPlayer(player, session, nowMs) {
  let ms = player.bankedMs
  if (session.activePlayerId === player.id && session.turnStartedAt != null) {
    ms += Math.max(0, nowMs - session.turnStartedAt)
  }
  return ms
}

/**
 * @param {GameTimerPlayer[]} players
 * @param {{ activePlayerId: string | null, turnStartedAt: number | null }} session
 * @param {number} nowMs
 */
export function maxDisplayedMs(players, session, nowMs) {
  if (!players.length) return 0
  let max = 0
  for (const p of players) {
    const v = displayedMsForPlayer(p, session, nowMs)
    if (v > max) max = v
  }
  return max
}

/**
 * @param {number} displayedMs
 * @param {number} maxMs
 * @returns {number} in [0, 1]
 */
export function progressRatio(displayedMs, maxMs) {
  if (maxMs <= 0) return 0
  return Math.min(1, displayedMs / maxMs)
}

/**
 * @param {GameTimerPlayer[]} players
 * @returns {string}
 */
export function nextDefaultColor(players) {
  const used = new Set(players.map((p) => p.color.toLowerCase()))
  for (const c of DEFAULT_PLAYER_COLORS) {
    if (!used.has(c.toLowerCase())) return c
  }
  const i = players.length % DEFAULT_PLAYER_COLORS.length
  return DEFAULT_PLAYER_COLORS[i]
}

/**
 * @param {number} ms
 * @returns {string}
 */
export function formatDurationMs(ms) {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

