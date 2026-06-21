import { BIOMES } from '../biomeIds.js'
import {
  MIN_BIOME_DIVERSITY,
  MIN_HIGHLAND_ELEVATION,
  MIN_HIGHLAND_FRACTION,
  minNavigableRiverEdgesForGrid,
} from '../types.js'

/**
 * @param {Object} slice
 * @param {import('../types.js').ScalarFields} slice.fields
 * @param {Uint8Array} slice.biomes
 * @param {import('../types.js').RiverGraph} slice.riverGraph
 * @param {import('../types.js').CoastalNode[]} slice.coastalNodes
 * @param {number} slice.gridWidth
 * @param {number} slice.gridHeight
 * @returns {import('../types.js').ValidationRow[]}
 */
export function runGeographyValidationChecks(slice) {
  const rows = []
  const { fields, biomes, riverGraph, coastalNodes, gridWidth, gridHeight } = slice
  const cellCount = gridWidth * gridHeight

  const navigableEdges = riverGraph.edges.filter((edge) => edge.navigable)
  const minNavigable = minNavigableRiverEdgesForGrid(gridWidth)
  rows.push({
    checkId: 'navigableRiverQuota',
    status: navigableEdges.length >= minNavigable ? 'pass' : 'warn',
    summary:
      navigableEdges.length >= minNavigable
        ? `Navigable river segments: ${navigableEdges.length}`
        : `Low navigable river count: ${navigableEdges.length} (min ${minNavigable})`,
    mapFocus:
      navigableEdges.length >= minNavigable
        ? undefined
        : findRiverFocus(riverGraph, gridWidth, gridHeight),
  })

  const mouthNodes = coastalNodes.filter((node) => node.kind === 'mouth')
  rows.push({
    checkId: 'coastMouth',
    status: mouthNodes.length >= 1 ? 'pass' : 'warn',
    summary:
      mouthNodes.length >= 1
        ? `Coast mouths: ${mouthNodes.length}`
        : 'No navigable river mouths detected',
    mapFocus:
      mouthNodes.length >= 1
        ? undefined
        : { x: gridWidth / 2, y: gridHeight - 2, zoom: 2 },
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
 * @param {number} height
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
