import {
  createValidationRow,
  resolveValidationCheckStatus,
} from './landmassValidationContracts.js'
import {
  computeArableEnvelopeMetrics,
  findSaltNodeLandProximityViolations,
  findStrategicResourceSpacingViolations,
  isArableEnvelopeCoverageSufficient,
  saltNodeProximityFocus,
  strategicResourceSpacingFocus,
} from './computeResourceValidationMetrics.js'

/**
 * @typedef {import('../types.js').WorldGenerationOptions} ResourceValidationOptions
 */

/**
 * @param {Object} slice
 * @param {import('../types.js').ScalarFields} slice.fields
 * @param {Uint8Array} slice.biomes
 * @param {number} slice.gridWidth
 * @param {number} slice.gridHeight
 * @param {Float32Array | null | undefined} [slice.arableRaster]
 * @param {import('../types.js').SaltNode[] | null | undefined} [slice.saltNodes]
 * @param {import('../types.js').MetalNode[] | null | undefined} [slice.metalNodes]
 * @param {ResourceValidationOptions} [slice.validationOptions]
 * @returns {import('../types.js').ValidationRow[]}
 */
export function runResourceValidationChecks(slice) {
  const rows = []
  const {
    fields,
    biomes,
    gridWidth,
    gridHeight,
    arableRaster,
    saltNodes,
    metalNodes,
    validationOptions,
  } = slice

  if (!validationOptions) {
    throw new Error('validationOptions required for resource validation checks')
  }

  if (arableRaster) {
    const arableMetrics = computeArableEnvelopeMetrics(
      arableRaster,
      fields.elevation,
      validationOptions.seaLevel,
    )
    const arablePass = isArableEnvelopeCoverageSufficient(arableMetrics.arableLandFraction)
    rows.push(
      createValidationRow(
        'arableEnvelopeCoverage',
        resolveValidationCheckStatus(
          arablePass,
          'arableEnvelopeCoverage',
          validationOptions,
        ),
        arablePass
          ? `Arable envelope: ${(arableMetrics.arableLandFraction * 100).toFixed(1)}% of land`
          : `Thin arable envelope: ${(arableMetrics.arableLandFraction * 100).toFixed(1)}% of land`,
        arablePass
          ? undefined
          : findArableEnvelopeFocus(arableRaster, fields.elevation, gridWidth, validationOptions.seaLevel),
      ),
    )
  } else {
    rows.push(
      createValidationRow(
        'arableEnvelopeCoverage',
        'pass',
        'Arable raster unavailable for envelope check',
      ),
    )
  }

  if (saltNodes) {
    const proximityViolations = findSaltNodeLandProximityViolations(
      saltNodes,
      biomes,
      gridWidth,
      gridHeight,
    )
    const proximityPass = proximityViolations.length === 0
    rows.push(
      createValidationRow(
        'saltNodeLandProximity',
        resolveValidationCheckStatus(
          proximityPass,
          'saltNodeLandProximity',
          validationOptions,
        ),
        proximityPass
          ? `Salt node land proximity: ${saltNodes.length} nodes ok`
          : `Salt node land proximity violations: ${proximityViolations.length}`,
        saltNodeProximityFocus(proximityViolations),
      ),
    )
  } else {
    rows.push(
      createValidationRow(
        'saltNodeLandProximity',
        'pass',
        'Salt nodes unavailable for proximity check',
      ),
    )
  }

  if (saltNodes || metalNodes) {
    const spacingViolations = findStrategicResourceSpacingViolations(
      saltNodes,
      metalNodes,
      gridWidth,
    )
    const spacingPass = spacingViolations.length === 0
    const nodeCount = (saltNodes?.length ?? 0) + (metalNodes?.length ?? 0)
    rows.push(
      createValidationRow(
        'strategicResourceSpacing',
        resolveValidationCheckStatus(
          spacingPass,
          'strategicResourceSpacing',
          validationOptions,
        ),
        spacingPass
          ? `Strategic resource spacing: ${nodeCount} nodes ok`
          : `Strategic resource spacing violations: ${spacingViolations.length}`,
        strategicResourceSpacingFocus(spacingViolations),
      ),
    )
  } else {
    rows.push(
      createValidationRow(
        'strategicResourceSpacing',
        'pass',
        'Strategic resource nodes unavailable for spacing check',
      ),
    )
  }

  return rows
}

/**
 * @param {Float32Array} arableRaster
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} seaLevel
 */
function findArableEnvelopeFocus(arableRaster, elevation, width, seaLevel) {
  for (let i = 0; i < elevation.length; i += 1) {
    if (elevation[i] < seaLevel) continue
    if (arableRaster[i] > 0) {
      return { x: i % width, y: Math.floor(i / width), zoom: 2 }
    }
  }
  return { x: width / 2, y: Math.floor(elevation.length / width) / 2, zoom: 1 }
}
