import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PLAY_SETUP_SHELL_TEST_IDS,
  applyNnDefaultModelIds,
  evaluatePlaySetupStart,
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

test('evaluatePlaySetupStart ok is false when setup has no opponents', () => {
  assert.equal(
    evaluatePlaySetupStart({
      setup: { totalSeats: 2, opponents: [] },
      modelOptions: ['latest'],
    }).ok,
    false,
  )
})

test('evaluatePlaySetupStart ok is false when nn opponent lacks a selected model', () => {
  const setup = { totalSeats: 2, opponents: [{ type: 'nn' }] }
  assert.equal(
    evaluatePlaySetupStart({
      setup,
      modelOptions: ['latest'],
    }).ok,
    false,
  )
})

test('evaluatePlaySetupStart ok is true for valid nn setup with catalog model', () => {
  const setup = { totalSeats: 2, opponents: [{ type: 'nn', modelId: 'latest' }] }
  assert.equal(
    evaluatePlaySetupStart({
      setup,
      modelOptions: ['latest'],
    }).ok,
    true,
  )
})

test('evaluatePlaySetupStart ok is true for randombot-only setup without models', () => {
  const setup = { totalSeats: 2, opponents: [{ type: 'randombot' }] }
  assert.equal(
    evaluatePlaySetupStart({
      setup,
      modelOptions: [],
    }).ok,
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
