export function pickDefaultModelId(modelIds) {
  const sorted = sortModelIdsForDisplay(modelIds)
  return sorted[0] ?? null
}

export function sortModelIdsForDisplay(modelIds) {
  const unique = [...new Set((modelIds ?? []).filter(Boolean))]
  const valid = unique.filter((id) => id === 'latest' || isModelVersionId(id))
  const hasLatest = valid.includes('latest')
  const semver = valid.filter((id) => isModelVersionId(id)).sort((a, b) => compareSemverDesc(a, b))
  return [...(hasLatest ? ['latest'] : []), ...semver]
}

function compareSemverDesc(a, b) {
  const aa = parseModelVersionId(a)
  const bb = parseModelVersionId(b)
  if (!aa || !bb) return 0
  for (const key of ['major', 'minor', 'patch']) {
    if (aa[key] !== bb[key]) return bb[key] - aa[key]
  }
  if (aa.suffix === bb.suffix) return 0
  if (!aa.suffix) return -1
  if (!bb.suffix) return 1
  return bb.suffix.localeCompare(aa.suffix)
}

function isModelVersionId(id) {
  return /^v\d+\.\d+\.\d+[a-z0-9.-]*$/i.test(id)
}

function parseModelVersionId(id) {
  const match = /^v(\d+)\.(\d+)\.(\d+)([a-z0-9.-]*)$/i.exec(id)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    suffix: (match[4] ?? '').toLowerCase(),
  }
}

export function validateSelectedModels(opponents, availableModelIds) {
  const available = new Set(sortModelIdsForDisplay(availableModelIds))
  for (const opponent of opponents ?? []) {
    if (opponent?.type !== 'nn') continue
    if (!opponent.modelId) return { ok: false, errorCode: 'MODEL_REQUIRED' }
    if (available.size > 0 && !available.has(opponent.modelId)) {
      return { ok: false, errorCode: 'MODEL_UNAVAILABLE' }
    }
  }
  return { ok: true }
}
