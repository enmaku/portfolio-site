import assert from 'node:assert/strict'
import test from 'node:test'
import { reactive } from 'vue'
import { wireLiveMatchShellConcerns } from './wireLiveMatchShellConcerns.js'
import {
  createOrchestratorDeps,
  EXPECTED_BOARD_KEYS,
  EXPECTED_DEBUG_KEYS,
  EXPECTED_DIALOG_KEYS,
  EXPECTED_PAGE_KEYS,
  installLiveMatchShellTestWindow,
  LIVE_MATCH_SHELL_SESSION_GROUPS,
  LIVE_MATCH_SHELL_SESSION_GROUPS_FROM_GROUPS,
  restoreLiveMatchShellTestWindow,
} from './liveMatchShellOrchestratorTestFixtures.js'

function createWiredSession(overrides = {}) {
  const wired = wireLiveMatchShellConcerns(createOrchestratorDeps(overrides))
  return reactive(wired.assembleInjectGroups())
}

test('wireLiveMatchShellConcerns exposes session inject groups', () => {
  const session = createWiredSession()

  for (const group of LIVE_MATCH_SHELL_SESSION_GROUPS) {
    assert.ok(group in session, `missing session group ${group}`)
  }
})

test('wireLiveMatchShellConcerns board group preserves inject capability keys', () => {
  const session = createWiredSession()

  for (const key of EXPECTED_BOARD_KEYS) {
    assert.ok(key in session.board, `missing board.${key}`)
  }
})

test('wireLiveMatchShellConcerns dialogs group preserves inject capability keys', () => {
  const session = createWiredSession()

  for (const key of EXPECTED_DIALOG_KEYS) {
    assert.ok(key in session.dialogs, `missing dialogs.${key}`)
  }
})

test('wireLiveMatchShellConcerns debug group preserves inject capability keys', () => {
  const session = createWiredSession()

  for (const key of EXPECTED_DEBUG_KEYS) {
    assert.ok(key in session.debug, `missing debug.${key}`)
  }
})

test('wireLiveMatchShellConcerns page group preserves inject capability keys', () => {
  const session = createWiredSession()

  for (const key of EXPECTED_PAGE_KEYS) {
    assert.ok(key in session.page, `missing page.${key}`)
  }
  assert.equal(typeof session.page.mountLiveMatchShell, 'function')
  assert.equal(typeof session.page.requestConfirmation, 'function')
  assert.equal(typeof session.page.buildNewMatchEnvelope, 'function')
})

test('wireLiveMatchShellConcerns session group constants match liveMatchShellSessionGroups', () => {
  assert.deepEqual(LIVE_MATCH_SHELL_SESSION_GROUPS, LIVE_MATCH_SHELL_SESSION_GROUPS_FROM_GROUPS)
})

test('wireLiveMatchShellConcerns wires shared match ref into board group', () => {
  const deps = createOrchestratorDeps()
  const session = createWiredSession(deps)

  assert.ok('match' in session.board)
  assert.equal(session.board.match, deps.match.value)
})

test('wireLiveMatchShellConcerns exposes matchPageOrchestrationCtx with page orchestration contract', () => {
  const session = createWiredSession()
  const ctx = session.page.matchPageOrchestrationCtx

  assert.ok(ctx)
  for (const key of [
    'storage',
    'recovery',
    'loadModel',
    'setMatchNeuralLoadGateInFlight',
    'clearCurrentMatch',
    'persistCurrentMatch',
    'applySetupSnapshot',
    'setupTarget',
    'cloneSetup',
    'resolveSetupTerminal',
    'applySetupTerminal',
  ]) {
    assert.ok(key in ctx, `missing matchPageOrchestrationCtx.${key}`)
  }
})

test('wireLiveMatchShellConcerns wires cross-concern refs and handlers through inject groups', () => {
  const session = createWiredSession()

  assert.equal(typeof session.page.maybeRunHeadlessMatchCompletion, 'function')
  assert.equal(typeof session.board.takeHumanAction, 'function')
  assert.equal(typeof session.board.openEquipmentModal, 'function')
  assert.equal(typeof session.board.humanGameplayBlocked, 'boolean')
  assert.equal(typeof session.board.headlessCompletionInFlight, 'boolean')
})

test('wireLiveMatchShellConcerns returns concern modules for direct inspection', () => {
  const wired = wireLiveMatchShellConcerns(createOrchestratorDeps())

  assert.equal(typeof wired.assembleInjectGroups, 'function')
  assert.ok(wired.presentation)
  assert.ok(wired.maintainerDebug)
  assert.ok(wired.opponentTurnAutomation)
  assert.ok(wired.humanGameplaySurface)
  assert.ok(wired.midMatchDialogSurface)
  assert.ok(wired.lifecycleCoordination)
  assert.ok(wired.liveMatchPageSessionSink)
})

test.before(() => {
  installLiveMatchShellTestWindow()
})

test.after(() => {
  restoreLiveMatchShellTestWindow()
})
