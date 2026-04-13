/**
 * @import './types.js'
 * Pure Game Timer helpers: duration formatting, progress math, bar colors, player ids.
 */

/** @type {readonly string[]} Default hex palette for new players. */
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

/**
 * @returns {string}
 */
export function createPlayerId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * @param {number} n
 * @returns {number}
 */
function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

/**
 * Parse `#RRGGBB` into RGB channels (fallback gray if invalid).
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

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
function rgbToHex(r, g, b) {
  return '#' + [clampByte(r), clampByte(g), clampByte(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

/**
 * Linear blend of `hex` toward RGB target; `amount` in [0, 1].
 * @param {string} hex
 * @param {number} tr
 * @param {number} tg
 * @param {number} tb
 * @param {number} amount
 * @returns {string}
 */
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
  return isDark ? mixToward(hex, 52, 56, 70, 0.68) : mixToward(hex, 238, 240, 246, 0.38)
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
 * Stable string key for a round index (minimum round 1).
 * @param {number} round
 * @returns {string}
 */
function roundStorageKey(round) {
  return String(Math.max(1, Math.floor(Number(round)) || 1))
}

/**
 * Banked time for one round only (excludes any live segment).
 * @param {GameTimerPlayer} player
 * @param {number} round
 * @returns {number}
 */
export function bankedMsInRound(player, round) {
  const map = player.bankedMsByRound
  if (!map || typeof map !== 'object') return 0
  return map[roundStorageKey(round)] ?? 0
}

/**
 * All-time displayed ms (all rounds): banked + optional live segment.
 * @param {GameTimerPlayer} player
 * @param {{ activePlayerId: string | null, turnStartedAt: number | null }} session
 * @param {number} nowMs
 * @returns {number}
 */
export function displayedMsForPlayer(player, session, nowMs) {
  let ms = player.bankedMs
  if (session.activePlayerId === player.id && session.turnStartedAt != null) {
    ms += Math.max(0, nowMs - session.turnStartedAt)
  }
  return ms
}

/**
 * Displayed ms for `currentRound` only (banked in that round + live segment if it started in that round).
 * @param {GameTimerPlayer} player
 * @param {{ activePlayerId: string | null, turnStartedAt: number | null, turnStartedRound: number | null }} session
 * @param {number} nowMs
 * @param {number} currentRound
 * @returns {number}
 */
export function displayedMsForPlayerInRound(player, session, nowMs, currentRound) {
  const key = roundStorageKey(currentRound)
  let ms = bankedMsInRound(player, currentRound)
  if (
    session.activePlayerId === player.id &&
    session.turnStartedAt != null &&
    session.turnStartedRound != null &&
    roundStorageKey(session.turnStartedRound) === key
  ) {
    ms += Math.max(0, nowMs - session.turnStartedAt)
  }
  return ms
}

/**
 * Largest {@link displayedMsForPlayer} among `players` (0 if empty).
 * @param {GameTimerPlayer[]} players
 * @param {{ activePlayerId: string | null, turnStartedAt: number | null }} session
 * @param {number} nowMs
 * @returns {number}
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
 * Largest {@link displayedMsForPlayerInRound} among `players` (0 if empty).
 * @param {GameTimerPlayer[]} players
 * @param {{ activePlayerId: string | null, turnStartedAt: number | null, turnStartedRound: number | null }} session
 * @param {number} nowMs
 * @param {number} currentRound
 * @returns {number}
 */
export function maxDisplayedMsInRound(players, session, nowMs, currentRound) {
  if (!players.length) return 0
  let max = 0
  for (const p of players) {
    const v = displayedMsForPlayerInRound(p, session, nowMs, currentRound)
    if (v > max) max = v
  }
  return max
}

/**
 * Fill width ratio in [0, 1] for progress bars.
 * @param {number} displayedMs
 * @param {number} maxMs
 * @returns {number}
 */
export function progressRatio(displayedMs, maxMs) {
  if (maxMs <= 0) return 0
  return Math.min(1, displayedMs / maxMs)
}

/**
 * Next unused palette color for a new player (cycles if all are taken).
 * @param {GameTimerPlayer[]} players
 * @returns {string} Hex color.
 */
export function nextDefaultColor(players) {
  const list = Array.isArray(players) ? players : []
  const used = new Set()
  for (const p of list) {
    if (p && typeof p.color === 'string' && p.color.trim()) {
      used.add(p.color.trim().toLowerCase())
    }
  }
  for (const c of DEFAULT_PLAYER_COLORS) {
    if (!used.has(c.toLowerCase())) return c
  }
  const i = list.length % DEFAULT_PLAYER_COLORS.length
  return DEFAULT_PLAYER_COLORS[i]
}

/**
 * `m:ss` or `h:mm:ss` for display in the list UI.
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

