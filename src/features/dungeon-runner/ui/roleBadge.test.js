import assert from 'node:assert/strict'
import test from 'node:test'
import { getRoleBadge } from './roleBadge.js'

test('getRoleBadge returns color and symbol label for human', () => {
  assert.deepEqual(getRoleBadge({ role: { type: 'human' } }), { label: 'Human ●', color: 'primary' })
})

test('getRoleBadge returns color and symbol label for nn', () => {
  assert.deepEqual(getRoleBadge({ role: { type: 'nn' } }), { label: 'NN ◆', color: 'deep-purple' })
})

test('getRoleBadge returns color and symbol label for randombot', () => {
  assert.deepEqual(getRoleBadge({ role: { type: 'randombot' } }), { label: 'Bot ■', color: 'teal' })
})
