import { SEA_LEVEL } from '../biomeIds.js'
import {
  saltNodeHasSubstantialLandProximity,
} from '../resources/placeSaltNodes.js'
import {
  saltLandProximityRadiusForGrid,
  strategicResourceNodeSpacingForGrid,
} from '../resourcePlacementScaling.js'

/** Minimum share of land cells that must carry arable productivity above zero. */
export const MIN_ARABLE_LAND_FRACTION = 0.02

/**
 * @param {Float32Array | null | undefined} arableRaster
 * @param {Float32Array} elevation
 * @param {number} [seaLevel]
 */
export function computeArableEnvelopeMetrics(arableRaster, elevation, seaLevel = SEA_LEVEL) {
  let landCellCount = 0
  let arableCellCount = 0

  for (let i = 0; i < elevation.length; i += 1) {
    if (elevation[i] < seaLevel) continue
    landCellCount += 1
    if (arableRaster && arableRaster[i] > 0) {
      arableCellCount += 1
    }
  }

  return {
    landCellCount,
    arableCellCount,
    arableLandFraction: landCellCount === 0 ? 0 : arableCellCount / landCellCount,
  }
}

/**
 * @typedef {Object} SaltNodeProximityViolation
 * @property {string} id
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} StrategicResourceSpacingViolation
 * @property {'salt' | 'metal'} kind
 * @property {string} firstId
 * @property {string} secondId
 * @property {number} distance
 * @property {number} x
 * @property {number} y
 */

/**
 * @param {import('../types.js').SaltNode[] | null | undefined} saltNodes
 * @param {Uint8Array} biomes
 * @param {number} width
 * @param {number} height
 * @returns {SaltNodeProximityViolation[]}
 */
export function findSaltNodeLandProximityViolations(saltNodes, biomes, width, height) {
  if (!saltNodes || saltNodes.length === 0) {
    return []
  }

  const radius = saltLandProximityRadiusForGrid(width)
  const violations = []

  for (const node of saltNodes) {
    if (
      !saltNodeHasSubstantialLandProximity(node.x, node.y, biomes, width, height, radius)
    ) {
      violations.push({ id: node.id, x: node.x, y: node.y })
    }
  }

  return violations
}

/**
 * @param {import('../types.js').SaltNode[] | null | undefined} saltNodes
 * @param {import('../types.js').MetalNode[] | null | undefined} metalNodes
 * @param {number} gridSize
 * @returns {StrategicResourceSpacingViolation[]}
 */
export function findStrategicResourceSpacingViolations(saltNodes, metalNodes, gridSize) {
  const minSpacing = strategicResourceNodeSpacingForGrid(gridSize)
  const violations = []

  collectSpacingViolations(saltNodes ?? [], 'salt', minSpacing, violations)
  collectSpacingViolations(metalNodes ?? [], 'metal', minSpacing, violations)

  return violations
}

/**
 * @param {ReadonlyArray<{ id: string, x: number, y: number }>} nodes
 * @param {'salt' | 'metal'} kind
 * @param {number} minSpacing
 * @param {StrategicResourceSpacingViolation[]} violations
 */
function collectSpacingViolations(nodes, kind, minSpacing, violations) {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const distance = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
      if (distance >= minSpacing) continue
      violations.push({
        kind,
        firstId: nodes[i].id,
        secondId: nodes[j].id,
        distance,
        x: nodes[i].x,
        y: nodes[i].y,
      })
    }
  }
}

/**
 * @param {SaltNodeProximityViolation[]} violations
 */
export function saltNodeProximityFocus(violations) {
  if (violations.length === 0) return undefined
  const first = violations[0]
  return { x: first.x, y: first.y, zoom: 4 }
}

/**
 * @param {StrategicResourceSpacingViolation[]} violations
 */
export function strategicResourceSpacingFocus(violations) {
  if (violations.length === 0) return undefined
  const first = violations[0]
  return { x: first.x, y: first.y, zoom: 4 }
}

/**
 * @param {number} arableLandFraction
 */
export function isArableEnvelopeCoverageSufficient(arableLandFraction) {
  return arableLandFraction >= MIN_ARABLE_LAND_FRACTION
}
