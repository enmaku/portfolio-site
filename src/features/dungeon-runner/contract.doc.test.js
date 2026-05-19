import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const contract = () => readFileSync(new URL('./CONTRACT.md', import.meta.url), 'utf8')
const rtdb = () => readFileSync(new URL('./firebase/rtdb.js', import.meta.url), 'utf8')
const upload = () =>
  readFileSync(new URL('./firebase/completedMatchReplayUpload.js', import.meta.url), 'utf8')

test('CONTRACT Further Notes links sibling replay pipeline doc and dungeon-runner issues', () => {
  const md = contract()
  assert.equal(md.includes('## Further Notes'), true)
  assert.equal(md.includes('../dungeon-runner/docs/replay-pipeline.md'), true)
  assert.equal(md.includes('github.com/enmaku/dungeon-runner/issues/9'), true)
  assert.equal(md.includes('github.com/enmaku/dungeon-runner/issues/10'), true)
})

test('CONTRACT replay envelope section cross-links training pipeline doc', () => {
  const md = contract()
  const start = md.indexOf('## Replay envelope contract (v1)')
  assert.ok(start >= 0)
  const section = md.slice(start, md.indexOf('## Debug Contract (v1)'))
  assert.equal(section.includes('../dungeon-runner/docs/replay-pipeline.md'), true)
  assert.equal(section.includes('github.com/enmaku/dungeon-runner/issues/10'), true)
})

test('CONTRACT Persistence references replay envelope without duplicating field tables', () => {
  const md = contract()
  const start = md.indexOf('## Persistence Contract (v1)')
  assert.ok(start >= 0)
  const section = md.slice(start, md.indexOf('## Replay envelope contract (v1)'))
  assert.equal(section.includes('#replay-envelope-contract-v1'), true)
  assert.equal(section.includes('dungeonRunnerCompletedMatches'), true)
  assert.equal(section.includes('| Field |'), false)
})

test('rtdb completed-match helpers document replay envelope contract v1', () => {
  const src = rtdb()
  assert.equal(src.includes('Replay envelope contract (v1)'), true)
  assert.equal(src.includes('dungeonRunnerCompletedMatches'), true)
})

test('completed match replay upload documents CONTRACT v1 export path', () => {
  const src = upload()
  assert.equal(src.includes('exportReplayEnvelope'), true)
  assert.equal(src.includes('Replay envelope contract (v1)'), true)
})
