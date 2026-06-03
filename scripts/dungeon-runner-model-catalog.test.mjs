import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  parseCatalogPublishedAtById,
  readPromotionPublishedAtById,
  writeModelCatalog,
} from './lib/dungeon-runner-model-catalog.mjs'

test('parseCatalogPublishedAtById accepts legacy string ids and object entries', () => {
  const map = parseCatalogPublishedAtById([
    'latest',
    { id: 'v0.2.04', publishedAt: '2026-05-25T19:07:34.055Z' },
    { id: 'v0.2.04', publishedAt: '2026-05-25T19:07:34.999Z' },
  ])
  assert.equal(map.has('latest'), true)
  assert.equal(map.get('v0.2.04'), '2026-05-25T19:07:34.999Z')
})

test('writeModelCatalog preserves publishedAt and adds promotion dates for new ids', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-catalog-'))
  const modelsRoot = path.join(temp, 'public', 'models', 'dungeon-runner')
  const repoRoot = path.join(temp, 'dungeon-runner')
  mkdirSync(path.join(modelsRoot, 'v0.2.04'), { recursive: true })
  writeFileSync(path.join(modelsRoot, 'v0.2.04', 'model.json'), '{"format":"layers-model"}\n')
  writeFileSync(path.join(modelsRoot, 'models.json'), `${JSON.stringify({
    models: [{ id: 'v0.2.04', publishedAt: '2026-05-25T19:07:34.055Z' }],
  }, null, 2)}\n`)
  mkdirSync(path.join(repoRoot, 'models', 'v0.2.05'), { recursive: true })
  writeFileSync(
    path.join(repoRoot, 'models', 'v0.2.05', 'promotion.json'),
    JSON.stringify({ promoted_version: 'v0.2.05', promoted_at: '2026-06-01T00:00:00.000Z' }),
  )
  mkdirSync(path.join(modelsRoot, 'v0.2.05'), { recursive: true })
  writeFileSync(path.join(modelsRoot, 'v0.2.05', 'model.json'), '{"format":"layers-model"}\n')

  writeModelCatalog(modelsRoot, { repoRoot, sortModelIds: (ids) => [...ids].sort() })
  const catalog = JSON.parse(readFileSync(path.join(modelsRoot, 'models.json'), 'utf8'))
  assert.equal(
    catalog.models.find((entry) => entry.id === 'v0.2.04')?.publishedAt,
    '2026-05-25T19:07:34.055Z',
  )
  assert.equal(
    catalog.models.find((entry) => entry.id === 'v0.2.05')?.publishedAt,
    '2026-06-01T00:00:00.000Z',
  )
  rmSync(temp, { recursive: true, force: true })
})

test('readPromotionPublishedAtById reads promotions.jsonl and promotion.json', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'dr-catalog-'))
  const repoRoot = path.join(temp, 'repo')
  mkdirSync(path.join(repoRoot, 'models', 'v0.2.01'), { recursive: true })
  writeFileSync(
    path.join(repoRoot, 'models', 'promotions.jsonl'),
    `${JSON.stringify({ promoted_version: 'v0.2.01', promoted_at: '2026-05-19T23:15:08.830354+00:00' })}\n`,
  )
  writeFileSync(
    path.join(repoRoot, 'models', 'v0.2.01', 'promotion.json'),
    JSON.stringify({ promoted_version: 'v0.2.01', promoted_at: '2026-05-19T23:15:08.999999+00:00' }),
  )

  const dates = readPromotionPublishedAtById(repoRoot)
  assert.equal(dates['v0.2.01'], '2026-05-19T23:15:08.999999+00:00')
  rmSync(temp, { recursive: true, force: true })
})
