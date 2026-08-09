const FILL_EPSILON = 1e-5
export const BANK_CRUMBLE_BREACH_EPSILON = 1e-4

const D4_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

/**
 * @param {import('../types.js').LakeMetaRecord} meta
 * @returns {number[]}
 */
export function getBankCrumbleOutletIdxs(meta) {
  if (meta.bankCrumbleOutletIdxs && meta.bankCrumbleOutletIdxs.length > 0) {
    return meta.bankCrumbleOutletIdxs
  }
  if (meta.overflowOutletIdx !== undefined) {
    return [meta.overflowOutletIdx]
  }
  return []
}

/**
 * @param {import('../types.js').LakeMetaRecord} meta
 * @param {Float32Array} elevation
 * @returns {number}
 */
export function pickLowestBankCrumbleOutletIdx(meta, elevation) {
  const outlets = getBankCrumbleOutletIdxs(meta)
  if (outlets.length === 0) return -1

  let bestIdx = outlets[0]
  let bestElev = elevation[bestIdx]
  for (let i = 1; i < outlets.length; i += 1) {
    const idx = outlets[i]
    const elev = elevation[idx]
    if (
      elev < bestElev - FILL_EPSILON ||
      (Math.abs(elev - bestElev) <= FILL_EPSILON && idx < bestIdx)
    ) {
      bestElev = elev
      bestIdx = idx
    }
  }
  return bestIdx
}

/**
 * @param {import('../types.js').LakeRecord[]} lakes
 * @param {import('../types.js').LakeMetaRecord[]} lakeMeta
 * @param {number} [count]
 * @returns {number[]}
 */
export function findLargestSeasonalLakeIds(lakes, lakeMeta, count = 1) {
  if (count <= 0) return []

  /** @type {number[]} */
  const ranked = []
  for (let lakeId = 0; lakeId < lakes.length; lakeId += 1) {
    if (lakeMeta[lakeId].outletX !== undefined) continue
    ranked.push(lakeId)
  }

  ranked.sort((leftId, rightId) => {
    const areaDelta = lakes[rightId].area - lakes[leftId].area
    if (areaDelta !== 0) return areaDelta
    return leftId - rightId
  })

  return ranked.slice(0, count)
}

/**
 * Lowest exterior rim cell not already opened by a prior bank collapse.
 * @param {number} lakeId
 * @param {Int32Array} lakeIdByCell
 * @param {Uint8Array} lakeMask
 * @param {Float32Array} elevation
 * @param {number} width
 * @param {number} height
 * @param {ReadonlySet<number>} [excludedOutletIdxs]
 * @returns {{ outletIdx: number, outletElev: number }}
 */
export function findLowestBankOutlet(
  lakeId,
  lakeIdByCell,
  lakeMask,
  elevation,
  width,
  height,
  excludedOutletIdxs = new Set(),
) {
  let outletIdx = -1
  let outletElev = Number.POSITIVE_INFINITY

  for (let idx = 0; idx < lakeIdByCell.length; idx += 1) {
    if (lakeIdByCell[idx] !== lakeId) continue

    const x = idx % width
    const y = Math.floor(idx / width)
    for (const [dx, dy] of D4_OFFSETS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue

      const neighborIdx = ny * width + nx
      if (lakeMask[neighborIdx] || lakeIdByCell[neighborIdx] === lakeId) continue
      if (excludedOutletIdxs.has(neighborIdx)) continue

      const neighborElev = elevation[neighborIdx]
      if (
        neighborElev < outletElev - FILL_EPSILON ||
        (Math.abs(neighborElev - outletElev) <= FILL_EPSILON && (outletIdx < 0 || neighborIdx < outletIdx))
      ) {
        outletElev = neighborElev
        outletIdx = neighborIdx
      }
    }
  }

  return { outletIdx, outletElev }
}

/**
 * @param {import('../types.js').LakeMetaRecord} meta
 * @param {import('../types.js').LakeRecord} lake
 * @param {number} outletIdx
 * @param {number} width
 */
function syncLakeSpillCoords(meta, lake, outletIdx, width) {
  meta.overflowOutletIdx = outletIdx
  lake.spillX = outletIdx % width
  lake.spillY = Math.floor(outletIdx / width)
}

/**
 * @param {Object} params
 * @param {number} params.lakeId
 * @param {number} params.outletIdx
 * @param {number} params.outletElev
 * @param {import('../types.js').LakeMetaRecord} params.meta
 * @param {import('../types.js').LakeRecord} params.lake
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.workingElevation
 * @param {Float32Array} params.effectiveRunoff
 * @param {Float64Array} params.waterLevelByLake
 * @param {Int32Array} params.lakeIdByCell
 * @param {Set<number>} params.overflowLakeIds
 * @param {number} params.width
 * @param {number} params.runoffToDepth
 */
export function applyLakeBankCrumble({
  lakeId,
  outletIdx,
  outletElev,
  meta,
  lake,
  elevation,
  workingElevation,
  effectiveRunoff,
  waterLevelByLake,
  lakeIdByCell,
  overflowLakeIds,
  width,
  runoffToDepth,
}) {
  if (outletIdx < 0 || !Number.isFinite(outletElev)) return false

  const openedOutlets = new Set(getBankCrumbleOutletIdxs(meta))
  if (openedOutlets.has(outletIdx)) return false

  openedOutlets.add(outletIdx)
  meta.bankCrumbleOutletIdxs = [...openedOutlets]

  const priorSpill = meta.spillElevation ?? meta.surfaceElevation
  meta.spillElevation = Math.min(priorSpill, outletElev)
  meta.hasOverflowed = true
  meta.endorheic = false
  lake.endorheic = false
  overflowLakeIds.add(lakeId)

  const spillOutletIdx = pickLowestBankCrumbleOutletIdx(meta, elevation)
  if (spillOutletIdx >= 0) {
    syncLakeSpillCoords(meta, lake, spillOutletIdx, width)
  }

  workingElevation[outletIdx] = outletElev - BANK_CRUMBLE_BREACH_EPSILON

  const spillElev = meta.spillElevation
  const floor = meta.floorElevation ?? meta.surfaceElevation
  let waterLevel = waterLevelByLake[lakeId]
  if (waterLevel > spillElev + FILL_EPSILON && spillOutletIdx >= 0) {
    const drained = waterLevel - spillElev
    effectiveRunoff[spillOutletIdx] = Math.max(
      effectiveRunoff[spillOutletIdx],
      drained / runoffToDepth,
    )
    waterLevel = spillElev
  }

  waterLevel = Math.min(spillElev, Math.max(floor, waterLevel))
  waterLevelByLake[lakeId] = waterLevel
  meta.waterLevel = waterLevel
  meta.surfaceElevation = waterLevel

  for (let idx = 0; idx < lakeIdByCell.length; idx += 1) {
    if (lakeIdByCell[idx] === lakeId) {
      workingElevation[idx] = waterLevel
    }
  }

  return true
}

/**
 * Each simulation year, open the n largest lakes at their next-lowest unused bank cell.
 * @param {Object} params
 * @param {import('../types.js').LakeRecord[]} params.lakes
 * @param {import('../types.js').LakeMetaRecord[]} params.lakeMeta
 * @param {Int32Array} params.lakeIdByCell
 * @param {Uint8Array} params.lakeMask
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.workingElevation
 * @param {Float32Array} params.effectiveRunoff
 * @param {Float64Array} params.waterLevelByLake
 * @param {Set<number>} params.overflowLakeIds
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.runoffToDepth
 * @param {number} [params.crumbleCount]
 * @returns {number}
 */
export function applyAnnualLargestLakeBankCrumble({
  lakes,
  lakeMeta,
  lakeIdByCell,
  lakeMask,
  elevation,
  workingElevation,
  effectiveRunoff,
  waterLevelByLake,
  overflowLakeIds,
  width,
  height,
  runoffToDepth,
  crumbleCount = 1,
}) {
  const lakeIds = findLargestSeasonalLakeIds(lakes, lakeMeta, crumbleCount)
  let crumbled = 0

  for (const lakeId of lakeIds) {
    const excludedOutletIdxs = new Set(getBankCrumbleOutletIdxs(lakeMeta[lakeId]))
    const { outletIdx, outletElev } = findLowestBankOutlet(
      lakeId,
      lakeIdByCell,
      lakeMask,
      elevation,
      width,
      height,
      excludedOutletIdxs,
    )

    if (
      applyLakeBankCrumble({
        lakeId,
        outletIdx,
        outletElev,
        meta: lakeMeta[lakeId],
        lake: lakes[lakeId],
        elevation,
        workingElevation,
        effectiveRunoff,
        waterLevelByLake,
        lakeIdByCell,
        overflowLakeIds,
        width,
        runoffToDepth,
      })
    ) {
      crumbled += 1
    }
  }

  return crumbled
}
