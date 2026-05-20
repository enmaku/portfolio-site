import { existsSync } from 'node:fs'
import path from 'node:path'

export function resolveH5InputPath({ sourceModelsDir, modelId, repoModelFile = 'policy.weights.h5' }) {
  const flatModelPath = path.join(sourceModelsDir, `${modelId}.h5`)
  const nestedModelPath = path.join(sourceModelsDir, modelId, repoModelFile)
  if (existsSync(nestedModelPath)) {
    return { inputPath: nestedModelPath, layout: 'nested', exists: true }
  }
  if (existsSync(flatModelPath)) {
    return { inputPath: flatModelPath, layout: 'flat', exists: true }
  }
  return { inputPath: nestedModelPath, layout: 'missing', exists: false }
}

export function assertH5WeightsPresent({ sourceModelsDir, modelId, repoModelFile }) {
  const resolved = resolveH5InputPath({ sourceModelsDir, modelId, repoModelFile })
  if (resolved.exists) return { ok: true, ...resolved }
  return {
    ok: false,
    error: `Model file not found: ${resolved.inputPath}`,
    ...resolved,
  }
}
