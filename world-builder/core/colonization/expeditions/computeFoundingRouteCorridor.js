import { angleDegrees, unitVector } from '../../hydrology/riverPathfinding.js'
import { DEFAULT_ROAD_MOVEMENT_MULTIPLIER } from '../roads/roadNetwork.js'
import { buildDryLandTraversableMask } from './buildDryLandTraversableMask.js'
import { resolveSailTraversableMask } from './expeditionRouting.js'
import { SAIL_EXPEDITION_MAX_SHORE_DISTANCE } from './selectSailExpeditionStep.js'

/** Max climb per step for wheeled founding routes (normalized elevation units). */
export const MAX_WHEELED_SLOPE = 0.1

/** Weight for squared uphill penalty (Game Developer tortuosity tuning). */
export const CLIMB_PENALTY_WEIGHT = 10

/** Cost multiplier for cells in local elevation valleys (bottom quartile TPI). */
export const VALLEY_BIAS_FACTOR = 0.85

/** Per-cell penalty for sail routes farther from dry land (Chebyshev distance). */
export const SAIL_SHORE_DISTANCE_PENALTY = 0.04

/**
 * @typedef {Object} FoundingRouteCorridor
 * @property {'land' | 'sail'} mode
 * @property {Array<{ x: number, y: number }>} cells
 */

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to
 * @param {'land' | 'sail'} mode
 * @param {Uint8Array | null} [roadCellMask]
 * @param {number} [roadMultiplier]
 * @param {Uint8Array | null} [dryLandMask]
 * @param {Uint8Array | null} [sailMask]
 * @returns {FoundingRouteCorridor | null}
 */
export function computeFoundingRouteCorridor(params) {
  const {
    doc,
    from,
    to,
    mode,
    roadCellMask = null,
    roadMultiplier = DEFAULT_ROAD_MOVEMENT_MULTIPLIER,
    dryLandMask: dryLandMaskInput = null,
    sailMask: sailMaskInput = null,
  } = params

  const { gridWidth, gridHeight } = doc
  const fromIdx = from.y * gridWidth + from.x
  const toIdx = to.y * gridWidth + to.x

  if (mode === 'sail') {
    const sailMask = sailMaskInput ?? resolveSailTraversableMask(doc)
    const dryLandMask = dryLandMaskInput ?? buildDryLandTraversableMask(doc)
    if (!sailMask) return null
    const pathIndices = findFoundingSailPath({
      fromIdx,
      toIdx,
      sailMask,
      dryLandMask,
      width: gridWidth,
      height: gridHeight,
    })
    if (!pathIndices) return null
    return {
      mode: 'sail',
      cells: pathIndices.map((idx) => ({ x: idx % gridWidth, y: Math.floor(idx / gridWidth) })),
    }
  }

  const dryLandMask = dryLandMaskInput ?? buildDryLandTraversableMask(doc)
  const elevation = doc.fields?.elevation ?? new Float32Array(gridWidth * gridHeight).fill(0.5)
  const movementCost = doc.movementCost
  const valleyBiasMask = buildValleyBiasMask(elevation, dryLandMask, gridWidth, gridHeight)

  const pathIndices = findFoundingLandPath({
    fromIdx,
    toIdx,
    elevation,
    dryLandMask,
    movementCost,
    valleyBiasMask,
    roadCellMask,
    roadMultiplier,
    width: gridWidth,
    height: gridHeight,
  })
  if (!pathIndices) return null

  return {
    mode: 'land',
    cells: pathIndices.map((idx) => ({ x: idx % gridWidth, y: Math.floor(idx / gridWidth) })),
  }
}

/**
 * @param {Float32Array} elevation
 * @param {Uint8Array} dryLandMask
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array}
 */
function buildValleyBiasMask(elevation, dryLandMask, width, height) {
  const cellCount = width * height
  const tpi = new Float32Array(cellCount)
  /** @type {number[]} */
  const samples = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      if (dryLandMask[index] !== 1) continue
      let sum = 0
      let count = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const nIdx = ny * width + nx
          if (dryLandMask[nIdx] !== 1) continue
          sum += elevation[nIdx]
          count += 1
        }
      }
      const localMean = count > 0 ? sum / count : elevation[index]
      tpi[index] = elevation[index] - localMean
      samples.push(tpi[index])
    }
  }

  const mask = new Uint8Array(cellCount)
  if (samples.length === 0) return mask

  samples.sort((a, b) => a - b)
  const threshold = samples[Math.floor(samples.length * 0.25)] ?? samples[0]
  for (let i = 0; i < cellCount; i += 1) {
    if (dryLandMask[i] === 1 && tpi[i] <= threshold) {
      mask[i] = 1
    }
  }
  return mask
}

/**
 * @param {Object} params
 * @param {number} params.fromIdx
 * @param {number} params.toIdx
 * @param {Float32Array} params.elevation
 * @param {Uint8Array} params.dryLandMask
 * @param {Float32Array | null | undefined} params.movementCost
 * @param {Uint8Array} params.valleyBiasMask
 * @param {Uint8Array | null} params.roadCellMask
 * @param {number} params.roadMultiplier
 * @param {number} params.width
 * @param {number} params.height
 * @returns {number[] | null}
 */
function findFoundingLandPath({
  fromIdx,
  toIdx,
  elevation,
  dryLandMask,
  movementCost,
  valleyBiasMask,
  roadCellMask,
  roadMultiplier,
  width,
  height,
}) {
  if (dryLandMask[fromIdx] !== 1 || dryLandMask[toIdx] !== 1) {
    return null
  }

  const cellCount = width * height
  const goalX = toIdx % width
  const goalY = Math.floor(toIdx / width)
  const startX = fromIdx % width
  const startY = Math.floor(fromIdx / width)
  const straightDist = Math.hypot(goalX - startX, goalY - startY)
  const visitLimit = Math.min(cellCount, Math.ceil((straightDist * 5 + 16) ** 2))

  const gScore = new Float64Array(cellCount).fill(Number.POSITIVE_INFINITY)
  const cameFrom = new Int32Array(cellCount).fill(-1)
  const closed = new Uint8Array(cellCount)

  /** @type {number[]} */
  const open = []
  gScore[fromIdx] = 0
  open.push(fromIdx)

  let visits = 0
  while (open.length > 0) {
    open.sort((a, b) => {
      const fa = gScore[a] + landHeuristic(a, goalX, goalY, width)
      const fb = gScore[b] + landHeuristic(b, goalX, goalY, width)
      return fa - fb
    })
    const current = open.shift()
    if (current === undefined) break
    if (closed[current]) continue
    closed[current] = 1
    visits += 1
    if (visits > visitLimit) break
    if (current === toIdx) {
      return reconstructPath(cameFrom, toIdx)
    }

    const cx = current % width
    const cy = Math.floor(current / width)
    const currentElev = elevation[current]
    const prev = cameFrom[current]
    const prevDir = prev >= 0 ? unitVector(prev, current, width) : null

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const next = ny * width + nx
        if (dryLandMask[next] !== 1 || closed[next]) continue

        const stepLength = dx === 0 || dy === 0 ? 1 : Math.SQRT2
        const climb = Math.max(0, elevation[next] - currentElev)
        const slope = climb / stepLength
        if (slope > MAX_WHEELED_SLOPE) continue

        const normalizedSlope = slope / MAX_WHEELED_SLOPE
        const climbPenalty = normalizedSlope * normalizedSlope * CLIMB_PENALTY_WEIGHT

        let turnPenalty = 0
        if (prevDir) {
          const stepDir = unitVector(current, next, width)
          const turnDeg = angleDegrees(prevDir, stepDir)
          if (turnDeg > 75) turnPenalty = 0.12
          else if (turnDeg > 45) turnPenalty = 0.04
        }

        let base = 1
        if (movementCost && movementCost.length === cellCount && movementCost[next] > 0) {
          base = movementCost[next]
        }
        if (roadCellMask?.[next] === 1) {
          base *= roadMultiplier
        }
        if (valleyBiasMask[next] === 1) {
          base *= VALLEY_BIAS_FACTOR
        }

        const tentative =
          gScore[current] + base * stepLength + climbPenalty + turnPenalty
        if (tentative >= gScore[next]) continue

        cameFrom[next] = current
        gScore[next] = tentative
        open.push(next)
      }
    }
  }

  return null
}

/**
 * @param {Object} params
 * @param {number} params.fromIdx
 * @param {number} params.toIdx
 * @param {Uint8Array} params.sailMask
 * @param {Uint8Array} params.dryLandMask
 * @param {number} params.width
 * @param {number} params.height
 * @returns {number[] | null}
 */
function findFoundingSailPath({ fromIdx, toIdx, sailMask, dryLandMask, width, height }) {
  if (sailMask[fromIdx] !== 1 || sailMask[toIdx] !== 1) {
    return null
  }
  if (
    !isWithinDryLandDistance(fromIdx, dryLandMask, width, height, SAIL_EXPEDITION_MAX_SHORE_DISTANCE) ||
    !isWithinDryLandDistance(toIdx, dryLandMask, width, height, SAIL_EXPEDITION_MAX_SHORE_DISTANCE)
  ) {
    return null
  }

  const cellCount = width * height
  const shoreDistance = buildShoreDistanceField(dryLandMask, width, height, SAIL_EXPEDITION_MAX_SHORE_DISTANCE)
  const goalX = toIdx % width
  const goalY = Math.floor(toIdx / width)
  const startX = fromIdx % width
  const startY = Math.floor(fromIdx / width)
  const straightDist = Math.hypot(goalX - startX, goalY - startY)
  const visitLimit = Math.min(cellCount, Math.ceil((straightDist * 5 + 16) ** 2))

  const gScore = new Float64Array(cellCount).fill(Number.POSITIVE_INFINITY)
  const cameFrom = new Int32Array(cellCount).fill(-1)
  const closed = new Uint8Array(cellCount)

  /** @type {number[]} */
  const open = []
  gScore[fromIdx] = 0
  open.push(fromIdx)

  let visits = 0
  while (open.length > 0) {
    open.sort((a, b) => {
      const fa = gScore[a] + sailHeuristic(a, goalX, goalY, width)
      const fb = gScore[b] + sailHeuristic(b, goalX, goalY, width)
      return fa - fb
    })
    const current = open.shift()
    if (current === undefined) break
    if (closed[current]) continue
    closed[current] = 1
    visits += 1
    if (visits > visitLimit) break
    if (current === toIdx) {
      return reconstructPath(cameFrom, toIdx)
    }

    const cx = current % width
    const cy = Math.floor(current / width)

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const next = ny * width + nx
        if (sailMask[next] !== 1 || closed[next]) continue
        if (
          !isWithinDryLandDistance(next, dryLandMask, width, height, SAIL_EXPEDITION_MAX_SHORE_DISTANCE)
        ) {
          continue
        }

        const stepLength = dx === 0 || dy === 0 ? 1 : Math.SQRT2
        const shorePenalty = shoreDistance[next] * SAIL_SHORE_DISTANCE_PENALTY
        const tentative = gScore[current] + 0.6 * stepLength + shorePenalty
        if (tentative >= gScore[next]) continue

        cameFrom[next] = current
        gScore[next] = tentative
        open.push(next)
      }
    }
  }

  return null
}

/**
 * @param {Uint8Array} dryLandMask
 * @param {number} width
 * @param {number} height
 * @param {number} maxDistance
 * @returns {Uint8Array}
 */
function buildShoreDistanceField(dryLandMask, width, height, maxDistance) {
  const cellCount = width * height
  const distance = new Uint8Array(cellCount).fill(maxDistance + 1)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      if (dryLandMask[index] !== 1) continue
      for (let dy = -maxDistance; dy <= maxDistance; dy += 1) {
        for (let dx = -maxDistance; dx <= maxDistance; dx += 1) {
          const chebyshev = Math.max(Math.abs(dx), Math.abs(dy))
          if (chebyshev > maxDistance) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const nIdx = ny * width + nx
          if (distance[nIdx] > chebyshev) {
            distance[nIdx] = chebyshev
          }
        }
      }
    }
  }

  return distance
}

/**
 * @param {number} index
 * @param {Uint8Array} dryLandMask
 * @param {number} width
 * @param {number} height
 * @param {number} maxDistance
 */
function isWithinDryLandDistance(index, dryLandMask, width, height, maxDistance) {
  const x = index % width
  const y = Math.floor(index / width)
  for (let dy = -maxDistance; dy <= maxDistance; dy += 1) {
    for (let dx = -maxDistance; dx <= maxDistance; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > maxDistance) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (dryLandMask[ny * width + nx] === 1) {
        return true
      }
    }
  }
  return false
}

/**
 * @param {number} idx
 * @param {number} goalX
 * @param {number} goalY
 * @param {number} width
 */
function landHeuristic(idx, goalX, goalY, width) {
  const x = idx % width
  const y = Math.floor(idx / width)
  return Math.hypot(x - goalX, y - goalY)
}

/**
 * @param {number} idx
 * @param {number} goalX
 * @param {number} goalY
 * @param {number} width
 */
function sailHeuristic(idx, goalX, goalY, width) {
  return landHeuristic(idx, goalX, goalY, width)
}

/**
 * @param {Int32Array} cameFrom
 * @param {number} goalIdx
 * @returns {number[]}
 */
function reconstructPath(cameFrom, goalIdx) {
  /** @type {number[]} */
  const path = [goalIdx]
  let current = goalIdx
  while (cameFrom[current] >= 0) {
    current = cameFrom[current]
    path.push(current)
  }
  path.reverse()
  return path
}
