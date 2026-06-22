/** @typedef {{ x: number, y: number }} Vec2 */

/**
 * @param {number} fromIdx
 * @param {number} toIdx
 * @param {number} width
 * @returns {Vec2}
 */
export function unitVector(fromIdx, toIdx, width) {
  const dx = (toIdx % width) - (fromIdx % width)
  const dy = Math.floor(toIdx / width) - Math.floor(fromIdx / width)
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

/**
 * @param {Vec2} left
 * @param {Vec2} right
 */
export function angleDegrees(left, right) {
  const dot = Math.max(-1, Math.min(1, left.x * right.x + left.y * right.y))
  return (Math.acos(dot) * 180) / Math.PI
}

/**
 * @param {Vec2} vector
 */
export function normalizeVector(vector) {
  const len = Math.hypot(vector.x, vector.y) || 1
  return { x: vector.x / len, y: vector.y / len }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 */
export function clampCellIndex(x, y, width, height) {
  const cx = Math.max(0, Math.min(width - 1, x))
  const cy = Math.max(0, Math.min(height - 1, y))
  return cy * width + cx
}

/**
 * @param {number} idx
 * @param {Float32Array} elevation
 * @param {boolean[]} ocean
 * @param {number} width
 * @param {number} height
 * @param {number} searchRadius
 */
export function snapToValleyCell(idx, elevation, ocean, width, height, searchRadius) {
  const cx = idx % width
  const cy = Math.floor(idx / width)
  let bestIdx = idx
  let bestElev = ocean[idx] ? Number.POSITIVE_INFINITY : elevation[idx]

  for (let dy = -searchRadius; dy <= searchRadius; dy += 1) {
    for (let dx = -searchRadius; dx <= searchRadius; dx += 1) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (ocean[nIdx]) continue
      if (elevation[nIdx] < bestElev) {
        bestElev = elevation[nIdx]
        bestIdx = nIdx
      }
    }
  }

  return bestIdx
}

/**
 * @param {Object} params
 * @param {number} params.fromIdx
 * @param {number} params.toIdx
 * @param {number} params.width
 * @param {number} params.height
 * @param {() => number} params.random
 * @param {number} params.depth
 * @param {number} [params.wiggleScale]
 * @returns {number[]}
 */
export function buildFractalWaypoints({
  fromIdx,
  toIdx,
  width,
  height,
  random,
  depth,
  wiggleScale = 1,
}) {
  if (depth <= 0 || fromIdx === toIdx) {
    return [fromIdx, toIdx]
  }

  const ax = fromIdx % width
  const ay = Math.floor(fromIdx / width)
  const bx = toIdx % width
  const by = Math.floor(toIdx / width)
  const dx = bx - ax
  const dy = by - ay
  const span = Math.hypot(dx, dy)
  if (span < 3) {
    return [fromIdx, toIdx]
  }

  const nx = -dy / span
  const ny = dx / span
  const jitter =
    wiggleScale *
    (random() * 2 - 1) *
    span *
    ((0.28 + random() * 0.42) / Math.sqrt(depth))
  const mx = Math.round(ax + dx * 0.5 + nx * jitter)
  const my = Math.round(ay + dy * 0.5 + ny * jitter)
  const midIdx = clampCellIndex(mx, my, width, height)

  const left = buildFractalWaypoints({
    fromIdx,
    toIdx: midIdx,
    width,
    height,
    random,
    depth: depth - 1,
    wiggleScale,
  })
  const right = buildFractalWaypoints({
    fromIdx: midIdx,
    toIdx,
    width,
    height,
    random,
    depth: depth - 1,
    wiggleScale,
  })

  return [...left.slice(0, -1), ...right]
}

/**
 * @param {Object} params
 * @param {number} params.fromIdx
 * @param {number} params.toIdx
 * @param {Float32Array} params.elevation
 * @param {boolean[]} params.ocean
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} [params.heuristicWeight]
 * @param {Vec2 | null} [params.preferredArrivalDir]
 * @param {boolean} [params.downhillOnly]
 * @param {boolean} [params.preferDownhill]
 * @param {number} [params.uphillTolerance]
 * @returns {number[] | null}
 */
export function findLeastResistancePath({
  fromIdx,
  toIdx,
  elevation,
  ocean,
  width,
  height,
  heuristicWeight = 1,
  preferredArrivalDir = null,
  downhillOnly = false,
  preferDownhill = false,
  uphillTolerance = 0.00015,
}) {
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
  gScore[fromIdx] = elevation[fromIdx]
  open.push(fromIdx)

  let visits = 0
  while (open.length > 0) {
    open.sort((a, b) => {
      const fa =
        gScore[a] + heuristic(a, goalX, goalY, width, elevation) * heuristicWeight
      const fb =
        gScore[b] + heuristic(b, goalX, goalY, width, elevation) * heuristicWeight
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
        if (ocean[next] || closed[next]) continue

        const stepLength = dx === 0 || dy === 0 ? 1 : Math.SQRT2
        const climb = Math.max(0, elevation[next] - currentElev)
        if (downhillOnly && climb > uphillTolerance) continue
        const uphillPenalty = preferDownhill && climb > uphillTolerance ? climb * 40 : climb * 2
        let turnPenalty = 0
        if (prevDir) {
          const stepDir = unitVector(current, next, width)
          const turnDeg = angleDegrees(prevDir, stepDir)
          if (turnDeg > 75) turnPenalty = 0.12
          else if (turnDeg > 45) turnPenalty = 0.04
        }
        if (next === toIdx && preferredArrivalDir) {
          const arriveDir = unitVector(current, next, width)
          const arriveDeg = angleDegrees(arriveDir, preferredArrivalDir)
          if (arriveDeg > 55) turnPenalty += 0.15
          else if (arriveDeg > 35) turnPenalty += 0.05
        }
        const tentative =
          gScore[current] +
          elevation[next] * stepLength +
          uphillPenalty +
          stepLength * 0.01 +
          turnPenalty
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
 * @param {number} idx
 * @param {number} goalX
 * @param {number} goalY
 * @param {number} width
 * @param {Float32Array} elevation
 */
function heuristic(idx, goalX, goalY, width, elevation) {
  const x = idx % width
  const y = Math.floor(idx / width)
  const dist = Math.hypot(x - goalX, y - goalY)
  return dist * (elevation[idx] + 0.05)
}

/**
 * @param {Int32Array} cameFrom
 * @param {number} goalIdx
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
