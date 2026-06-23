import { BIOMES } from '../biomeIds.js'
import {
  MIN_BIOME_DIVERSITY,
  MIN_HIGHLAND_ELEVATION,
  MIN_HIGHLAND_FRACTION,
  minNavigableRiverEdgesForGrid,
} from '../types.js'
import { DEFAULT_WORLD_GENERATION_OPTIONS } from '../worldGenerationOptions.js'
import { computeHydrologyMetrics } from './computeHydrologyMetrics.js'

/**
 * @typedef {import('../types.js').WorldGenerationOptions} GeographyValidationOptions
 */

/**
 * @param {Object} slice
 * @param {import('../types.js').ScalarFields} slice.fields
 * @param {Uint8Array} slice.biomes
 * @param {import('../types.js').RiverGraph} slice.riverGraph
 * @param {import('../types.js').CoastalNode[]} slice.coastalNodes
 * @param {number} slice.gridWidth
 * @param {number} slice.gridHeight
 * @param {import('../types.js').HydrologyPipelineStats} [slice.hydrologyStats]
 * @param {import('./computeHydrologyMetrics.js').HydrologyMetrics} [slice.hydrologyMetrics]
 * @param {GeographyValidationOptions} [slice.validationOptions]
 * @returns {import('../types.js').ValidationRow[]}
 */
export function runGeographyValidationChecks(slice) {
  const rows = []
  const {
    fields,
    biomes,
    riverGraph,
    coastalNodes,
    gridWidth,
    gridHeight,
    hydrologyStats = {
      breachCount: 0,
      endorheicCount: 0,
      endorheicFraction: 0,
      lakeCount: 0,
    },
    hydrologyMetrics,
    validationOptions = DEFAULT_WORLD_GENERATION_OPTIONS,
  } = slice
  const cellCount = gridWidth * gridHeight
  const metrics =
    hydrologyMetrics ??
    computeHydrologyMetrics({
      elevation: fields.elevation,
      drainage: fields.drainage,
      riverGraph,
      gridWidth,
      gridHeight,
    })

  const navigableEdges = riverGraph.edges
  const minNavigable = minNavigableRiverEdgesForGrid(gridWidth)
  const navigablePass = navigableEdges.length >= minNavigable
  rows.push({
    checkId: 'navigableRiverQuota',
    status: resolveCheckStatus(navigablePass, validationOptions.enforceNavigableRiverQuota),
    summary: navigablePass
      ? `Navigable river segments: ${navigableEdges.length}`
      : `Low navigable river count: ${navigableEdges.length} (min ${minNavigable})`,
    mapFocus: navigablePass ? undefined : findRiverFocus(riverGraph, gridWidth, gridHeight),
  })

  const mouthNodes = coastalNodes.filter((node) => node.kind === 'mouth')
  const coastMouthPass = mouthNodes.length >= 1
  rows.push({
    checkId: 'coastMouth',
    status: resolveCheckStatus(coastMouthPass, validationOptions.enforceCoastMouth),
    summary: coastMouthPass
      ? `Coast mouths: ${mouthNodes.length}`
      : 'No river mouths detected',
    mapFocus: coastMouthPass ? undefined : { x: gridWidth / 2, y: gridHeight - 2, zoom: 2 },
  })

  const hacksLawPass = isHacksLawWithinBounds(metrics.hacksLawExponent, validationOptions)
  rows.push({
    checkId: 'hacksLawExponent',
    status: resolveCheckStatus(hacksLawPass, validationOptions.enforceHacksLawExponent),
    summary: formatHacksLawSummary(metrics.hacksLawExponent, validationOptions),
    mapFocus: hacksLawPass ? undefined : findRiverFocus(riverGraph, gridWidth, gridHeight),
  })

  const slopeAreaPass = isSlopeAreaConcavityWithinBounds(
    metrics.slopeAreaConcavitySamples,
    validationOptions,
  )
  rows.push({
    checkId: 'slopeAreaConcavity',
    status: resolveCheckStatus(slopeAreaPass, validationOptions.enforceSlopeAreaConcavity),
    summary: formatSlopeAreaSummary(metrics.slopeAreaConcavitySamples, validationOptions),
    mapFocus: slopeAreaPass ? undefined : findRiverFocus(riverGraph, gridWidth, gridHeight),
  })

  const parallelPass = metrics.parallelStrandRatio <= validationOptions.maxParallelStrandRatio
  rows.push({
    checkId: 'parallelStrandRatio',
    status: resolveCheckStatus(parallelPass, validationOptions.enforceParallelStrandRatio),
    summary: parallelPass
      ? `Parallel strand ratio: ${metrics.parallelStrandRatio.toFixed(2)}`
      : `Parallel strands ${metrics.parallelStrandRatio.toFixed(2)} above cap ${validationOptions.maxParallelStrandRatio.toFixed(2)}`,
    mapFocus: parallelPass ? undefined : findRiverFocus(riverGraph, gridWidth, gridHeight),
  })

  const coastPathPass =
    metrics.coastConnectedNavigablePathLength >=
    validationOptions.minCoastConnectedNavigablePathCells
  rows.push({
    checkId: 'coastConnectedNavigablePath',
    status: resolveCheckStatus(coastPathPass, validationOptions.enforceCoastConnectedNavigablePath),
    summary: coastPathPass
      ? `Coast-connected navigable path: ${metrics.coastConnectedNavigablePathLength} cells`
      : `Coast-connected navigable path ${metrics.coastConnectedNavigablePathLength} below min ${validationOptions.minCoastConnectedNavigablePathCells}`,
    mapFocus: coastPathPass ? undefined : findRiverFocus(riverGraph, gridWidth, gridHeight),
  })

  const endorheicCap = maxEndorheicFractionForOptions(validationOptions)
  const endorheicFraction =
    hydrologyStats.lakeCount > 0
      ? hydrologyStats.endorheicCount / hydrologyStats.lakeCount
      : hydrologyStats.endorheicFraction
  const endorheicPass = endorheicFraction <= endorheicCap
  rows.push({
    checkId: 'endorheicFractionCap',
    status: resolveCheckStatus(endorheicPass, validationOptions.enforceEndorheicFractionCap),
    summary: endorheicPass
      ? `Endorheic fraction ${endorheicFraction.toFixed(2)} within cap ${endorheicCap.toFixed(2)}`
      : `Endorheic fraction ${endorheicFraction.toFixed(2)} above cap ${endorheicCap.toFixed(2)}`,
    mapFocus: endorheicPass ? undefined : { x: gridWidth / 2, y: gridHeight / 2, zoom: 1 },
  })

  let highlandCells = 0
  for (let i = 0; i < cellCount; i += 1) {
    if (fields.elevation[i] >= MIN_HIGHLAND_ELEVATION) highlandCells += 1
  }
  const highlandFraction = highlandCells / cellCount
  rows.push({
    checkId: 'highlandPresence',
    status: highlandFraction >= MIN_HIGHLAND_FRACTION ? 'pass' : 'warn',
    summary:
      highlandFraction >= MIN_HIGHLAND_FRACTION
        ? `Highland coverage: ${(highlandFraction * 100).toFixed(1)}%`
        : `Thin highlands: ${(highlandFraction * 100).toFixed(1)}%`,
    mapFocus:
      highlandFraction >= MIN_HIGHLAND_FRACTION
        ? undefined
        : findHighlandFocus(fields.elevation, gridWidth),
  })

  const biomeSet = new Set(biomes)
  rows.push({
    checkId: 'biomeDiversity',
    status: biomeSet.size >= MIN_BIOME_DIVERSITY ? 'pass' : 'warn',
    summary:
      biomeSet.size >= MIN_BIOME_DIVERSITY
        ? `Biome diversity: ${biomeSet.size} types`
        : `Low biome diversity: ${biomeSet.size} types`,
    mapFocus:
      biomeSet.size >= MIN_BIOME_DIVERSITY
        ? undefined
        : { x: gridWidth / 2, y: gridHeight / 2, zoom: 1 },
  })

  const mismatch = findResourceMismatchZone(biomes, fields, gridWidth, gridHeight)
  rows.push({
    checkId: 'resourceMismatch',
    status: mismatch ? 'warn' : 'pass',
    summary: mismatch
      ? 'Resource-mismatch friction zone detected'
      : 'No major resource-mismatch friction zones',
    mapFocus: mismatch ?? undefined,
  })

  return rows
}

/**
 * @param {boolean} passed
 * @param {boolean} enforce
 * @returns {'pass' | 'warn' | 'fail'}
 */
function resolveCheckStatus(passed, enforce) {
  if (passed) return 'pass'
  return enforce ? 'fail' : 'warn'
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
