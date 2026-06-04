import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectPreservedBotLabelsFromMatchState,
  enterMatchFromSetupSnapshot,
} from './enterMatchFromSetupSnapshot.js'

const SETUP = {
  totalSeats: 2,
  opponents: [{ type: 'randombot' }],
}

function createDeps(overrides = {}) {
  const calls = {
    gate: [],
    resetSetupTerminal: 0,
    resetFreshEntry: 0,
    buildEnvelope: [],
    kickAutomation: 0,
    inFlight: [],
    clearPersisted: 0,
  }

  const deps = {
    setupSnapshot: SETUP,
    presentationSpeedProfile: 'cinematic',
    runMatchEntryGate: async (setupSnapshot) => {
      calls.gate.push(setupSnapshot)
      return { kind: 'success' }
    },
    resetForSetupTerminal: () => {
      calls.resetSetupTerminal += 1
    },
    resetForFreshMatchEntry: () => {
      calls.resetFreshEntry += 1
    },
    buildNewMatchEnvelope: (options) => {
      calls.buildEnvelope.push(options)
      return { id: options.id, envelope: true, options }
    },
    kickMatchAutomation: () => {
      calls.kickAutomation += 1
    },
    setMatchNeuralLoadGateInFlight: (inFlight) => {
      calls.inFlight.push(inFlight)
    },
    createMatchId: () => 'match-test-id',
    createSeed: () => 12345,
    ...overrides,
  }

  return { deps, calls }
}

test('enterMatchFromSetupSnapshot returns setup-terminal without building match', async () => {
  const { deps, calls } = createDeps({
    runMatchEntryGate: async () => ({ kind: 'setup-terminal' }),
  })

  const result = await enterMatchFromSetupSnapshot(deps)

  assert.deepEqual(result, { kind: 'setup-terminal' })
  assert.equal(calls.resetSetupTerminal, 1)
  assert.equal(calls.resetFreshEntry, 0)
  assert.equal(calls.buildEnvelope.length, 0)
  assert.equal(calls.kickAutomation, 1)
  assert.deepEqual(calls.inFlight, [true, false])
})

test('enterMatchFromSetupSnapshot builds envelope on successful gate', async () => {
  const { deps, calls } = createDeps()

  const result = await enterMatchFromSetupSnapshot(deps)

  assert.equal(result.kind, 'entered')
  assert.equal(result.match.id, 'match-test-id')
  assert.equal(calls.resetFreshEntry, 1)
  assert.equal(calls.resetSetupTerminal, 0)
  assert.deepEqual(calls.buildEnvelope, [
    {
      setupSnapshot: SETUP,
      seed: 12345,
      id: 'match-test-id',
      presentationSpeedProfile: 'cinematic',
    },
  ])
  assert.equal(calls.kickAutomation, 1)
  assert.deepEqual(calls.inFlight, [true, false])
})

test('enterMatchFromSetupSnapshot forwards preservedBotLabels for rematch', async () => {
  const preservedBotLabels = ['Bot A', 'Bot B']
  const { deps, calls } = createDeps({ preservedBotLabels })

  const result = await enterMatchFromSetupSnapshot(deps)

  assert.equal(result.kind, 'entered')
  assert.deepEqual(calls.buildEnvelope[0].preservedBotLabels, preservedBotLabels)
})

test('enterMatchFromSetupSnapshot skips clearCurrentMatch on setup-terminal', async () => {
  const { deps, calls } = createDeps({
    clearPersistedMatch: true,
    runMatchEntryGate: async () => ({ kind: 'setup-terminal' }),
    clearCurrentMatch: () => {
      calls.clearPersisted += 1
    },
  })

  await enterMatchFromSetupSnapshot(deps)

  assert.equal(calls.clearPersisted, 0)
})

test('enterMatchFromSetupSnapshot clears persisted match when requested', async () => {
  const storage = { kind: 'memory-storage' }
  const { deps, calls } = createDeps({
    clearPersistedMatch: true,
    storage,
    clearCurrentMatch: (nextStorage) => {
      calls.clearPersisted += 1
      assert.equal(nextStorage, storage)
    },
  })

  await enterMatchFromSetupSnapshot(deps)

  assert.equal(calls.clearPersisted, 1)
})

test('enterMatchFromSetupSnapshot skips clearCurrentMatch when not requested', async () => {
  const { deps, calls } = createDeps({
    clearCurrentMatch: () => {
      calls.clearPersisted += 1
    },
  })

  await enterMatchFromSetupSnapshot(deps)

  assert.equal(calls.clearPersisted, 0)
})

test('enterMatchFromSetupSnapshot kicks automation after gate failure', async () => {
  const { deps, calls } = createDeps({
    runMatchEntryGate: async () => {
      throw new Error('gate failed')
    },
  })

  await assert.rejects(() => enterMatchFromSetupSnapshot(deps), /gate failed/)
  assert.equal(calls.kickAutomation, 1)
  assert.deepEqual(calls.inFlight, [true, false])
})

test('collectPreservedBotLabelsFromMatchState keeps non-human seat labels', () => {
  const labels = collectPreservedBotLabelsFromMatchState([
    { id: 'human', role: { type: 'human' }, label: 'You' },
    { id: 'bot-1', role: { type: 'randombot' }, label: 'Rook' },
    { id: 'bot-2', role: { type: 'nn' }, label: 'Oracle' },
    { id: 'bot-3', role: { type: 'randombot' } },
  ])

  assert.deepEqual(labels, ['Rook', 'Oracle'])
})
