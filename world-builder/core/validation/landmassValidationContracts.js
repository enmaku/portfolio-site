/** @typedef {import('../types.js').WorldGenerationOptions} WorldGenerationOptions */

/**
 * @typedef {'hydrology' | 'coast' | 'climate' | 'resources' | 'landmassPlausibility'} ValidationSignalCategory
 */

/**
 * @typedef {Object} ValidationCheckContract
 * @property {string} checkId
 * @property {ValidationSignalCategory} category
 * @property {boolean} rejectable
 * @property {keyof WorldGenerationOptions | null} enforceOptionKey
 */

/**
 * @typedef {Object} StructuredRejectionReason
 * @property {string} checkId
 * @property {ValidationSignalCategory} category
 */

/** @type {readonly string[]} */
export const VALIDATION_CHECK_IDS = [
  'navigableRiverQuota',
  'coastMouth',
  'hacksLawExponent',
  'slopeAreaConcavity',
  'parallelStrandRatio',
  'coastConnectedNavigablePath',
  'endorheicFractionCap',
  'salinityOceanGradient',
  'highlandPresence',
  'biomeDiversity',
  'windRainfallAsymmetry',
  'resourceMismatch',
  'arableEnvelopeCoverage',
  'saltNodeLandProximity',
  'strategicResourceSpacing',
]

/** @type {Record<string, ValidationCheckContract>} */
export const VALIDATION_CHECK_CONTRACTS = {
  navigableRiverQuota: {
    checkId: 'navigableRiverQuota',
    category: 'hydrology',
    rejectable: true,
    enforceOptionKey: 'enforceNavigableRiverQuota',
  },
  coastMouth: {
    checkId: 'coastMouth',
    category: 'coast',
    rejectable: true,
    enforceOptionKey: 'enforceCoastMouth',
  },
  hacksLawExponent: {
    checkId: 'hacksLawExponent',
    category: 'hydrology',
    rejectable: true,
    enforceOptionKey: 'enforceHacksLawExponent',
  },
  slopeAreaConcavity: {
    checkId: 'slopeAreaConcavity',
    category: 'hydrology',
    rejectable: true,
    enforceOptionKey: 'enforceSlopeAreaConcavity',
  },
  parallelStrandRatio: {
    checkId: 'parallelStrandRatio',
    category: 'hydrology',
    rejectable: true,
    enforceOptionKey: 'enforceParallelStrandRatio',
  },
  coastConnectedNavigablePath: {
    checkId: 'coastConnectedNavigablePath',
    category: 'coast',
    rejectable: true,
    enforceOptionKey: 'enforceCoastConnectedNavigablePath',
  },
  endorheicFractionCap: {
    checkId: 'endorheicFractionCap',
    category: 'hydrology',
    rejectable: true,
    enforceOptionKey: 'enforceEndorheicFractionCap',
  },
  salinityOceanGradient: {
    checkId: 'salinityOceanGradient',
    category: 'resources',
    rejectable: false,
    enforceOptionKey: null,
  },
  highlandPresence: {
    checkId: 'highlandPresence',
    category: 'landmassPlausibility',
    rejectable: false,
    enforceOptionKey: null,
  },
  biomeDiversity: {
    checkId: 'biomeDiversity',
    category: 'landmassPlausibility',
    rejectable: false,
    enforceOptionKey: null,
  },
  windRainfallAsymmetry: {
    checkId: 'windRainfallAsymmetry',
    category: 'climate',
    rejectable: false,
    enforceOptionKey: null,
  },
  resourceMismatch: {
    checkId: 'resourceMismatch',
    category: 'resources',
    rejectable: false,
    enforceOptionKey: null,
  },
  arableEnvelopeCoverage: {
    checkId: 'arableEnvelopeCoverage',
    category: 'resources',
    rejectable: false,
    enforceOptionKey: null,
  },
  saltNodeLandProximity: {
    checkId: 'saltNodeLandProximity',
    category: 'resources',
    rejectable: true,
    enforceOptionKey: 'enforceSaltNodeLandProximity',
  },
  strategicResourceSpacing: {
    checkId: 'strategicResourceSpacing',
    category: 'resources',
    rejectable: true,
    enforceOptionKey: 'enforceStrategicResourceSpacing',
  },
}

/** @type {Record<string, string>} */
const VALIDATION_CHECK_DISPLAY_LABELS = {
  navigableRiverQuota: 'Sailable water',
  coastMouth: 'Coastal river access',
  coastConnectedNavigablePath: 'Coast-to-interior sailing path',
}

/**
 * @param {string} checkId
 * @returns {string}
 */
export function validationCheckDisplayLabel(checkId) {
  return VALIDATION_CHECK_DISPLAY_LABELS[checkId] ?? checkId
}

/** @type {readonly string[]} */
export const REJECTABLE_VALIDATION_CHECK_IDS = VALIDATION_CHECK_IDS.filter(
  (checkId) => VALIDATION_CHECK_CONTRACTS[checkId].rejectable,
)

/** @type {readonly string[]} */
export const ADVISORY_VALIDATION_CHECK_IDS = VALIDATION_CHECK_IDS.filter(
  (checkId) => !VALIDATION_CHECK_CONTRACTS[checkId].rejectable,
)

/**
 * @param {string} checkId
 */
export function validationCheckContract(checkId) {
  const contract = VALIDATION_CHECK_CONTRACTS[checkId]
  if (!contract) {
    throw new Error(`Unknown validation check: ${checkId}`)
  }
  return contract
}

/**
 * @param {string} checkId
 * @param {WorldGenerationOptions} options
 */
export function readEnforceFlag(checkId, options) {
  const contract = validationCheckContract(checkId)
  if (!contract.rejectable || !contract.enforceOptionKey) {
    return false
  }
  return Boolean(options[contract.enforceOptionKey])
}

/**
 * @param {boolean} passed
 * @param {string} checkId
 * @param {WorldGenerationOptions} options
 * @returns {'pass' | 'warn' | 'fail'}
 */
export function resolveValidationCheckStatus(passed, checkId, options) {
  if (passed) return 'pass'
  return readEnforceFlag(checkId, options) ? 'fail' : 'warn'
}

/**
 * @param {WorldGenerationOptions} options
 */
export function isRejectionSamplingEnforced(options) {
  return REJECTABLE_VALIDATION_CHECK_IDS.some((checkId) => readEnforceFlag(checkId, options))
}

/**
 * @param {import('../types.js').ValidationRow[]} validationRows
 * @returns {StructuredRejectionReason[]}
 */
export function collectStructuredRejectionReasons(validationRows) {
  return validationRows
    .filter((row) => row.status === 'fail')
    .map((row) => ({
      checkId: row.checkId,
      category: validationCheckContract(row.checkId).category,
    }))
}

/**
 * @param {import('../types.js').ValidationRow[]} validationRows
 * @param {import('./computeHydrologyMetrics.js').HydrologyMetrics} hydrologyMetrics
 * @param {Object} context
 * @param {number} context.coastalNodeCount
 * @param {number} context.highlandFraction
 * @param {number} context.biomeDiversityCount
 * @param {boolean} context.windRainfallAsymmetryActive
 * @param {boolean} context.resourceMismatchDetected
 * @param {number} context.meanInlandSalinity
 * @param {number} context.oceanSalinityMean
 * @param {number} context.arableLandFraction
 * @param {number} context.saltNodeProximityViolationCount
 * @param {number} context.strategicResourceSpacingViolationCount
 * @returns {import('../types.js').ValidationSignals}
 */
export function buildValidationSignals(validationRows, hydrologyMetrics, context) {
  const statusByCheckId = new Map(validationRows.map((row) => [row.checkId, row.status]))
  const sailMetrics = context.sailMetrics

  return {
    hydrology: {
      navigableRiverEdgeCount: hydrologyMetrics.navigableEdgeCount,
      riverCellCount: hydrologyMetrics.riverCellCount,
      mouthCount: hydrologyMetrics.mouthCount,
      hacksLawExponent: hydrologyMetrics.hacksLawExponent,
      parallelStrandRatio: hydrologyMetrics.parallelStrandRatio,
      coastConnectedNavigablePathLength: hydrologyMetrics.coastConnectedNavigablePathLength,
      endorheicCheckStatus: statusByCheckId.get('endorheicFractionCap') ?? 'pass',
    },
    coast: {
      coastalNodeCount: context.coastalNodeCount,
      mouthCount: hydrologyMetrics.mouthCount,
      coastMouthCheckStatus: statusByCheckId.get('coastMouth') ?? 'pass',
      coastConnectedNavigablePathLength: sailMetrics.coastToInteriorPathLength,
      coastalRiverAccess: sailMetrics.hasCoastalRiverAccess,
      coastToInteriorSailPathLength: sailMetrics.coastToInteriorPathLength,
    },
    climate: {
      windRainfallAsymmetryActive: context.windRainfallAsymmetryActive,
      windRainfallCheckStatus: statusByCheckId.get('windRainfallAsymmetry') ?? 'pass',
    },
    resources: {
      resourceMismatchDetected: context.resourceMismatchDetected,
      resourceMismatchCheckStatus: statusByCheckId.get('resourceMismatch') ?? 'pass',
      meanInlandSalinity: context.meanInlandSalinity,
      oceanSalinityMean: context.oceanSalinityMean,
      salinityGradientCheckStatus: statusByCheckId.get('salinityOceanGradient') ?? 'pass',
      arableLandFraction: context.arableLandFraction,
      arableEnvelopeCheckStatus: statusByCheckId.get('arableEnvelopeCoverage') ?? 'pass',
      saltNodeProximityViolationCount: context.saltNodeProximityViolationCount,
      saltNodeLandProximityCheckStatus: statusByCheckId.get('saltNodeLandProximity') ?? 'pass',
      strategicResourceSpacingViolationCount: context.strategicResourceSpacingViolationCount,
      strategicResourceSpacingCheckStatus:
        statusByCheckId.get('strategicResourceSpacing') ?? 'pass',
    },
    landmassPlausibility: {
      highlandFraction: context.highlandFraction,
      biomeDiversityCount: context.biomeDiversityCount,
      highlandCheckStatus: statusByCheckId.get('highlandPresence') ?? 'pass',
      biomeDiversityCheckStatus: statusByCheckId.get('biomeDiversity') ?? 'pass',
    },
    movement: {
      largestSailComponentCellCount: sailMetrics.largestComponentCellCount,
      coastToInteriorSailPathLength: sailMetrics.coastToInteriorPathLength,
      navigableRiverCheckStatus: statusByCheckId.get('navigableRiverQuota') ?? 'pass',
      coastConnectedNavigablePathCheckStatus:
        statusByCheckId.get('coastConnectedNavigablePath') ?? 'pass',
    },
  }
}

/**
 * @param {string} checkId
 * @param {'pass' | 'warn' | 'fail'} status
 * @param {string} summary
 * @param {import('../types.js').MapFocus} [mapFocus]
 * @returns {import('../types.js').ValidationRow}
 */
export function createValidationRow(checkId, status, summary, mapFocus) {
  const contract = validationCheckContract(checkId)
  return {
    checkId,
    status,
    summary,
    category: contract.category,
    rejectable: contract.rejectable,
    mapFocus,
  }
}
