/**
 * Primary-claim hinterland adjacency for political pressure.
 * Domain: world-builder/CONTEXT.md — Primary claim; Political pressure; ADR 0018.
 */

/**
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
export function undirectedSettlementPairKey(a, b) {
  return a <= b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Directed key: border cells of `from` that touch `to`.
 * @param {string} from
 * @param {string} to
 * @returns {string}
 */
export function directedSettlementPairKey(from, to) {
  return `${from}|${to}`
}

/**
 * One cellular sweep: undirected adjacency + directed frontier cell counts.
 * Directed count matches `countSharedPrimaryClaimBorderCells` (A-cells abutting B).
 *
 * @param {{
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>> | null,
 *   settlementIds?: string[] | null,
 *   gridWidth: number,
 *   gridHeight: number,
 * }} params
 * @returns {{
 *   adjacencyPairs: Set<string>,
 *   borderCountByDirectedPair: Map<string, number>,
 * }}
 */
export function buildPrimaryClaimContact(params) {
  const primaryClaim = params.primaryClaim ?? {}
  const settlementIds = params.settlementIds ?? Object.keys(primaryClaim)
  const { gridWidth, gridHeight } = params
  /** @type {Map<number, string>} */
  const ownerByCell = new Map()
  for (const id of settlementIds) {
    const cells = primaryClaim[id]
    if (!Array.isArray(cells)) continue
    for (const cell of cells) {
      if (!cell || typeof cell.x !== 'number' || typeof cell.y !== 'number') continue
      if (cell.x < 0 || cell.y < 0 || cell.x >= gridWidth || cell.y >= gridHeight) continue
      ownerByCell.set(cell.y * gridWidth + cell.x, id)
    }
  }

  /** @type {Set<string>} */
  const adjacencyPairs = new Set()
  /** @type {Map<string, number>} */
  const borderCountByDirectedPair = new Map()
  const deltas = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  for (const [idx, owner] of ownerByCell) {
    const x = idx % gridWidth
    const y = Math.floor(idx / gridWidth)
    /** @type {Set<string>} */
    const borderedOthers = new Set()
    for (const [dx, dy] of deltas) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      const other = ownerByCell.get(ny * gridWidth + nx)
      if (!other || other === owner) continue
      borderedOthers.add(other)
      adjacencyPairs.add(undirectedSettlementPairKey(owner, other))
    }
    for (const other of borderedOthers) {
      const key = directedSettlementPairKey(owner, other)
      borderCountByDirectedPair.set(key, (borderCountByDirectedPair.get(key) ?? 0) + 1)
    }
  }
  return { adjacencyPairs, borderCountByDirectedPair }
}

/**
 * @param {{
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>> | null,
 *   settlementIds?: string[] | null,
 *   gridWidth: number,
 *   gridHeight: number,
 * }} params
 * @returns {Set<string>} undirected pair keys `a|b`
 */
export function buildPrimaryClaimAdjacencyUndirected(params) {
  return buildPrimaryClaimContact(params).adjacencyPairs
}

/**
 * Count of 4-connected shared frontier cells between A and B
 * (each bordering A-cell adjacent to a B-cell counts once for A).
 *
 * @param {{
 *   primaryClaim?: Record<string, Array<{ x: number, y: number }>> | null,
 *   settlementIdA: string,
 *   settlementIdB: string,
 *   gridWidth: number,
 *   gridHeight: number,
 * }} params
 * @returns {number}
 */
export function countSharedPrimaryClaimBorderCells(params) {
  const { settlementIdA, settlementIdB, gridWidth, gridHeight } = params
  const primaryClaim = params.primaryClaim ?? {}
  const cellsA = primaryClaim[settlementIdA]
  const cellsB = primaryClaim[settlementIdB]
  if (!Array.isArray(cellsA) || !Array.isArray(cellsB)) return 0

  /** @type {Set<number>} */
  const bSet = new Set()
  for (const cell of cellsB) {
    if (!cell || typeof cell.x !== 'number' || typeof cell.y !== 'number') continue
    bSet.add(cell.y * gridWidth + cell.x)
  }

  const deltas = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  let count = 0
  for (const cell of cellsA) {
    if (!cell || typeof cell.x !== 'number' || typeof cell.y !== 'number') continue
    if (cell.x < 0 || cell.y < 0 || cell.x >= gridWidth || cell.y >= gridHeight) continue
    for (const [dx, dy] of deltas) {
      const nx = cell.x + dx
      const ny = cell.y + dy
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      if (bSet.has(ny * gridWidth + nx)) {
        count += 1
        break
      }
    }
  }
  return count
}
