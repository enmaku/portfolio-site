import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const REPO_ROOT = process.cwd()
const CHECK_SCRIPT = join(REPO_ROOT, 'scripts/check-firebase-rtdb.mjs')

test('check-firebase-rtdb exits 1 with missing env listing VITE_FIREBASE keys', () => {
  const isolatedCwd = mkdtempSync(join(tmpdir(), 'check-firebase-rtdb-'))
  const result = spawnSync('node', [CHECK_SCRIPT], {
    cwd: isolatedCwd,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
    },
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /VITE_FIREBASE_API_KEY/)
  assert.match(result.stderr, /\.env\.example/)
})
