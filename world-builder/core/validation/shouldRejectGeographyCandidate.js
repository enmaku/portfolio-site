import {
  collectStructuredRejectionReasons,
  isRejectionSamplingEnforced,
} from './landmassValidationContracts.js'

/**
 * @param {import('../types.js').ValidationRow[]} validationRows
 */
export function shouldRejectGeographyCandidate(validationRows) {
  return validationRows.some((row) => row.status === 'fail')
}

/**
 * @param {import('../types.js').ValidationRow[]} validationRows
 * @returns {string[]}
 */
export function collectRejectionReasons(validationRows) {
  return validationRows
    .filter((row) => row.status === 'fail')
    .map((row) => `${row.checkId}: ${row.summary}`)
}

export { collectStructuredRejectionReasons, isRejectionSamplingEnforced }
