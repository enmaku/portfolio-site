/**
 * Pure view-models for the breakdown bottom sheet (tap-to-explain). No Vue here.
 * @typedef {{ label: string, amount: number, type: string }} BreakdownLine
 * @typedef {{ value: number, breakdown: BreakdownLine[], actions?: any[] }} Stat
 */

const PLAIN_LABELS = new Set(['Untrained', 'Other (from Pathbuilder)'])

/**
 * @param {number} n
 * @param {boolean} signed Bonuses show +n / −n; flat totals (AC, DC, Speed) show bare numbers.
 */
export function formatAmount(n, signed = true) {
  if (!signed) return n < 0 ? `−${-n}` : String(n)
  return n < 0 ? `−${-n}` : `+${n}`
}

/**
 * @param {string} title Stat name for the sheet header.
 * @param {Stat} stat
 * @param {{ signed?: boolean }} [opts] `signed: false` for flat totals such as AC.
 */
export function breakdownView(title, stat, { signed = true } = {}) {
  return {
    title,
    total: formatAmount(stat.value, signed),
    rows: stat.breakdown.map((b) => {
      const plain = PLAIN_LABELS.has(b.label)
      return {
        label: b.label,
        amount: formatAmount(b.amount, signed),
        chip: plain ? null : b.type,
        plain,
      }
    }),
    actions: stat.actions ?? [],
  }
}
