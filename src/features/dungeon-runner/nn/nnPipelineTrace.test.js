import assert from 'node:assert/strict'
import test from 'node:test'
import { createPipelineStepLogger } from './nnPipelineTrace.js'

test('disabled pipeline logger is a no-op', () => {
  const log = createPipelineStepLogger('NN', false)
  assert.doesNotThrow(() => log('step', { x: 1 }))
})
