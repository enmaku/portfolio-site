import { deriveFieldSeed, createSeededRandom } from '../noise/seededRandom.js'
import { SEA_LEVEL } from '../biomeIds.js'

/**
 * Place discrete salt node candidates from geographic signals.
 * @param {Object} params
 * @param {Float32Array} params.elevation
 * @param {Float32Array} params.salidity
 * @param {Float32Array} params.coastNavigability
 * @param {import('../types.js').LakeRecord[]} params.lakes
 * @param {number} params.width
 * @param {number} params.height
 * @param {number} params.geographySeed
 * @param {number} [params.maxNodes]
 * @param {number} [params.seaLevel]
 * @returns {import('../types.js').SaltNode[]}
 */
export function placeSaltNodes({
  elevation,
  salidity,
  coastNavigability,
  lakes,
  width,
  height,
  geographySeed,
  maxNodes = 12,
  seaLevel = SEA_LEVEL,
}) {
  const random = createSeededRandom(deriveFieldSeed(geographySeed, 'salt-nodes'))
  const endorheicLakeIds = new Set(lakes.filter((lake) => lake.endorheic).map((lake) => lake.id))
  const candidates = []

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x
      if (elevation[idx] < seaLevel) continue

      let score = salidity[idx] * 0.5 + coastNavigability[idx] * 0.2
      if (elevation[idx] < seaLevel + 0.06) score += 0.15
      if (endorheicLakeIds.size > 0 && isNearEndorheicLake(x, y, lakes, width)) score += 0.2
      if (elevation[idx] >= 0.5 && elevation[idx] <= 0.62 && salidity[idx] > 0.15) {
        score += 0.1
      }

      if (score >= 0.35) {
        candidates.push({ x, y, score: score + random() * 0.01 })
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  const selected = []
  for (const candidate of candidates) {
    const tooClose = selected.some(
      (node) => Math.hypot(node.x - candidate.x, node.y - candidate.y) < 16,
    )
    if (tooClose) continue
    selected.push({
      id: `salt-${selected.length}`,
      x: candidate.x,
      y: candidate.y,
      score: candidate.score,
    })
    if (selected.length >= maxNodes) break
  }

  return selected
}

/**
 * @param {number} x
 * @param {number} y
 * @param {import('../types.js').LakeRecord[]} lakes
 * @param {number} width
 */
function isNearEndorheicLake(x, y, lakes, width) {
  for (const lake of lakes) {
    if (!lake.endorheic || lake.spillX === undefined || lake.spillY === undefined) continue
    if (Math.hypot(x - lake.spillX, y - lake.spillY) < width * 0.05) return true
  }
  return false
}
