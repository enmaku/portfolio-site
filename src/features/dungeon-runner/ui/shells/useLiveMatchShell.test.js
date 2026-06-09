import assert from 'node:assert/strict'
import test from 'node:test'
import { useLiveMatchShell } from './useLiveMatchShell.js'
import {
  createOrchestratorDeps,
  installLiveMatchShellTestWindow,
  LIVE_MATCH_SHELL_SESSION_GROUPS,
  restoreLiveMatchShellTestWindow,
} from './liveMatchShellOrchestratorTestFixtures.js'

test('useLiveMatchShell returns reactive session inject groups from wireLiveMatchShellConcerns', () => {
  installLiveMatchShellTestWindow()
  try {
    const session = useLiveMatchShell(createOrchestratorDeps())

    for (const group of LIVE_MATCH_SHELL_SESSION_GROUPS) {
      assert.ok(group in session, `missing session group ${group}`)
    }
    assert.equal(typeof session.page.mountLiveMatchShell, 'function')
  } finally {
    restoreLiveMatchShellTestWindow()
  }
})
