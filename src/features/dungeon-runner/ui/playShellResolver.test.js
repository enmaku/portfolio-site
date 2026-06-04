import assert from 'node:assert/strict'
import test from 'node:test'
import { MATCH_PHASES } from '../engine/kernel.js'
import {
  PLAY_SHELL,
  buildPlayShellSnapshot,
  resolveActivePlayShell,
} from './playShellResolver.js'

const ACTIVATION_ROWS = [
  {
    label: 'no current match',
    snapshot: {
      hasCurrentMatch: false,
      matchPhase: null,
      neuralRefreshTerminalSurfaced: false,
      matchNeuralLoadGateInFlight: false,
    },
    expected: PLAY_SHELL.PLAY_SETUP,
  },
  {
    label: 'rematch gate in flight keeps match-over shell',
    snapshot: {
      hasCurrentMatch: true,
      matchPhase: MATCH_PHASES.MATCH_OVER,
      neuralRefreshTerminalSurfaced: false,
      matchNeuralLoadGateInFlight: true,
    },
    expected: PLAY_SHELL.MATCH_OVER,
  },
  {
    label: 'fresh match entry gate in flight routes to live-match',
    snapshot: {
      hasCurrentMatch: true,
      matchPhase: MATCH_PHASES.BIDDING,
      neuralRefreshTerminalSurfaced: false,
      matchNeuralLoadGateInFlight: true,
    },
    expected: PLAY_SHELL.LIVE_MATCH,
  },
  {
    label: 'current match with REFRESH terminal surfaced',
    snapshot: {
      hasCurrentMatch: true,
      matchPhase: MATCH_PHASES.BIDDING,
      neuralRefreshTerminalSurfaced: true,
      matchNeuralLoadGateInFlight: false,
    },
    expected: PLAY_SHELL.LIVE_MATCH,
  },
  {
    label: 'current match in progress',
    snapshot: {
      hasCurrentMatch: true,
      matchPhase: MATCH_PHASES.DUNGEON,
      neuralRefreshTerminalSurfaced: false,
      matchNeuralLoadGateInFlight: false,
    },
    expected: PLAY_SHELL.LIVE_MATCH,
  },
  {
    label: 'current match at match over',
    snapshot: {
      hasCurrentMatch: true,
      matchPhase: MATCH_PHASES.MATCH_OVER,
      neuralRefreshTerminalSurfaced: false,
      matchNeuralLoadGateInFlight: false,
    },
    expected: PLAY_SHELL.MATCH_OVER,
  },
  {
    label: 'REFRESH terminal takes precedence over match over',
    snapshot: {
      hasCurrentMatch: true,
      matchPhase: MATCH_PHASES.MATCH_OVER,
      neuralRefreshTerminalSurfaced: true,
      matchNeuralLoadGateInFlight: false,
    },
    expected: PLAY_SHELL.LIVE_MATCH,
  },
]

test('resolveActivePlayShell activation matrix', () => {
  for (const row of ACTIVATION_ROWS) {
    assert.equal(resolveActivePlayShell(row.snapshot), row.expected, row.label)
  }
})

test('resolveActivePlayShell selects live-match for every in-progress match phase', () => {
  for (const phase of [
    MATCH_PHASES.BIDDING,
    MATCH_PHASES.DUNGEON,
    MATCH_PHASES.PICK_ADVENTURER,
  ]) {
    assert.equal(
      resolveActivePlayShell({
        hasCurrentMatch: true,
        matchPhase: phase,
        neuralRefreshTerminalSurfaced: false,
        matchNeuralLoadGateInFlight: false,
      }),
      PLAY_SHELL.LIVE_MATCH,
      phase,
    )
  }
})

test('buildPlayShellSnapshot maps play-route session inputs', () => {
  assert.deepEqual(
    buildPlayShellSnapshot({
      match: null,
      neuralRefreshTerminalSurfaced: false,
    }),
    {
      hasCurrentMatch: false,
      matchPhase: null,
      neuralRefreshTerminalSurfaced: false,
      matchNeuralLoadGateInFlight: false,
    },
  )

  assert.deepEqual(
    buildPlayShellSnapshot({
      match: { state: { phase: MATCH_PHASES.MATCH_OVER } },
      neuralRefreshTerminalSurfaced: true,
      matchNeuralLoadGateInFlight: true,
    }),
    {
      hasCurrentMatch: true,
      matchPhase: MATCH_PHASES.MATCH_OVER,
      neuralRefreshTerminalSurfaced: true,
      matchNeuralLoadGateInFlight: true,
    },
  )
})

test('resolveActivePlayShell never selects play-setup while rematch gate runs with current match', () => {
  assert.notEqual(
    resolveActivePlayShell({
      hasCurrentMatch: true,
      matchPhase: MATCH_PHASES.MATCH_OVER,
      neuralRefreshTerminalSurfaced: false,
      matchNeuralLoadGateInFlight: true,
    }),
    PLAY_SHELL.PLAY_SETUP,
  )
})
