#!/usr/bin/env node
import path from 'node:path'
import { writeModelCatalog } from './lib/dungeon-runner-model-catalog.mjs'
import { isPromotedVersionDirName } from './lib/dungeon-runner-model-id.mjs'

const modelsRoot = path.join(process.cwd(), 'public', 'models', 'dungeon-runner')
const repoRoot = process.env.DUNGEON_RUNNER_ROOT?.trim() || null

const models = writeModelCatalog(modelsRoot, {
  repoRoot,
  sortModelIds: (ids) => sortModelIdsForCatalog(ids),
})

console.log(`Wrote catalog for ${models.length} model(s)`)

function sortModelIdsForCatalog(modelIds) {
  const unique = [...new Set(modelIds.filter(Boolean))]
  const semver = unique.filter((id) => id !== 'latest' && isPromotedVersionDirName(id)).sort((a, b) =>
    compareSemverDesc(a, b),
  )
  const hasLatest = unique.includes('latest')
  return [...(hasLatest ? ['latest'] : []), ...semver]
}

function compareSemverDesc(a, b) {
  const aa = parseModelVersionId(a)
  const bb = parseModelVersionId(b)
  if (!aa || !bb) return a.localeCompare(b)
  for (const key of ['major', 'minor', 'patch']) {
    if (aa[key] !== bb[key]) return bb[key] - aa[key]
  }
  if (aa.suffix === bb.suffix) return 0
  if (!aa.suffix) return -1
  if (!bb.suffix) return 1
  return bb.suffix.localeCompare(aa.suffix)
}

function parseModelVersionId(id) {
  let match = /^v0\.1\.(\d+)([a-z0-9.-]*)$/i.exec(id)
  if (match) {
    return { major: 0, minor: 1, patch: Number(match[1]), suffix: (match[2] ?? '').toLowerCase() }
  }
  match = /^v(\d+)\.(\d+)$/i.exec(id)
  if (match) {
    return { major: Number(match[1]), minor: Number(match[2]), patch: 0, suffix: '' }
  }
  match = /^v(\d+)\.(\d+)\.(\d{2})$/i.exec(id)
  if (match) {
    return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), suffix: '' }
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
