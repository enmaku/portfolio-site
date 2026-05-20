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

/** Align with dungeon-runner promoted-version ids (scripts/lib/dungeon-runner-model-id.mjs). */
const LEGACY_EPOCH_RE = /^v0\.1\.\d+a$/i
const REPLAY_BASE_RE = /^v\d+\.\d+$/i
const REPLAY_PATCH_RE = /^v\d+\.\d+\.\d{2}$/i
const GENERIC_SEMVER_RE = /^v\d+\.\d+\.\d+[a-z0-9.-]*$/i

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
  if (LEGACY_EPOCH_RE.test(id) || REPLAY_PATCH_RE.test(id) || GENERIC_SEMVER_RE.test(id)) {
    return true
  }
  if (!REPLAY_BASE_RE.test(id)) return false
  // v0.1.NNa legacy ids use three segments; bare v0.1 is not a promoted version.
  return !/^v0\.1$/i.test(id)
}

function parseModelVersionId(id) {
  let match = /^v0\.1\.(\d+)([a-z0-9.-]*)$/i.exec(id)
  if (match) {
    return {
      major: 0,
      minor: 1,
      patch: Number(match[1]),
      suffix: (match[2] ?? '').toLowerCase(),
    }
  }
  match = /^v(\d+)\.(\d+)$/i.exec(id)
  if (match) {
    return {
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: 0,
      suffix: '',
    }
  }
  match = /^v(\d+)\.(\d+)\.(\d{2})$/i.exec(id)
  if (match) {
    return {
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3]),
      suffix: '',
    }
  }
  match = /^v(\d+)\.(\d+)\.(\d+)([a-z0-9.-]*)$/i.exec(id)
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
