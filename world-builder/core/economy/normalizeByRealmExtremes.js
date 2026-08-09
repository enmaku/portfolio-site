/**
 * Signed and anchored normalization for economy inspect overlays.
 * Domain: world-builder/CONTEXT.md — wealth overlay, port toll overlay, commodity price overlay.
 */

/**
 * Map values onto [-1, 1] relative to an anchor: below → red, above → green, at anchor → gray.
 * Magnitude stretches so the living cohort extreme |value − anchor| hits full tint.
 * When every finite value equals the anchor, every entry is 0.
 *
 * @param {ReadonlyArray<number>} values
 * @param {number} [anchor=0]
 * @returns {number[]}
 */
export function normalizeAroundAnchor(values, anchor = 0) {
  if (!Array.isArray(values) || values.length === 0) {
    return []
  }
  const center = Number.isFinite(anchor) ? anchor : 0
  let maxAbs = 0
  for (const value of values) {
    if (!Number.isFinite(value)) continue
    maxAbs = Math.max(maxAbs, Math.abs(value - center))
  }
  const scale = maxAbs > 0 ? maxAbs : 1
  return values.map((value) => {
    if (!Number.isFinite(value)) return 0
    return (value - center) / scale
  })
}

/**
 * Map a cohort of finite values onto [-1, 1] so the lowest is full red and the
 * highest is full green under the stained-glass ramp; midpoint → 0 (gray).
 * When all values are equal, every entry is 0.
 *
 * @param {ReadonlyArray<number>} values
 * @returns {number[]}
 */
export function normalizeByRealmExtremes(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return []
  }
  let min = Infinity
  let max = -Infinity
  for (const value of values) {
    if (!Number.isFinite(value)) continue
    if (value < min) min = value
    if (value > max) max = value
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return values.map(() => 0)
  }
  const halfRange = (max - min) / 2
  if (!(halfRange > 0)) {
    return values.map(() => 0)
  }
  const mid = (min + max) / 2
  return values.map((value) => {
    if (!Number.isFinite(value)) return 0
    return (value - mid) / halfRange
  })
}
