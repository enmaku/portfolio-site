import { SEA_LEVEL } from '../../biomeIds.js'

/** @typedef {'chokepoint' | 'haul_junction' | 'surplus_basin' | 'refinery' | 'drain_city'} LogisticsNodeType */

/** Minimum total tag weight for a cell to count as a scored logistics node. */
export const LOGISTICS_NODE_SCORE_THRESHOLD = 0.35

/** Local neighborhood radius for basin / junction scoring. */
export const LOGISTICS_SCORE_RADIUS = 2

/**
 * @typedef {Object} LogisticsNodeSurveyEntry
 * @property {number} x
 * @property {number} y
 * @property {LogisticsNodeType} primaryType
 * @property {Partial<Record<LogisticsNodeType, number>>} tags
 * @property {boolean} exhausted
 * @property {boolean} [founded]
 */

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @returns {LogisticsNodeSurveyEntry[]}
 */
export function scoreLogisticsNodes(doc) {
  const { gridWidth, gridHeight } = doc
  if (!gridWidth || !gridHeight) {
    return []
  }

  /** @type {LogisticsNodeSurveyEntry[]} */
  const entries = []
  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const index = y * gridWidth + x
      if (isBlockedTerrain(doc, index)) continue

      const tags = scoreCellTags(doc, x, y)
      const totalWeight = Object.values(tags).reduce((sum, w) => sum + w, 0)
      if (totalWeight < LOGISTICS_NODE_SCORE_THRESHOLD) continue

      const primaryType = pickPrimaryType(tags)
      entries.push({
        x,
        y,
        primaryType,
        tags,
        exhausted: false,
        founded: false,
      })
    }
  }
  return entries
}

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} index
 * @returns {boolean}
 */
function isBlockedTerrain(doc, index) {
  const elevation = doc.fields?.elevation
  if (!elevation || index < 0 || index >= elevation.length) {
    return false
  }
  return elevation[index] < SEA_LEVEL
}

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} x
 * @param {number} y
 * @returns {Partial<Record<LogisticsNodeType, number>>}
 */
function scoreCellTags(doc, x, y) {
  /** @type {Partial<Record<LogisticsNodeType, number>>} */
  const tags = {}
  const { gridWidth, gridHeight } = doc
  const index = y * gridWidth + x

  const arableSum = sumNeighborhood(doc.arableRaster, x, y, gridWidth, gridHeight)
  if (arableSum >= 4) {
    tags.surplus_basin = Math.min(1, arableSum / 12)
  }

  const riverNeighbors = countRiverNeighbors(doc, x, y, gridWidth, gridHeight)
  if (riverNeighbors >= 2) {
    tags.haul_junction = Math.min(1, riverNeighbors / 4)
  } else if (doc.riverCorridorMask?.[index]) {
    tags.haul_junction = 0.4
  }

  if (hasNearbyStrategicResource(doc, x, y)) {
    tags.refinery = 0.6
  }

  if (isCoastalDrainCity(doc, x, y, index)) {
    tags.drain_city = 0.75
  }

  if (isChokepoint(doc, x, y, gridWidth, gridHeight)) {
    tags.chokepoint = 0.55
  }

  return tags
}

/**
 * @param {Partial<Record<LogisticsNodeType, number>>} tags
 * @returns {LogisticsNodeType}
 */
export function pickPrimaryType(tags) {
  /** @type {[LogisticsNodeType, number][]} */
  const ranked = Object.entries(tags)
    .filter((entry) => entry[1] > 0)
    .map(([type, weight]) => [/** @type {LogisticsNodeType} */ (type), weight])
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
  return ranked[0]?.[0] ?? 'surplus_basin'
}

/**
 * @param {Float32Array | null | undefined} raster
 * @param {number} x
 * @param {number} y
 * @param {number} gridWidth
 * @param {number} gridHeight
 */
function sumNeighborhood(raster, x, y, gridWidth, gridHeight) {
  if (!raster) return 0
  let sum = 0
  for (let dy = -LOGISTICS_SCORE_RADIUS; dy <= LOGISTICS_SCORE_RADIUS; dy += 1) {
    for (let dx = -LOGISTICS_SCORE_RADIUS; dx <= LOGISTICS_SCORE_RADIUS; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      const value = raster[ny * gridWidth + nx]
      if (Number.isFinite(value) && value > 0) sum += value
    }
  }
  return sum
}

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} x
 * @param {number} y
 * @param {number} gridWidth
 * @param {number} gridHeight
 */
function countRiverNeighbors(doc, x, y, gridWidth, gridHeight) {
  let count = 0
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      if (doc.riverCorridorMask?.[ny * gridWidth + nx]) count += 1
    }
  }
  return count
}

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} x
 * @param {number} y
 */
function hasNearbyStrategicResource(doc, x, y) {
  const nodes = [...(doc.saltNodes ?? []), ...(doc.metalNodes ?? [])]
  for (const node of nodes) {
    const dx = node.x - x
    const dy = node.y - y
    if (Math.hypot(dx, dy) <= LOGISTICS_SCORE_RADIUS + 1) {
      return true
    }
  }
  return false
}

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} x
 * @param {number} y
 * @param {number} index
 */
function isCoastalDrainCity(doc, x, y, index) {
  const { gridWidth, gridHeight } = doc
  const elevation = doc.fields?.elevation
  if (!elevation) return false

  let adjacentOcean = false
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      if (elevation[ny * gridWidth + nx] < SEA_LEVEL) {
        adjacentOcean = true
      }
    }
  }
  const riverOrMouth =
    Boolean(doc.riverCorridorMask?.[index]) ||
    doc.coastalNodes?.some((node) => node.x === x && node.y === y && node.kind === 'mouth')
  return adjacentOcean && riverOrMouth
}

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {number} x
 * @param {number} y
 * @param {number} gridWidth
 * @param {number} gridHeight
 */
function isChokepoint(doc, x, y, gridWidth, gridHeight) {
  const movementCost = doc.movementCost
  if (!movementCost) return false
  const center = movementCost[y * gridWidth + x]
  if (!Number.isFinite(center)) return false

  let highCostNeighbors = 0
  let passableNeighbors = 0
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue
      const cost = movementCost[ny * gridWidth + nx]
      if (!Number.isFinite(cost) || cost <= 0) continue
      passableNeighbors += 1
      if (cost > center * 1.4) highCostNeighbors += 1
    }
  }
  return passableNeighbors >= 3 && highCostNeighbors >= 2
}

/**
 * @param {LogisticsNodeSurveyEntry[]} survey
 * @param {number} x
 * @param {number} y
 * @returns {LogisticsNodeSurveyEntry | undefined}
 */
export function findLogisticsNodeAt(survey, x, y) {
  return survey.find((entry) => entry.x === x && entry.y === y)
}

/**
 * @param {unknown} value
 * @returns {LogisticsNodeSurveyEntry[]}
 */
export function resolveLogisticsNodeSurvey(value) {
  if (!Array.isArray(value)) return []
  /** @type {LogisticsNodeSurveyEntry[]} */
  const resolved = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = /** @type {LogisticsNodeSurveyEntry} */ (entry)
    if (!Number.isFinite(record.x) || !Number.isFinite(record.y)) continue
    resolved.push({
      x: record.x,
      y: record.y,
      primaryType: record.primaryType ?? 'surplus_basin',
      tags: record.tags && typeof record.tags === 'object' ? { ...record.tags } : {},
      exhausted: Boolean(record.exhausted),
      founded: Boolean(record.founded),
    })
  }
  return resolved
}

/**
 * @param {LogisticsNodeSurveyEntry[]} survey
 * @returns {boolean}
 */
export function hasFullLogisticsNodeSurvey(survey) {
  if (!Array.isArray(survey) || survey.length === 0) {
    return false
  }
  return survey.some(
    (entry) =>
      entry?.tags &&
      typeof entry.tags === 'object' &&
      Object.keys(entry.tags).length > 0,
  )
}

/**
 * Persist only survey state deltas; full scored survey is rebuilt from geography on hydrate.
 *
 * @param {LogisticsNodeSurveyEntry[] | null | undefined} survey
 * @returns {Array<{ x: number, y: number, primaryType: LogisticsNodeType, exhausted: boolean, founded?: boolean }>}
 */
export function logisticsNodeSurveyPatchesForStorage(survey) {
  if (!Array.isArray(survey) || survey.length === 0) {
    return []
  }
  if (!hasFullLogisticsNodeSurvey(survey)) {
    return survey.map((entry) => ({
      x: entry.x,
      y: entry.y,
      primaryType: entry.primaryType,
      exhausted: Boolean(entry.exhausted),
      ...(entry.founded ? { founded: true } : {}),
    }))
  }
  return survey
    .filter((entry) => entry.exhausted || entry.founded)
    .map((entry) => ({
      x: entry.x,
      y: entry.y,
      primaryType: entry.primaryType,
      exhausted: Boolean(entry.exhausted),
      ...(entry.founded ? { founded: true } : {}),
    }))
}

/**
 * @param {import('../../types.js').WorldDocument} doc
 * @param {LogisticsNodeSurveyEntry[] | null | undefined} storedSurvey
 * @returns {LogisticsNodeSurveyEntry[]}
 */
export function mergeLogisticsNodeSurveyFromStorage(doc, storedSurvey) {
  if (hasFullLogisticsNodeSurvey(storedSurvey)) {
    return resolveLogisticsNodeSurvey(storedSurvey)
  }
  const scored = scoreLogisticsNodes(doc)
  const patches = storedSurvey ?? []
  if (patches.length === 0) {
    return scored
  }
  const patchMap = new Map(patches.map((entry) => [`${entry.x},${entry.y}`, entry]))
  return scored.map((entry) => {
    const patch = patchMap.get(`${entry.x},${entry.y}`)
    if (!patch) {
      return entry
    }
    return {
      ...entry,
      exhausted: patch.exhausted,
      founded: patch.founded ?? entry.founded,
    }
  })
}

/**
 * @param {LogisticsNodeSurveyEntry[]} survey
 * @returns {boolean}
 */
export function isFrontierExhausted(survey) {
  if (survey.length === 0) return false
  return survey.every((entry) => entry.exhausted || entry.founded)
}

/**
 * @param {LogisticsNodeSurveyEntry[]} survey
 * @param {number} x
 * @param {number} y
 * @param {Partial<LogisticsNodeSurveyEntry>} patch
 * @returns {LogisticsNodeSurveyEntry[]}
 */
export function patchLogisticsNodeSurvey(survey, x, y, patch) {
  return survey.map((entry) =>
    entry.x === x && entry.y === y ? { ...entry, ...patch } : entry,
  )
}
