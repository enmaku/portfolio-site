import assert from 'node:assert/strict'

const D4_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

const FLAT_EPSILON = 1e-5
const META_EPSILON = 1e-4

/**
 * Assert each lake-mask component is flat and aligned with lakeMeta.surfaceElevation.
 * @param {Object} params
 * @param {Uint8Array} params.lakeMask
 * @param {import('../types.js').LakeRecord[] | null | undefined} params.lakes
 * @param {import('../types.js').LakeMetaRecord[]} params.lakeMeta
 * @param {Float32Array} params.elevation
 * @param {number} params.width
 * @param {number} params.height
 */
export function assertLakeMaskSurfacesMatchMeta({
  lakeMask,
  lakes,
  lakeMeta,
  elevation,
  width,
  height,
}) {
  assert.ok(lakeMask)
  assert.ok(lakeMeta)
  assert.ok(elevation)
  assert.ok(lakeMeta.length > 0, 'expected lakes to assert lake display coherence')

  const components = collectLakeComponents(lakeMask, width, height)
  components.sort((left, right) => Math.min(...left) - Math.min(...right))

  const lakeRecords = lakes ?? []
  const usedLakeIds = new Set()
  for (let componentIndex = 0; componentIndex < components.length; componentIndex += 1) {
    const cells = components[componentIndex]
    const lakeId = matchComponentToLakeId(cells, lakeRecords, lakeMeta, elevation, width, usedLakeIds)
    assert.notStrictEqual(
      lakeId,
      undefined,
      `lake-mask component ${componentIndex} must map to a lake record`,
    )

    usedLakeIds.add(lakeId)
    const meta = lakeMeta[lakeId]
    const elevations = cells.map((cellIdx) => elevation[cellIdx])
    const surface = elevations[0]
    for (const elev of elevations) {
      assert.ok(Math.abs(elev - surface) < FLAT_EPSILON)
      assert.ok(Math.abs(elev - meta.surfaceElevation) < META_EPSILON)
    }
  }

  assert.strictEqual(
    usedLakeIds.size,
    components.length,
    'every lake-mask component must map to a distinct lake record',
  )
}

/**
 * @param {Uint8Array} lakeMask
 * @param {number} width
 * @param {number} height
 * @returns {number[][]}
 */
function collectLakeComponents(lakeMask, width, height) {
  /** @type {number[][]} */
  const components = []
  const visited = new Uint8Array(lakeMask.length)

  for (let cellIdx = 0; cellIdx < lakeMask.length; cellIdx += 1) {
    if (!lakeMask[cellIdx] || visited[cellIdx]) continue

    /** @type {number[]} */
    const cells = []
    const stack = [cellIdx]
    while (stack.length > 0) {
      const current = stack.pop()
      if (current === undefined || visited[current] || !lakeMask[current]) continue
      visited[current] = 1
      cells.push(current)

      const x = current % width
      const y = Math.floor(current / width)
      for (const [dx, dy] of D4_OFFSETS) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        stack.push(ny * width + nx)
      }
    }
    components.push(cells)
  }

  return components
}

/**
 * @param {number[]} cells
 * @param {import('../types.js').LakeRecord[]} lakes
 * @param {import('../types.js').LakeMetaRecord[]} lakeMeta
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {Set<number>} usedLakeIds
 * @returns {number | undefined}
 */
function matchComponentToLakeId(cells, lakes, lakeMeta, elevation, width, usedLakeIds) {
  const cellSet = new Set(cells)
  let matchedLakeId

  for (let lakeId = 0; lakeId < lakes.length; lakeId += 1) {
    if (usedLakeIds.has(lakeId)) continue
    const lake = lakes[lakeId]
    if (lake.endorheic || lake.spillX === undefined || lake.spillY === undefined) continue
    const spillIdx = lake.spillY * width + lake.spillX
    if (isAdjacentToCells(spillIdx, cellSet, width)) {
      matchedLakeId = lakeId
      break
    }
  }

  if (matchedLakeId === undefined) {
    const meanElev = cells.reduce((sum, cellIdx) => sum + elevation[cellIdx], 0) / cells.length
    let bestDelta = Number.POSITIVE_INFINITY
    for (let lakeId = 0; lakeId < lakeMeta.length; lakeId += 1) {
      if (usedLakeIds.has(lakeId) || !lakeMeta[lakeId].endorheic) continue
      const delta = Math.abs(lakeMeta[lakeId].surfaceElevation - meanElev)
      if (
        delta < bestDelta ||
        (delta === bestDelta && lakeId < (matchedLakeId ?? Number.MAX_SAFE_INTEGER))
      ) {
        bestDelta = delta
        matchedLakeId = lakeId
      }
    }
  }

  return matchedLakeId
}

/**
 * @param {number} cellIdx
 * @param {Set<number>} cellSet
 * @param {number} width
 */
function isAdjacentToCells(cellIdx, cellSet, width) {
  const x = cellIdx % width
  const y = Math.floor(cellIdx / width)
  for (const [dx, dy] of D4_OFFSETS) {
    const nx = x + dx
    const ny = y + dy
    if (cellSet.has(ny * width + nx)) return true
  }
  return false
}
