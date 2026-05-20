/** Align with dungeon-runner replay publish allocator (ADR 0002). */
const LEGACY_EPOCH_RE = /^v0\.1\.\d+a$/i
const REPLAY_BASE_RE = /^v\d+\.\d+$/i
const REPLAY_PATCH_RE = /^v\d+\.\d+\.\d{2}$/i

export function isPromotedVersionDirName(name) {
  return (
    LEGACY_EPOCH_RE.test(name) ||
    REPLAY_BASE_RE.test(name) ||
    REPLAY_PATCH_RE.test(name)
  )
}

export function validatePromotedVersionId(modelId) {
  if (!modelId || typeof modelId !== 'string') {
    return { ok: false, error: 'Promoted version id is required' }
  }
  if (!isPromotedVersionDirName(modelId)) {
    return {
      ok: false,
      error: `Invalid promoted version id: ${modelId} (expected promoted semver like v0.2 or v0.1.30a, not training run ids such as bc-*)`,
    }
  }
  return { ok: true, modelId }
}
