import assert from 'node:assert/strict'
import test from 'node:test'
import { LIVE_MATCH_SHELL_TEST_IDS } from './liveMatchShellTestIds.js'

test('LIVE_MATCH_SHELL_TEST_IDS exposes stable live-match selectors', () => {
  assert.equal(LIVE_MATCH_SHELL_TEST_IDS.root, 'live-match-shell')
  assert.equal(LIVE_MATCH_SHELL_TEST_IDS.finishingMatchOverlay, 'finishing-match-overlay')
  assert.equal(LIVE_MATCH_SHELL_TEST_IDS.neuralRefreshTerminal, 'neural-refresh-terminal')
  assert.equal(LIVE_MATCH_SHELL_TEST_IDS.neuralRefreshTerminalReload, 'neural-refresh-terminal-reload')
})
