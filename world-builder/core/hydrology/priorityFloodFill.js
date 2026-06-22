import { SEA_LEVEL } from '../biomeIds.js'

const D4_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

class MinHeap {
  constructor() {
    /** @type {Array<[number, number]>} */
    this.data = []
  }

  /** @param {number} idx @param {number} priority */
  push(idx, priority) {
    const { data } = this
    data.push([idx, priority])
    let i = data.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (data[parent][1] <= data[i][1]) break
      const swap = data[parent]
      data[parent] = data[i]
      data[i] = swap
      i = parent
    }
  }

  /** @returns {[number, number] | undefined} */
  pop() {
    const { data } = this
    const top = data[0]
    const last = data.pop()
    if (data.length > 0 && last) {
      data[0] = last
      let i = 0
      while (true) {
        let smallest = i
        const left = 2 * i + 1
        const right = 2 * i + 2
        if (left < data.length && data[left][1] < data[smallest][1]) {
          smallest = left
        }
        if (right < data.length && data[right][1] < data[smallest][1]) {
          smallest = right
        }
        if (smallest === i) break
        const swap = data[i]
        data[i] = data[smallest]
        data[smallest] = swap
        i = smallest
      }
    }
    return top
  }

  get size() {
    return this.data.length
  }
}

/**
 * Priority-flood depression fill (Wang–Liu / Zhou style) on a working DEM.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 * @param {boolean[]} params.ocean
 * @param {number} [params.seaLevel]
 * @returns {{ filledElevation: Float32Array, spillOutlet: Int32Array }}
 */
export function priorityFloodFill({
  elevation,
  width,
  height,
  ocean,
  seaLevel = SEA_LEVEL,
}) {
  const cellCount = width * height
  const filled = new Float32Array(elevation)
  const spillOutlet = new Int32Array(cellCount).fill(-1)
  const closed = new Uint8Array(cellCount)
  const heap = new MinHeap()

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1
      if (!isBorder && !ocean[idx]) continue

      closed[idx] = 1
      const boundaryElev = ocean[idx] ? seaLevel : filled[idx]
      filled[idx] = boundaryElev
      spillOutlet[idx] = idx
      heap.push(idx, boundaryElev)
    }
  }

  while (heap.size > 0) {
    const entry = heap.pop()
    if (!entry) break
    const [idx, spillElev] = entry
    const x = idx % width
    const y = Math.floor(idx / width)
    const outletIdx = spillOutlet[idx] >= 0 ? spillOutlet[idx] : idx

    for (const [dx, dy] of D4_OFFSETS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (closed[nIdx]) continue

      closed[nIdx] = 1
      if (filled[nIdx] < spillElev) {
        filled[nIdx] = spillElev
        spillOutlet[nIdx] = outletIdx
      }
      heap.push(nIdx, filled[nIdx])
    }
  }

  return { filledElevation: filled, spillOutlet }
}
