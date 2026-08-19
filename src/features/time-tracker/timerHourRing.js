export const MS_PER_HOUR = 3_600_000
export const TIMER_RING_RADIUS = 42
export const TIMER_RING_CENTER = 50

/**
 * @param {number} elapsedMs
 * @returns {{ fillFraction: number, markerFraction: number, completedHours: number }}
 */
export function timerHourRing(elapsedMs) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0)
  return {
    fillFraction: Math.min(1, elapsed / MS_PER_HOUR),
    markerFraction: (elapsed % MS_PER_HOUR) / MS_PER_HOUR,
    completedHours: Math.floor(elapsed / MS_PER_HOUR),
  }
}

/**
 * Point on the timer ring. Fraction 0 is 12:00, 0.25 is 3:00.
 *
 * @param {number} fraction
 * @param {number} [radius]
 * @returns {{ x: number, y: number }}
 */
export function ringPoint(fraction, radius = TIMER_RING_RADIUS) {
  const angle = fraction * 2 * Math.PI - Math.PI / 2
  return {
    x: TIMER_RING_CENTER + radius * Math.cos(angle),
    y: TIMER_RING_CENTER + radius * Math.sin(angle),
  }
}

/**
 * @param {number} radius
 */
export function ringCircumference(radius = TIMER_RING_RADIUS) {
  return 2 * Math.PI * radius
}
