import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PLAY_SETUP_SHELL_TEST_IDS,
  applyNnDefaultModelIds,
  evaluatePlaySetupStart,
  isPlaySetupStartEnabled,
} from './playSetupShell.js'

test('PLAY_SETUP_SHELL_TEST_IDS exposes stable setup-surface selectors', () => {
  assert.equal(PLAY_SETUP_SHELL_TEST_IDS.root, 'play-setup-shell')
  assert.equal(PLAY_SETUP_SHELL_TEST_IDS.neuralLoadGateTerminal, 'neural-load-gate-terminal')
  assert.equal(
    PLAY_SETUP_SHELL_TEST_IDS.neuralLoadGateTerminalDismiss,
    'neural-load-gate-terminal-dismiss',
  )
  assert.equal(PLAY_SETUP_SHELL_TEST_IDS.startMatch, 'play-setup-start-match')
})

test('isPlaySetupStartEnabled is false when setup has no opponents', () => {
  assert.equal(
    isPlaySetupStartEnabled({
      setup: { totalSeats: 2, opponents: [] },
      modelOptions: ['latest'],
    }),
    false,
  )
})

test('isPlaySetupStartEnabled is false when nn opponent lacks a selected model', () => {
  const setup = { totalSeats: 2, opponents: [{ type: 'nn' }] }
  assert.equal(
    isPlaySetupStartEnabled({
      setup,
      modelOptions: ['latest'],
    }),
    false,
  )
})

test('isPlaySetupStartEnabled is true for valid nn setup with catalog model', () => {
  const setup = { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }
  assert.equal(
    isPlaySetupStartEnabled({
      setup,
      modelOptions: ['latest'],
    }),
    true,
  )
})

test('isPlaySetupStartEnabled is true for randombot-only setup without models', () => {
  const setup = { totalSeats: 2, opponents: [{ type: 'randombot' }] }
  assert.equal(
    isPlaySetupStartEnabled({
      setup,
      modelOptions: [],
    }),
    true,
  )
})

test('evaluatePlaySetupStart reports INVALID_SETUP when opponents list is empty', () => {
  assert.deepEqual(
    evaluatePlaySetupStart({
      setup: { totalSeats: 2, opponents: [] },
      modelOptions: [],
    }),
    { ok: false, errorCode: 'INVALID_SETUP' },
  )
})

test('isPlaySetupStartEnabled mirrors evaluatePlaySetupStart ok flag', () => {
  const inputs = {
    setup: { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] },
    modelOptions: ['latest'],
  }
  assert.equal(isPlaySetupStartEnabled(inputs), evaluatePlaySetupStart(inputs).ok)
})

test('evaluatePlaySetupStart reports unavailable nn model when catalog is non-empty', () => {
  const setup = { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'missing' }] }
  assert.deepEqual(
    evaluatePlaySetupStart({
      setup,
      modelOptions: ['latest'],
    }),
    { ok: false, errorCode: 'MODEL_UNAVAILABLE' },
  )
})

test('applyNnDefaultModelIds fills nn opponents without modelId', () => {
  const setup = {
    totalSeats: 3,
    opponents: [{ type: 'nn' }, { type: 'randombot' }],
  }
  applyNnDefaultModelIds(setup, ['v1.0.0', 'latest'])
  assert.equal(setup.opponents[0].modelId, 'latest')
  assert.equal(setup.opponents[1].modelId, undefined)
})

test('applyNnDefaultModelIds leaves existing nn modelId unchanged', () => {
  const setup = {
    totalSeats: 2,
    opponents: [{ type: 'nn', modelId: 'v1.0.0' }],
  }
  applyNnDefaultModelIds(setup, ['latest'])
  assert.equal(setup.opponents[0].modelId, 'v1.0.0')
})
