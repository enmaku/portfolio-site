/**
 * @typedef {{ x: number, y: number }} GridCell
 */

/**
 * @param {{
 *   origin: GridCell,
 *   threeDayHaulDistance: number,
 *   gridWidth: number,
 *   gridHeight: number,
 *   movementCost?: Float32Array | null,
 * }} params
 * @returns {GridCell[]}
 */
export function computeHaulShedReachPreview(params) {
  const { origin, threeDayHaulDistance, gridWidth, gridHeight, movementCost } = params
  if (
    !origin ||
    !Number.isFinite(threeDayHaulDistance) ||
    threeDayHaulDistance <= 0 ||
    !Number.isInteger(gridWidth) ||
    !Number.isInteger(gridHeight)
  ) {
    return []
  }

  if (movementCost && movementCost.length === gridWidth * gridHeight) {
    return computeIsochroneReach({
      origin,
      budget: threeDayHaulDistance,
      gridWidth,
      gridHeight,
      movementCost,
    })
  }

  return computeCircleReach({
    origin,
    radius: threeDayHaulDistance,
    gridWidth,
    gridHeight,
  })
}

/**
 * @param {{
 *   origin: GridCell,
 *   radius: number,
 *   gridWidth: number,
 *   gridHeight: number,
 * }} params
 * @returns {GridCell[]}
 */
function computeCircleReach({ origin, radius, gridWidth, gridHeight }) {
  /** @type {GridCell[]} */
  const cells = []
  const radiusSq = radius * radius
  const minX = Math.max(0, Math.floor(origin.x - radius))
  const maxX = Math.min(gridWidth - 1, Math.ceil(origin.x + radius))
  const minY = Math.max(0, Math.floor(origin.y - radius))
  const maxY = Math.min(gridHeight - 1, Math.ceil(origin.y + radius))

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - origin.x
      const dy = y - origin.y
      if (dx * dx + dy * dy <= radiusSq) {
        cells.push({ x, y })
      }
    }
  }
  return cells
}

/**
 * @param {{
 *   origin: GridCell,
 *   budget: number,
 *   gridWidth: number,
 *   gridHeight: number,
 *   movementCost: Float32Array,
 * }} params
 * @returns {GridCell[]}
 */
function computeIsochroneReach({ origin, budget, gridWidth, gridHeight, movementCost }) {
  const cellCount = gridWidth * gridHeight
  const travelTime = new Float32Array(cellCount).fill(Number.POSITIVE_INFINITY)
  const originIndex = origin.y * gridWidth + origin.x
  if (originIndex < 0 || originIndex >= cellCount) {
    return []
  }

  travelTime[originIndex] = 0
  /** @type {Array<{ x: number, y: number, time: number }>} */
  const heap = [{ x: origin.x, y: origin.y, time: 0 }]

  while (heap.length > 0) {
    const current = popMinTravelTime(heap)
    if (!current) break
    const currentIndex = current.y * gridWidth + current.x
    if (current.time > travelTime[currentIndex]) continue

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue
        const nx = current.x + dx
        const ny = current.y + dy
        if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
        const nextIndex = ny * gridWidth + nx
        const stepCost = movementCost[nextIndex]
        if (!Number.isFinite(stepCost) || stepCost <= 0) continue
        const diagonalScale = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1
        const nextTime = current.time + stepCost * diagonalScale
        if (nextTime > budget || nextTime >= travelTime[nextIndex]) continue
        travelTime[nextIndex] = nextTime
        pushMinTravelTime(heap, { x: nx, y: ny, time: nextTime })
      }
    }
  }

  /** @type {GridCell[]} */
  const cells = []
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      if (travelTime[y * gridWidth + x] <= budget) {
        cells.push({ x, y })
      }
    }
  }
  return cells
}

/**
 * @param {Array<{ x: number, y: number, time: number }>} heap
 * @param {{ x: number, y: number, time: number }} entry
 */
function pushMinTravelTime(heap, entry) {
  heap.push(entry)
  let index = heap.length - 1
  while (index > 0) {
    const parent = (index - 1) >> 1
    if (heap[parent].time <= heap[index].time) break
    const swap = heap[parent]
    heap[parent] = heap[index]
    heap[index] = swap
    index = parent
  }
}

/**
 * @param {Array<{ x: number, y: number, time: number }>} heap
 * @returns {{ x: number, y: number, time: number } | undefined}
 */
function popMinTravelTime(heap) {
  if (heap.length === 0) return undefined
  const min = heap[0]
  const last = heap.pop()
  if (heap.length === 0 || last === undefined) return min
  heap[0] = last
  let index = 0
  while (true) {
    const left = index * 2 + 1
    const right = left + 1
    let smallest = index
    if (left < heap.length && heap[left].time < heap[smallest].time) {
      smallest = left
    }
    if (right < heap.length && heap[right].time < heap[smallest].time) {
      smallest = right
    }
    if (smallest === index) break
    const swap = heap[index]
    heap[index] = heap[smallest]
    heap[smallest] = swap
    index = smallest
  }
  return min
}
