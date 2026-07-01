import { BIOMES, SEA_LEVEL } from '../biomeIds.js'
import {
  assembleRiverNetworkFromFields,
  assembleRiverNetworkFromValidationSlice,
} from '../hydrology/riverNetwork.js'
import {
  MIN_BIOME_DIVERSITY,
  MIN_HIGHLAND_ELEVATION,
  MIN_HIGHLAND_FRACTION,
  minNavigableRiverEdgesForGrid,
} from '../types.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'
import { computeHydrologyMetrics, selectNavigableRiverEdges } from './computeHydrologyMetrics.js'
import { computeWindRainfallAsymmetry } from './computeWindRainfallAsymmetry.js'
import {
  createValidationRow,
  resolveValidationCheckStatus,
} from './landmassValidationContracts.js'
import { runResourceValidationChecks } from './runResourceValidationChecks.js'

/** Minimum normalized windward/leeward rainfall gap before wind coupling reads as active. */
const MIN_WIND_RAINFALL_ASYMMETRY = 0.03

/** Ocean salinity cells must stay near full strength for the scalar-field contract. */
const MIN_OCEAN_SALINITY_MEAN = 0.9

/**
 * @typedef {import('../types.js').WorldGenerationOptions} GeographyValidationOptions
 */

/**
 * @param {Object} slice
 * @param {import('../types.js').ScalarFields} slice.fields
 * @param {Uint8Array} slice.biomes
 * @param {import('../types.js').RiverGraph} slice.riverGraph
 * @param {import('../types.js').RiverNetwork} [slice.riverNetwork]
 * @param {Uint8Array} [slice.riverNetworkMask]
 * @param {Uint8Array} [slice.riverCorridorMask]
 * @param {Uint8Array} [slice.simulationRiverMask]
 * @param {Int16Array} [slice.flowDirection]
 * @param {import('../types.js').CoastalNode[]} slice.coastalNodes
 * @param {number} slice.gridWidth
 * @param {number} slice.gridHeight
 * @param {import('../types.js').HydrologyPipelineStats} [slice.hydrologyStats]
 * @param {import('./computeHydrologyMetrics.js').HydrologyMetrics} [slice.hydrologyMetrics]
 * @param {number} [slice.prevailingWindDegrees]
 * @param {GeographyValidationOptions} [slice.validationOptions]
 * @param {Float32Array | null | undefined} [slice.arableRaster]
 * @param {import('../types.js').SaltNode[] | null | undefined} [slice.saltNodes]
 * @param {import('../types.js').MetalNode[] | null | undefined} [slice.metalNodes]
 * @returns {import('../types.js').ValidationRow[]}
 */
export function runGeographyValidationChecks(slice) {
  const rows = []
  const {
    fields,
    biomes,
    riverGraph,
    riverNetwork,
    gridWidth,
    gridHeight,
    hydrologyStats = {
      breachCount: 0,
      endorheicCount: 0,
      endorheicFraction: 0,
      lakeCount: 0,
    },
    hydrologyMetrics,
    prevailingWindDegrees = 0,
    validationOptions = DEFAULT_WORLD_GENERATION_OPTIONS,
    arableRaster,
    saltNodes,
    metalNodes,
  } = slice
  const cellCount = gridWidth * gridHeight
  const graph = riverNetwork?.graph ?? riverGraph
  const resolvedRiverNetwork =
    riverNetwork ?? assembleRiverNetworkForLogisticsValidation(slice)
  const metricsNetwork = resolvedRiverNetwork
    ? riverNetworkForLogisticsMetrics(resolvedRiverNetwork)
    : null
  const metrics =
    hydrologyMetrics ??
    (metricsNetwork
      ? computeHydrologyMetrics({
          elevation: fields.elevation,
          drainage: fields.drainage,
          riverGraph: graph,
          riverNetwork: metricsNetwork,
          gridWidth,
          gridHeight,
        })
      : null)
  if (!metrics) {
    throw new Error('riverNetwork or hydrologyMetrics required for geography validation')
  }

  const navigableEdges = selectNavigableRiverEdges(graph.edges)
  const minNavigable = minNavigableRiverEdgesForGrid(gridWidth)
  const navigablePass = navigableEdges.length >= minNavigable
  rows.push(
    createValidationRow(
      'navigableRiverQuota',
      resolveValidationCheckStatus(navigablePass, 'navigableRiverQuota', validationOptions),
      navigablePass
        ? `Navigable river segments: ${navigableEdges.length}`
        : `Low navigable river count: ${navigableEdges.length} (min ${minNavigable})`,
      navigablePass ? undefined : findRiverFocus(riverGraph, gridWidth, gridHeight),
    ),
  )

  const mouthCount = metrics.mouthCount
  const coastMouthPass = mouthCount >= 1
  rows.push(
    createValidationRow(
      'coastMouth',
      resolveValidationCheckStatus(coastMouthPass, 'coastMouth', validationOptions),
      coastMouthPass
        ? `River mouths: ${mouthCount}`
        : 'No river mouths detected',
      coastMouthPass ? undefined : findRiverFocus(riverGraph, gridWidth, gridHeight),
    ),
  )

  const hacksLawPass = isHacksLawWithinBounds(metrics.hacksLawExponent, validationOptions)
  rows.push(
    createValidationRow(
      'hacksLawExponent',
      resolveValidationCheckStatus(hacksLawPass, 'hacksLawExponent', validationOptions),
      formatHacksLawSummary(metrics.hacksLawExponent, validationOptions),
      hacksLawPass ? undefined : findRiverFocus(riverGraph, gridWidth, gridHeight),
    ),
  )

  const slopeAreaPass = isSlopeAreaConcavityWithinBounds(
    metrics.slopeAreaConcavitySamples,
    validationOptions,
  )
  rows.push(
    createValidationRow(
      'slopeAreaConcavity',
      resolveValidationCheckStatus(slopeAreaPass, 'slopeAreaConcavity', validationOptions),
      formatSlopeAreaSummary(metrics.slopeAreaConcavitySamples, validationOptions),
      slopeAreaPass ? undefined : findRiverFocus(riverGraph, gridWidth, gridHeight),
    ),
  )

  const parallelPass = metrics.parallelStrandRatio <= validationOptions.maxParallelStrandRatio
  rows.push(
    createValidationRow(
      'parallelStrandRatio',
      resolveValidationCheckStatus(parallelPass, 'parallelStrandRatio', validationOptions),
      parallelPass
        ? `Parallel strand ratio: ${metrics.parallelStrandRatio.toFixed(2)}`
        : `Parallel strands ${metrics.parallelStrandRatio.toFixed(2)} above cap ${validationOptions.maxParallelStrandRatio.toFixed(2)}`,
      parallelPass ? undefined : findRiverFocus(riverGraph, gridWidth, gridHeight),
    ),
  )

  const coastPathPass =
    metrics.coastConnectedNavigablePathLength >=
    validationOptions.minCoastConnectedNavigablePathCells
  rows.push(
    createValidationRow(
      'coastConnectedNavigablePath',
      resolveValidationCheckStatus(
        coastPathPass,
        'coastConnectedNavigablePath',
        validationOptions,
      ),
      coastPathPass
        ? `Coast-connected navigable path: ${metrics.coastConnectedNavigablePathLength} cells`
        : `Coast-connected navigable path ${metrics.coastConnectedNavigablePathLength} below min ${validationOptions.minCoastConnectedNavigablePathCells}`,
      coastPathPass ? undefined : findRiverFocus(riverGraph, gridWidth, gridHeight),
    ),
  )

  const endorheicCap = maxEndorheicFractionForOptions(validationOptions)
  const endorheicFraction =
    hydrologyStats.lakeCount > 0
      ? hydrologyStats.endorheicCount / hydrologyStats.lakeCount
      : hydrologyStats.endorheicFraction
  const endorheicPass = endorheicFraction <= endorheicCap
  rows.push(
    createValidationRow(
      'endorheicFractionCap',
      resolveValidationCheckStatus(endorheicPass, 'endorheicFractionCap', validationOptions),
      endorheicPass
        ? `Endorheic fraction ${endorheicFraction.toFixed(2)} within cap ${endorheicCap.toFixed(2)}`
        : `Endorheic fraction ${endorheicFraction.toFixed(2)} above cap ${endorheicCap.toFixed(2)}`,
      endorheicPass ? undefined : { x: gridWidth / 2, y: gridHeight / 2, zoom: 1 },
    ),
  )

  const salinityMetrics = computeSalinityGradientMetrics(
    fields.salinity,
    fields.elevation,
    validationOptions.seaLevel,
  )
  const salinityPass =
    salinityMetrics.oceanCellCount > 0 &&
    salinityMetrics.oceanSalinityMean >= MIN_OCEAN_SALINITY_MEAN &&
    salinityMetrics.inlandCellCount > 0 &&
    salinityMetrics.meanInlandSalinity < salinityMetrics.oceanSalinityMean
  rows.push(
    createValidationRow(
      'salinityOceanGradient',
      resolveValidationCheckStatus(salinityPass, 'salinityOceanGradient', validationOptions),
      salinityPass
        ? `Salinity gradient: ocean ${salinityMetrics.oceanSalinityMean.toFixed(2)}, inland ${salinityMetrics.meanInlandSalinity.toFixed(2)}`
        : 'Salinity field missing ocean-to-inland gradient',
      salinityPass ? undefined : { x: gridWidth / 2, y: gridHeight / 2, zoom: 1 },
    ),
  )

  let highlandCells = 0
  for (let i = 0; i < cellCount; i += 1) {
    if (fields.elevation[i] >= MIN_HIGHLAND_ELEVATION) highlandCells += 1
  }
  const highlandFraction = highlandCells / cellCount
  const highlandPass = highlandFraction >= MIN_HIGHLAND_FRACTION
  rows.push(
    createValidationRow(
      'highlandPresence',
      resolveValidationCheckStatus(highlandPass, 'highlandPresence', validationOptions),
      highlandPass
        ? `Highland coverage: ${(highlandFraction * 100).toFixed(1)}%`
        : `Thin highlands: ${(highlandFraction * 100).toFixed(1)}%`,
      highlandPass ? undefined : findHighlandFocus(fields.elevation, gridWidth),
    ),
  )

  const biomeSet = new Set(biomes)
  const biomeDiversityPass = biomeSet.size >= MIN_BIOME_DIVERSITY
  rows.push(
    createValidationRow(
      'biomeDiversity',
      resolveValidationCheckStatus(biomeDiversityPass, 'biomeDiversity', validationOptions),
      biomeDiversityPass
        ? `Biome diversity: ${biomeSet.size} types`
        : `Low biome diversity: ${biomeSet.size} types`,
      biomeDiversityPass
        ? undefined
        : { x: gridWidth / 2, y: gridHeight / 2, zoom: 1 },
    ),
  )

  const windAsymmetry = computeWindRainfallAsymmetry({
    rainfall: fields.rainfall,
    elevation: fields.elevation,
    width: gridWidth,
    height: gridHeight,
    prevailingWindDegrees,
  })
  const windAsymmetryActive =
    windAsymmetry.highlandCellCount > 0 &&
    windAsymmetry.asymmetry >= MIN_WIND_RAINFALL_ASYMMETRY
  rows.push(
    createValidationRow(
      'windRainfallAsymmetry',
      resolveValidationCheckStatus(
        windAsymmetryActive,
        'windRainfallAsymmetry',
        validationOptions,
      ),
      windAsymmetry.highlandCellCount === 0
        ? 'Wind rainfall asymmetry unavailable (no highland cells)'
        : windAsymmetryActive
          ? `Wind rainfall asymmetry: ${(windAsymmetry.asymmetry * 100).toFixed(1)}% windward-leeward gap`
          : `Flat wind rainfall response: ${(windAsymmetry.asymmetry * 100).toFixed(1)}% gap`,
    ),
  )

  const mismatch = findResourceMismatchZone(biomes, fields, gridWidth, gridHeight)
  rows.push(
    createValidationRow(
      'resourceMismatch',
      resolveValidationCheckStatus(!mismatch, 'resourceMismatch', validationOptions),
      mismatch
        ? 'Resource-mismatch friction zone detected'
        : 'No major resource-mismatch friction zones',
      mismatch ?? undefined,
    ),
  )

  rows.push(
    ...runResourceValidationChecks({
      fields,
      biomes,
      gridWidth,
      gridHeight,
      arableRaster,
      saltNodes,
      metalNodes,
      validationOptions,
    }),
  )

  return rows
}

/**
 * @param {import('../types.js').RiverNetwork} riverNetwork
 * @returns {import('../types.js').RiverNetwork}
 */
export function riverNetworkForLogisticsMetrics(riverNetwork) {
  return {
    ...riverNetwork,
    centerline: riverNetwork.simulationCenterline,
  }
}

/**
 * @param {Object} slice
 * @param {import('../types.js').RiverNetwork} [slice.riverNetwork]
 * @param {import('../types.js').RiverGraph} [slice.riverGraph]
 * @param {Uint8Array} [slice.riverNetworkMask]
 * @param {Uint8Array} [slice.riverCorridorMask]
 * @param {Uint8Array} [slice.simulationRiverMask]
 * @param {Int16Array} [slice.flowDirection]
 * @param {import('../types.js').ScalarFields} slice.fields
 * @param {number} slice.gridWidth
 * @param {number} slice.gridHeight
 * @returns {import('../types.js').RiverNetwork | null}
 */
export function assembleRiverNetworkForLogisticsValidation(slice) {
  if (slice.riverNetwork) return slice.riverNetwork
  if (slice.simulationRiverMask && slice.riverGraph && slice.fields?.drainage) {
    const { riverGraph, fields, gridWidth, gridHeight } = slice
    const cellCount = gridWidth * gridHeight
    return assembleRiverNetworkFromFields({
      riverNetworkMask: slice.riverNetworkMask,
      riverCorridorMask: slice.riverCorridorMask,
      simulationRiverMask: slice.simulationRiverMask,
      flowDirection: slice.flowDirection ?? new Int16Array(cellCount).fill(-1),
      flowAccumulation: fields.drainage,
      channelWidth: slice.channelWidth ?? undefined,
      riverGraph,
      width: gridWidth,
      height: gridHeight,
    })
  }
  return assembleRiverNetworkFromValidationSlice(slice)
}

/**
 * @param {Float32Array} salinity
 * @param {Float32Array} elevation
 * @param {number} [seaLevel]
 */
export function computeSalinityGradientMetrics(salinity, elevation, seaLevel = SEA_LEVEL) {
  let oceanSalinitySum = 0
  let oceanCellCount = 0
  let inlandSalinitySum = 0
  let inlandCellCount = 0

  for (let i = 0; i < salinity.length; i += 1) {
    if (elevation[i] < seaLevel) {
      oceanSalinitySum += salinity[i]
      oceanCellCount += 1
    } else {
      inlandSalinitySum += salinity[i]
      inlandCellCount += 1
    }
  }

  return {
    oceanCellCount,
    inlandCellCount,
    oceanSalinityMean: oceanCellCount > 0 ? oceanSalinitySum / oceanCellCount : 0,
    meanInlandSalinity: inlandCellCount > 0 ? inlandSalinitySum / inlandCellCount : 0,
  }
}

/**
 * @param {number | null} exponent
 * @param {GeographyValidationOptions} options
 */
function isHacksLawWithinBounds(exponent, options) {
  if (exponent === null) return !options.enforceHacksLawExponent
  return exponent >= options.minHacksLawExponent && exponent <= options.maxHacksLawExponent
}

/**
 * @param {number | null} exponent
 * @param {GeographyValidationOptions} options
 */
function formatHacksLawSummary(exponent, options) {
  if (exponent === null) {
    return 'Hack’s law exponent unavailable (insufficient trunk samples)'
  }
  const within =
    exponent >= options.minHacksLawExponent && exponent <= options.maxHacksLawExponent
  if (within) {
    return `Hack’s law exponent: ${exponent.toFixed(2)}`
  }
  return `Hack’s law exponent ${exponent.toFixed(2)} outside ${options.minHacksLawExponent.toFixed(2)}–${options.maxHacksLawExponent.toFixed(2)}`
}

/**
 * @param {number[]} samples
 * @param {GeographyValidationOptions} options
 */
function isSlopeAreaConcavityWithinBounds(samples, options) {
  if (samples.length === 0) return !options.enforceSlopeAreaConcavity
  const median = medianValue(samples)
  return median >= options.minSlopeAreaConcavity && median <= options.maxSlopeAreaConcavity
}

/**
 * @param {number[]} samples
 * @param {GeographyValidationOptions} options
 */
function formatSlopeAreaSummary(samples, options) {
  if (samples.length === 0) {
    return 'Slope–area concavity unavailable (insufficient trunk samples)'
  }
  const median = medianValue(samples)
  const within =
    median >= options.minSlopeAreaConcavity && median <= options.maxSlopeAreaConcavity
  if (within) {
    return `Slope–area concavity median: ${median.toFixed(2)} (${samples.length} samples)`
  }
  return `Slope–area concavity median ${median.toFixed(2)} outside ${options.minSlopeAreaConcavity.toFixed(2)}–${options.maxSlopeAreaConcavity.toFixed(2)}`
}

/**
 * @param {GeographyValidationOptions} options
 */
export function maxEndorheicFractionForOptions(options) {
  if (Number.isFinite(options.maxEndorheicFraction)) {
    return options.maxEndorheicFraction
  }
  return Math.min(1, Math.max(0, 1 - options.breachThreshold))
}

/**
 * @param {number[]} values
 */
function medianValue(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

/**
 * @param {import('../types.js').RiverGraph} riverGraph
 * @param {number} width
 * @param {number} height
 */
function findRiverFocus(riverGraph, width, height) {
  if (riverGraph.nodes.length === 0) {
    return { x: width / 2, y: height / 2, zoom: 1 }
  }
  const mouth = riverGraph.nodes.find((node) => node.kind === 'mouth')
  if (mouth) return { x: mouth.x, y: mouth.y, zoom: 3 }
  const node = riverGraph.nodes[0]
  return { x: node.x, y: node.y, zoom: 2 }
}

/**
 * @param {Float32Array} elevation
 * @param {number} width
 */
function findHighlandFocus(elevation, width) {
  let bestIdx = 0
  let bestElev = -Infinity
  for (let i = 0; i < elevation.length; i += 1) {
    if (elevation[i] > bestElev) {
      bestElev = elevation[i]
      bestIdx = i
    }
  }
  return { x: bestIdx % width, y: Math.floor(bestIdx / width), zoom: 2 }
}

/**
 * @param {Uint8Array} biomes
 * @param {import('../types.js').ScalarFields} fields
 * @param {number} width
 * @param {number} height
 */
function findResourceMismatchZone(biomes, fields, width, height) {
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x
      if (biomes[idx] !== BIOMES.DESERT) continue
      if (fields.rainfall[idx] < 0.55) continue

      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]
      for (const [nx, ny] of neighbors) {
        const nIdx = ny * width + nx
        if (biomes[nIdx] === BIOMES.TEMPERATE_FOREST || biomes[nIdx] === BIOMES.SWAMP) {
          return { x, y, zoom: 4 }
        }
      }
    }
  }
  return null
}
