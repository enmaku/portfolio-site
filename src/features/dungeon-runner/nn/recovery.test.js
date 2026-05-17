import assert from 'node:assert/strict'
import test from 'node:test'
import { createModelFailureRecovery } from './recovery.js'

test('marks model as cooling down after threshold failures', () => {
  const recovery = createModelFailureRecovery({ threshold: 2, cooldownMs: 1000, now: () => 100 })
  recovery.recordFailure('latest')
  assert.equal(recovery.isCoolingDown('latest'), false)
  recovery.recordFailure('latest')
  assert.equal(recovery.isCoolingDown('latest'), true)
})

test('cooldown expires and allows model again', () => {
  let time = 100
  const recovery = createModelFailureRecovery({ threshold: 1, cooldownMs: 1000, now: () => time })
  recovery.recordFailure('latest')
  assert.equal(recovery.isCoolingDown('latest'), true)
  time = 1200
  assert.equal(recovery.isCoolingDown('latest'), false)
})
