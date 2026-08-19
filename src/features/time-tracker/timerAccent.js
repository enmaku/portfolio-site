/** Default Timer face color (Material orange 900). */
export const DEFAULT_TIMER_COLOR = '#e65100'

/**
 * @param {unknown} hex
 * @returns {string | null}
 */
export function parseTimerColor(hex) {
  const raw = String(hex ?? '')
    .trim()
    .replace(/^#/, '')
  if (raw.length === 8 && /^[0-9A-Fa-f]{8}$/.test(raw)) {
    return `#${raw.slice(0, 6).toLowerCase()}`
  }
  if (raw.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(raw)) return null
  return `#${raw.toLowerCase()}`
}

/**
 * @param {unknown} hex
 * @returns {string}
 */
export function normalizeTimerColor(hex) {
  return parseTimerColor(hex) ?? DEFAULT_TIMER_COLOR
}

/**
 * @param {number} n
 * @returns {number}
 */
function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)))
}

/**
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number }}
 */
function hexToRgb(hex) {
  const n = parseInt(normalizeTimerColor(hex).slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {string}
 */
function rgbToHex(r, g, b) {
  return `#${[clampByte(r), clampByte(g), clampByte(b)].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

/**
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
 * @param {{ r: number, g: number, b: number }} rgb
 * @returns {number}
 */
function relativeLuminance(rgb) {
  const lin = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b)
}

/**
 * CSS custom properties for the Timer face from a chosen button hex.
 * @param {unknown} hex
 * @param {boolean} isDark
 * @returns {Record<string, string>}
 */
export function timerAccentVars(hex, isDark) {
  const color = normalizeTimerColor(hex)
  const { r, g, b } = hexToRgb(color)
  const lightInk = relativeLuminance({ r, g, b }) > 0.55
  return {
    '--tt-accent-track': `rgba(${r}, ${g}, ${b}, ${isDark ? 0.35 : 0.28})`,
    '--tt-accent-fill': mixToward(color, 255, 255, 255, isDark ? 0.28 : 0.18),
    '--tt-accent-fill-complete': mixToward(color, 255, 255, 255, isDark ? 0.12 : 0.06),
    '--tt-accent-btn': color,
    '--tt-accent-btn-hover': mixToward(color, 255, 255, 255, 0.16),
    '--tt-accent-ink': lightInk ? '#3e2723' : '#fff4e5',
    '--tt-accent-marker': isDark ? mixToward(color, 255, 255, 255, 0.55) : color,
  }
}
