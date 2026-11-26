/** Bottom-bar tabs in display order. Each key names a screen component (see ../screens). */
export const TABS = [
  { key: 'stats', label: 'Stats', icon: 'monitor_heart' },
  { key: 'skills', label: 'Skills', icon: 'psychology' },
  { key: 'gear', label: 'Gear', icon: 'backpack' },
  { key: 'spells', label: 'Spells', icon: 'auto_awesome' },
  { key: 'actions', label: 'Actions', icon: 'bolt' },
]

/** @param {any} sheet */
export function hasSpells(sheet) {
  const s = sheet?.spells
  return Boolean(s && (s.casters?.length > 0 || s.focus || s.rituals?.length > 0))
}

/**
 * Tabs the bar shows for this sheet: Spells is hidden when there are no spells, rituals or focus.
 * @param {any} sheet
 */
export function visibleTabs(sheet) {
  return TABS.filter((t) => t.key !== 'spells' || hasSpells(sheet))
}

const FUNCTION_NAME = 'critcrafterSheet'

/**
 * Sheet function URL. `base` (VITE_CRITCRAFTER_FUNCTIONS_BASE) overrides, including for the
 * emulator (`http://127.0.0.1:5001/<project>/us-central1`); else derived from the Firebase project.
 * @param {{ base?: string, projectId?: string }} env
 * @returns {string} Empty when unconfigured.
 */
export function resolveSheetFunctionUrl({ base, projectId } = {}) {
  const b = String(base ?? '').trim().replace(/\/+$/, '')
  if (b) return `${b}/${FUNCTION_NAME}`
  const p = String(projectId ?? '').trim()
  return p ? `https://us-central1-${p}.cloudfunctions.net/${FUNCTION_NAME}` : ''
}
