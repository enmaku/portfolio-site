import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

test('check-firebase-rtdb exits 1 with missing env listing VITE_FIREBASE keys', () => {
  const result = spawnSync('node', ['./scripts/check-firebase-rtdb.mjs'], {
    cwd: process.cwd(),
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
