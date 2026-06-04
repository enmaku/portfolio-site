import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_OVER_SHELL_TEST_IDS } from './matchOverShellTestIds.js'

test('MATCH_OVER_SHELL_TEST_IDS exposes stable match-over selectors', () => {
  assert.equal(MATCH_OVER_SHELL_TEST_IDS.root, 'match-over-shell')
  assert.equal(MATCH_OVER_SHELL_TEST_IDS.rematch, 'match-over-rematch')
  assert.equal(MATCH_OVER_SHELL_TEST_IDS.backToSetup, 'match-over-back-to-setup')
  assert.equal(MATCH_OVER_SHELL_TEST_IDS.exportReplay, 'match-over-export-replay')
})

test('match-over shell debug surface is export-only', () => {
  assert.equal('importReplay' in MATCH_OVER_SHELL_TEST_IDS, false)
})
