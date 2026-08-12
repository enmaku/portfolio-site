/**
 * Binary min-heap helpers for grid path Dijkstra (dist-keyed).
 */

/**
 * @param {Array<{ index: number, dist: number }>} heap
 * @param {{ index: number, dist: number }} entry
 */
export function pushMinDistance(heap, entry) {
  heap.push(entry)
  let i = heap.length - 1
  while (i > 0) {
    const parent = (i - 1) >> 1
    if (heap[parent].dist <= heap[i].dist) break
    const swap = heap[parent]
    heap[parent] = heap[i]
    heap[i] = swap
    i = parent
  }
}

/**
 * @param {Array<{ index: number, dist: number }>} heap
 * @returns {{ index: number, dist: number } | undefined}
 */
export function popMinDistance(heap) {
  if (heap.length === 0) return undefined
  const min = heap[0]
  const last = heap.pop()
  if (heap.length === 0 || last === undefined) return min
  heap[0] = last
  let i = 0
  while (true) {
    const left = i * 2 + 1
    const right = left + 1
    let smallest = i
    if (left < heap.length && heap[left].dist < heap[smallest].dist) smallest = left
    if (right < heap.length && heap[right].dist < heap[smallest].dist) smallest = right
    if (smallest === i) break
    const swap = heap[i]
    heap[i] = heap[smallest]
    heap[smallest] = swap
    i = smallest
  }
  return min
}
