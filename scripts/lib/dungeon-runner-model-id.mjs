export const PROMOTED_VERSION_RE = /^v\d+\.\d+\.\d+[a-z0-9.-]*$/i

export function isPromotedVersionDirName(name) {
  return PROMOTED_VERSION_RE.test(name)
}

export function validatePromotedVersionId(modelId) {
  if (!modelId || typeof modelId !== 'string') {
    return { ok: false, error: 'Promoted version id is required' }
  }
  if (!isPromotedVersionDirName(modelId)) {
    return {
      ok: false,
      error: `Invalid promoted version id: ${modelId} (expected semver like v0.1.30a, not training run ids such as bc-*)`,
    }
  }
  return { ok: true, modelId }
}
