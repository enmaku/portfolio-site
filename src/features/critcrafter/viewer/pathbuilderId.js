/**
 * Pathbuilder id parsing (same rules as Strength of Thousands' `parsePathbuilderId`):
 * a bare run of digits, or any URL carrying `?id=<digits>`.
 * @param {unknown} input
 * @returns {string | null} Normalised numeric id, or null when the input is not an id.
 */
export function parsePathbuilderId(input) {
  const trimmed = String(input ?? '').trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) return String(Number(trimmed))
  try {
    const id = new URL(trimmed).searchParams.get('id')
    if (id && /^\d+$/.test(id)) return String(Number(id))
  } catch {
    // not a URL
  }
  return null
}

/** @param {string} id */
export function pathbuilderJsonUrl(id) {
  return `https://pathbuilder2e.com/json.php?id=${id}`
}
