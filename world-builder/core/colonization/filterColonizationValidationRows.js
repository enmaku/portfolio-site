/** Colonization-relevant generation checks (founding, survival, logistics, sail). */
export const COLONIZATION_RELEVANT_CHECK_IDS = new Set([
  'navigableRiverQuota',
  'coastMouth',
  'coastConnectedNavigablePath',
  'endorheicFractionCap',
  'salinityOceanGradient',
  'arableEnvelopeCoverage',
  'saltNodeLandProximity',
  'strategicResourceSpacing',
  'resourceMismatch',
])

export const COLONIZATION_GAP_CHECK_IDS = {
  weakSailOverlayForLanding: 'colonizationWeakSailOverlayForLanding',
  noFreshwaterBands: 'colonizationNoFreshwaterBands',
}

/**
 * @typedef {Object} ColonizationGeographyGaps
 * @property {number=} sailLandingCellCount
 * @property {boolean=} hasFreshwaterBands
 */

/**
 * @param {Array<{ checkId: string, status: string, summary?: string, [key: string]: unknown }>} rows
 * @param {ColonizationGeographyGaps} [gaps]
 * @returns {Array<{ checkId: string, status: 'pass' | 'warn' | 'fail', summary: string, [key: string]: unknown }>}
 */
export function filterColonizationValidationRows(rows, gaps = {}) {
  const relevant = (rows ?? [])
    .filter(
      (row) =>
        COLONIZATION_RELEVANT_CHECK_IDS.has(row.checkId) &&
        (row.status === 'warn' || row.status === 'fail'),
    )
    .map((row) => ({ ...row }))

  return [...relevant, ...buildColonizationGapRows(gaps)]
}

/**
 * @param {ColonizationGeographyGaps} gaps
 * @returns {Array<{ checkId: string, status: 'warn' | 'fail', summary: string }>}
 */
function buildColonizationGapRows(gaps) {
  /** @type {Array<{ checkId: string, status: 'warn' | 'fail', summary: string, label: string }>} */
  const gapRows = []

  if (typeof gaps.sailLandingCellCount === 'number' && gaps.sailLandingCellCount <= 0) {
    gapRows.push({
      checkId: COLONIZATION_GAP_CHECK_IDS.weakSailOverlayForLanding,
      status: 'fail',
      label: 'Sail overlay for landing',
      summary: 'No sail-reachable coast or river mouth for a founding landing.',
    })
  }

  if (gaps.hasFreshwaterBands === false) {
    gapRows.push({
      checkId: COLONIZATION_GAP_CHECK_IDS.noFreshwaterBands,
      status: 'warn',
      label: 'Freshwater bands',
      summary: 'No rivers, lakes, or coastal freshwater bands were found.',
    })
  }

  return gapRows
}

/**
 * @param {Array<{ status: string }>} advisoryRows
 * @returns {boolean}
 */
export function colonizationAdvisoryRequiresConfirm(advisoryRows) {
  return (advisoryRows ?? []).some((row) => row.status === 'fail')
}

/**
 * @param {import('../types.js').WorldDocument | null | undefined} doc
 * @returns {ColonizationGeographyGaps}
 */
export function resolveColonizationGeographyGaps(doc) {
  if (!doc?.generationReport) {
    return {}
  }

  const sailLandingCellCount =
    doc.generationReport.validationSignals?.movement?.largestSailComponentCellCount ??
    doc.generationReport.largestSailComponentCellCount ??
    0

  const hasFreshwaterBands = Boolean(
    doc.lakeMask?.some((value) => value > 0) ||
      doc.simulationRiverMask?.some((value) => value > 0) ||
      doc.coastalNodes?.length,
  )

  return {
    sailLandingCellCount,
    hasFreshwaterBands,
  }
}
