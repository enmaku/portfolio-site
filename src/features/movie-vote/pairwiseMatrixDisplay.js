/**
 * Pure helpers for Condorcet pairwise matrix cells (glyph, class, aria).
 */

/**
 * @param {import('./condorcet.js').PairwiseOutcome | undefined} outcome
 * @returns {string}
 */
export function pairwiseCellGlyph(outcome) {
  if (outcome === 'win') return '✓'
  if (outcome === 'loss') return '✗'
  if (outcome === 'tie') return '='
  return '·'
}

/**
 * @param {string} rowId
 * @param {string} colId
 * @param {import('./condorcet.js').PairwiseMatrix['cells'] | undefined} cells
 * @returns {string}
 */
export function pairwiseCellCssClass(rowId, colId, cells) {
  if (rowId === colId) return 'mv-pairwise__cell--diag'
  const outcome = cells?.[rowId]?.[colId]
  return outcome ? `mv-pairwise__cell--${outcome}` : ''
}

/**
 * @param {string} rowTitle
 * @param {string} colTitle
 * @param {import('./condorcet.js').PairwiseOutcome | undefined} outcome
 * @returns {string}
 */
export function pairwiseCellAriaLabel(rowTitle, colTitle, outcome) {
  if (outcome === 'win') return `${rowTitle} beats ${colTitle} head-to-head`
  if (outcome === 'loss') return `${rowTitle} loses to ${colTitle} head-to-head`
  if (outcome === 'tie') return `${rowTitle} tied with ${colTitle} head-to-head`
  return `${rowTitle} vs ${colTitle}`
}
