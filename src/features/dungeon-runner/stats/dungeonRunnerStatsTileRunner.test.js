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

test('runDungeonRunnerStatsTileLoad maps ok human win rate over time loader result', async () => {
  const state = await runDungeonRunnerStatsTileLoad(async () => ({
    status: 'ok',
    chart: {
      labels: ['1', '2'],
      values: [100, 0],
      rollingAverageValues: [100, 50],
      modelPublishMarkers: [],
    },
    humanWonSeries: [
      { humanWon: true, createdAt: '2026-05-01T00:00:00.000Z' },
      { humanWon: false, createdAt: '2026-05-02T00:00:00.000Z' },
    ],
    windowBounds: { min: 2, max: 2, default: 2 },
    publishedAtByModelId: {},
  }))
  assert.equal(state.status, 'ok')
  if (state.status !== 'ok') return
  assert.equal(state.humanWonSeries?.length, 2)
  assert.deepEqual(state.windowBounds, { min: 2, max: 2, default: 2 })
})

test('runDungeonRunnerStatsTileLoad maps ok match length over time loader result', async () => {
  const state = await runDungeonRunnerStatsTileLoad(async () => ({
    status: 'ok',
    chart: {
      labels: ['1', '2'],
      values: [10, 20],
      rollingAverageValues: [10, 15],
      modelPublishMarkers: [],
    },
    matchLengthSeries: [
      { createdAt: '2026-05-01T00:00:00.000Z', historyStepCount: 10 },
      { createdAt: '2026-05-02T00:00:00.000Z', historyStepCount: 20 },
    ],
    windowBounds: { min: 2, max: 2, default: 2 },
    publishedAtByModelId: { 'v0.1.0': '2026-05-01T00:00:00.000Z' },
  }))
  assert.equal(state.status, 'ok')
  if (state.status !== 'ok') return
  assert.equal(state.matchLengthSeries?.length, 2)
  assert.deepEqual(state.windowBounds, { min: 2, max: 2, default: 2 })
})

test('runDungeonRunnerStatsTileLoad maps ok matches per week loader result', async () => {
  const state = await runDungeonRunnerStatsTileLoad(async () => ({
    status: 'ok',
    chart: {
      labels: ['May 1', 'May 8'],
      values: [3, 5],
      rollingAverageValues: [3, 4],
    },
    weeklyCounts: [3, 5],
    weekBuckets: [
      {
        startInclusive: '2026-05-01T00:00:00.000Z',
        endExclusive: '2026-05-08T00:00:00.000Z',
        label: 'May 1',
      },
      {
        startInclusive: '2026-05-08T00:00:00.000Z',
        endExclusive: '2026-05-15T00:00:00.000Z',
        label: 'May 8',
      },
    ],
    windowBounds: { min: 1, max: 2, default: 2 },
  }))
  assert.equal(state.status, 'ok')
  if (state.status !== 'ok') return
  assert.deepEqual(state.weeklyCounts, [3, 5])
  assert.deepEqual(state.windowBounds, { min: 1, max: 2, default: 2 })
})

test('runDungeonRunnerStatsTileLoad maps ok numeric series chart loader result', async () => {
  const state = await runDungeonRunnerStatsTileLoad(async () => ({
    status: 'ok',
    chart: {
      labels: ['May 1', 'May 8'],
      values: [3, 5],
    },
  }))
  assert.deepEqual(state, {
    status: 'ok',
    chart: {
      labels: ['May 1', 'May 8'],
      values: [3, 5],
    },
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
