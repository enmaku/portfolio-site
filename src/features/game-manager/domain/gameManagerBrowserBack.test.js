import assert from 'node:assert/strict'
import test from 'node:test'
import {
  claimLayerOnStack,
  isGameManagerPath,
  releaseLayerFromStack,
  resolveGameManagerBrowserBackAction,
  shouldBlockGameManagerRouteLeave,
} from './gameManagerBrowserBack.js'

test('isGameManagerPath accepts manager root and nested paths', () => {
  assert.equal(isGameManagerPath('/projects/game-manager'), true)
  assert.equal(isGameManagerPath('/projects/game-manager/'), true)
  assert.equal(isGameManagerPath('/projects/game-timer'), false)
  assert.equal(isGameManagerPath('/'), false)
  assert.equal(isGameManagerPath(''), false)
})

test('resolveGameManagerBrowserBackAction closes topmost layer', () => {
  assert.deepEqual(resolveGameManagerBrowserBackAction({ layerIds: ['a', 'b'] }), {
    type: 'closeLayer',
    layerId: 'b',
  })
})

test('resolveGameManagerBrowserBackAction traps when no layers', () => {
  assert.deepEqual(resolveGameManagerBrowserBackAction({ layerIds: [] }), { type: 'trap' })
})

test('shouldBlockGameManagerRouteLeave blocks timer and portfolio unless armed', () => {
  assert.equal(
    shouldBlockGameManagerRouteLeave({
      toPath: '/projects/game-timer',
      allowLeave: false,
    }),
    true,
  )
  assert.equal(
    shouldBlockGameManagerRouteLeave({
      toPath: '/',
      allowLeave: false,
    }),
    true,
  )
  assert.equal(
    shouldBlockGameManagerRouteLeave({
      toPath: '/projects/game-timer',
      allowLeave: true,
    }),
    false,
  )
  assert.equal(
    shouldBlockGameManagerRouteLeave({
      toPath: '/projects/game-manager',
      allowLeave: false,
    }),
    false,
  )
})

test('claim and release keep stack order for innermost-first close', () => {
  let stack = []
  stack = claimLayerOnStack(stack, { id: 'search', close: () => {} })
  stack = claimLayerOnStack(stack, { id: 'dialog', close: () => {} })
  assert.deepEqual(
    stack.map((entry) => entry.id),
    ['search', 'dialog'],
  )
  stack = claimLayerOnStack(stack, { id: 'search', close: () => {} })
  assert.equal(stack.length, 2)
  stack = releaseLayerFromStack(stack, 'dialog')
  assert.deepEqual(
    stack.map((entry) => entry.id),
    ['search'],
  )
})
