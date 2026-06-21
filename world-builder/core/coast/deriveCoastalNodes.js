import { SEA_LEVEL } from '../biomeIds.js'
import { isOceanCell } from '../fields/applyClosedIslandRim.js'

/**
 * @param {Object} params
 * @param {import('../types.js').RiverGraph} params.riverGraph
 * @param {Float32Array} params.coastNavigability
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.seaLevel]
 * @returns {import('../types.js').CoastalNode[]}
 */
export function deriveCoastalNodes({
  riverGraph,
  coastNavigability,
  elevation,
  width,
  height,
  seaLevel = SEA_LEVEL,
}) {
  /** @type {import('../types.js').CoastalNode[]} */
  const nodes = []
  const ocean = isOceanCell(elevation, width, height, seaLevel)
  const nodeById = new Map(riverGraph.nodes.map((node) => [node.id, node]))
  const mouthKeys = new Set()
  let counter = 0

  for (const edge of riverGraph.edges) {
    if (!edge.navigable) continue
    const toNode = nodeById.get(edge.toNodeId)
    if (!toNode || toNode.kind !== 'mouth') continue
    const key = `${toNode.x},${toNode.y}`
    if (mouthKeys.has(key)) continue
    mouthKeys.add(key)
    nodes.push({
      id: `coast-${counter}`,
      x: toNode.x,
      y: toNode.y,
      kind: 'mouth',
    })
    counter += 1
  }

  /** @type {Array<{ x: number, y: number, kind: import('../types.js').CoastalNodeKind, score: number }>} */
  const candidates = []

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x
      if (!ocean[idx] || !isCoastOceanCell(ocean, width, height, x, y)) continue
      if (coastNavigability[idx] < 0.55) continue

      if (isStrait(elevation, ocean, width, height, x, y, seaLevel)) {
        candidates.push({ x, y, kind: 'strait', score: coastNavigability[idx] + 0.2 })
        continue
      }

      if (coastNavigability[idx] >= 0.75 && isShelteredAnchorage(ocean, width, height, x, y)) {
        candidates.push({ x, y, kind: 'anchorage', score: coastNavigability[idx] + 0.15 })
        continue
      }

      if (elevation[idx] >= seaLevel - 0.08 && coastNavigability[idx] >= 0.5) {
        candidates.push({ x, y, kind: 'extraction', score: coastNavigability[idx] })
      }
    }
  }

  const selected = selectSpacedCandidates(candidates, 64, 4)
  for (const candidate of selected) {
    nodes.push({
      id: `coast-${counter}`,
      x: candidate.x,
      y: candidate.y,
      kind: candidate.kind,
    })
    counter += 1
  }

  return nodes
}

/**
 * @param {boolean[]} ocean
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 */
function isCoastOceanCell(ocean, width, height, x, y) {
  const neighbors = [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]
  for (const [nx, ny] of neighbors) {
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
    if (!ocean[ny * width + nx]) return true
  }
  return false
}

/**
 * @param {Array<{ x: number, y: number, kind: string, score: number }>} candidates
 * @param {number} maxCount
 * @param {number} minDistance
 */
function selectSpacedCandidates(candidates, maxCount, minDistance) {
  candidates.sort((a, b) => b.score - a.score)
  const kept = []
  for (const candidate of candidates) {
    const tooClose = kept.some(
      (other) =>
        other.kind === candidate.kind &&
        Math.hypot(other.x - candidate.x, other.y - candidate.y) < minDistance,
    )
    if (tooClose) continue
    kept.push(candidate)
    if (kept.length >= maxCount) break
  }
  return kept
}

/**
 * @param {Float32Array} elevation
 * @param {boolean[]} ocean
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @param {number} seaLevel
 */
function isStrait(elevation, ocean, width, height, x, y, seaLevel) {
  const landLeft = x > 0 && !ocean[y * width + (x - 1)]
  const landRight = x < width - 1 && !ocean[y * width + (x + 1)]
  const landUp = y > 0 && !ocean[(y - 1) * width + x]
  const landDown = y < height - 1 && !ocean[(y + 1) * width + x]
  const narrow =
    (landLeft && landRight && !landUp && !landDown) ||
    (landUp && landDown && !landLeft && !landRight)
  return narrow && elevation[y * width + x] >= seaLevel - 0.12
}

/**
 * @param {boolean[]} ocean
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 */
function isShelteredAnchorage(ocean, width, height, x, y) {
  let landCount = 0
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (!ocean[ny * width + nx]) landCount += 1
    }
  }
  return landCount >= 8
}
