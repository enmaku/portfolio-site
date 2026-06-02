import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDungeonRunnerStatsTileLoadingState,
  runDungeonRunnerStatsTileLoad,
} from './dungeonRunnerStatsTileRunner.js'

test('createDungeonRunnerStatsTileLoadingState starts in loading', () => {
  assert.deepEqual(createDungeonRunnerStatsTileLoadingState(), { status: 'loading' })
})

test('runDungeonRunnerStatsTileLoad maps ok loader result to ok state', async () => {
  const state = await runDungeonRunnerStatsTileLoad(async () => ({ status: 'ok', value: 3 }))
  assert.deepEqual(state, { status: 'ok', value: 3 })
})

test('runDungeonRunnerStatsTileLoad accepts string rate values', async () => {
  const state = await runDungeonRunnerStatsTileLoad(async () => ({ status: 'ok', value: '67%' }))
  assert.deepEqual(state, { status: 'ok', value: '67%' })
})

test('runDungeonRunnerStatsTileLoad maps empty string value to error state', async () => {
  const state = await runDungeonRunnerStatsTileLoad(async () => ({ status: 'ok', value: '' }))
  assert.deepEqual(state, { status: 'error' })
})

test('runDungeonRunnerStatsTileLoad maps ok breakdown loader result to ok state', async () => {
  const state = await runDungeonRunnerStatsTileLoad(async () => ({
    status: 'ok',
    breakdown: [
      { key: 'victory', count: 2 },
      { key: 'defeat-not-eliminated', count: 1 },
    ],
  }))
  assert.deepEqual(state, {
    status: 'ok',
    breakdown: [
      { key: 'victory', count: 2 },
      { key: 'defeat-not-eliminated', count: 1 },
    ],
  })
})

test('runDungeonRunnerStatsTileLoad maps invalid breakdown rows to error state', async () => {
  const state = await runDungeonRunnerStatsTileLoad(async () => ({
    status: 'ok',
    breakdown: [{ key: 'victory', count: -1 }],
  }))
  assert.deepEqual(state, { status: 'error' })
})

test('runDungeonRunnerStatsTileLoad maps loader error to error state', async () => {
  const state = await runDungeonRunnerStatsTileLoad(async () => ({ status: 'error' }))
  assert.deepEqual(state, { status: 'error' })
})

test('runDungeonRunnerStatsTileLoad maps thrown loader to error state', async () => {
  const state = await runDungeonRunnerStatsTileLoad(async () => {
    throw new Error('boom')
  })
  assert.deepEqual(state, { status: 'error' })
})
