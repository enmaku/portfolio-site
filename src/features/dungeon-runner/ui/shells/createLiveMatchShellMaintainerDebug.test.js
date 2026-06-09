import assert from 'node:assert/strict'
import test from 'node:test'
import { ref } from 'vue'
import { applyAction, getLegalActions } from '../../engine/kernel.js'
import { buildStateFromReplayEnvelope } from '../../debug/replaySession.js'
import { bootstrapMatchStateForReplay } from '../../debug/replayBootstrap.js'
import { exportReplayEnvelope } from '../../debug/replay.js'
import { CURRENT_MATCH_SCHEMA_VERSION } from '../../persistence/currentMatch.js'
import { createLiveMatchShellMaintainerDebug } from './createLiveMatchShellMaintainerDebug.js'

function createTestDeps(overrides = {}) {
  const debugMode = ref(false)
  const match = ref(null)
  const replayImportText = ref('')
  const replayExportText = ref('')
  const nnDebugTraceText = ref('')
  const nnDebugTraceHistory = ref([])
  const deferredPostDungeonState = ref({ stale: true })
  const presentationSpeedProfile = ref('cinematic')
  const notifyCalls = []
  const applyImportedPresentationPaceCalls = []

  const deps = {
    debugMode,
    match,
    replayImportText,
    replayExportText,
    nnDebugTraceText,
    nnDebugTraceHistory,
    deferredPostDungeonState,
    presentationSpeedProfile,
    dungeonRunnerSettingsStore: {
      setAnimationPace: (pace) => {
        applyImportedPresentationPaceCalls.push(['setAnimationPace', pace])
      },
    },
    applyImportedPresentationPace: (pace) => {
      applyImportedPresentationPaceCalls.push(['applyImportedPresentationPace', pace])
      presentationSpeedProfile.value = pace
    },
    notify: (opts) => {
      notifyCalls.push(opts)
    },
    ...overrides,
  }

  return {
    deps,
    debugMode,
    match,
    replayImportText,
    replayExportText,
    nnDebugTraceText,
    nnDebugTraceHistory,
    deferredPostDungeonState,
    presentationSpeedProfile,
    notifyCalls,
    applyImportedPresentationPaceCalls,
  }
}

test('createLiveMatchShellMaintainerDebug exposes debug inject API shape', () => {
  const ctx = createTestDeps()
  const debug = createLiveMatchShellMaintainerDebug(ctx.deps)

  assert.equal(debug.debugMode, ctx.debugMode)
  assert.equal(debug.replayImportText, ctx.replayImportText)
  assert.equal(debug.replayExportText, ctx.replayExportText)
  assert.equal(debug.nnDebugTraceText, ctx.nnDebugTraceText)
  assert.equal(debug.nnDebugTraceHistory, ctx.nnDebugTraceHistory)
  assert.equal(typeof debug.exportReplay, 'function')
  assert.equal(typeof debug.importReplay, 'function')
  assert.equal(typeof debug.nnRuntimeOptions, 'function')
})

test('exportReplay is a no-op when match is absent', () => {
  const ctx = createTestDeps()
  const debug = createLiveMatchShellMaintainerDebug(ctx.deps)

  debug.exportReplay()

  assert.equal(ctx.replayExportText.value, '')
})

test('exportReplay writes serialized envelope when match is present', () => {
  const ctx = createTestDeps()
  const setup = { totalSeats: 2, opponents: [{ type: 'randombot' }] }
  const history = [{ action: { type: 'PASS' }, actorSeatId: 'seat-1' }]
  ctx.match.value = {
    setup,
    state: { rng: { seed: 42 }, history },
    presentationSpeedProfile: 'brisk',
  }
  const debug = createLiveMatchShellMaintainerDebug(ctx.deps)

  debug.exportReplay()

  const parsed = JSON.parse(ctx.replayExportText.value)
  assert.equal(parsed.seed, 42)
  assert.equal(parsed.presentationSpeedProfile, 'brisk')
  assert.deepEqual(parsed.setup, setup)
  assert.deepEqual(parsed.history, history)
})

test('exportReplay delegates to injectable exportReplayEnvelope', () => {
  const ctx = createTestDeps()
  ctx.match.value = {
    setup: { totalSeats: 2 },
    state: { rng: { seed: 7 }, history: [] },
    presentationSpeedProfile: 'cinematic',
  }
  const exportCalls = []
  const debug = createLiveMatchShellMaintainerDebug({
    ...ctx.deps,
    exportReplayEnvelope: (payload) => {
      exportCalls.push(payload)
      return { version: 1, ...payload }
    },
  })

  debug.exportReplay()

  assert.equal(exportCalls.length, 1)
  assert.equal(exportCalls[0].seed, 7)
  assert.equal(ctx.replayExportText.value.includes('"seed": 7'), true)
})

test('importReplay is a no-op when import text is blank', () => {
  const ctx = createTestDeps()
  const debug = createLiveMatchShellMaintainerDebug(ctx.deps)

  debug.importReplay()

  assert.equal(ctx.match.value, null)
  assert.equal(ctx.notifyCalls.length, 0)
})

test('importReplay is a no-op when import text is whitespace only', () => {
  const ctx = createTestDeps()
  ctx.replayImportText.value = '   \n\t  '
  const debug = createLiveMatchShellMaintainerDebug(ctx.deps)

  debug.importReplay()

  assert.equal(ctx.match.value, null)
  assert.equal(ctx.notifyCalls.length, 0)
})

test('importReplay notifies on invalid replay envelope', () => {
  const ctx = createTestDeps()
  ctx.replayImportText.value = JSON.stringify({ version: 1 })
  const debug = createLiveMatchShellMaintainerDebug(ctx.deps)

  debug.importReplay()

  assert.equal(ctx.notifyCalls.length, 1)
  assert.equal(ctx.notifyCalls[0].type, 'negative')
})

test('importReplay notifies when replay actions fail to rebuild state', () => {
  const ctx = createTestDeps()
  const envelope = exportReplayEnvelope({
    seed: 11,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [
      {
        action: { type: 'ADVANCE_DUNGEON' },
        actorSeatId: 'seat-1',
        rngStepBefore: 0,
        rngStepAfter: 1,
      },
    ],
  })
  ctx.replayImportText.value = JSON.stringify(envelope)
  const debug = createLiveMatchShellMaintainerDebug(ctx.deps)

  debug.importReplay()

  assert.equal(ctx.notifyCalls.length, 1)
  assert.equal(ctx.notifyCalls[0].type, 'negative')
  assert.equal(ctx.match.value, null)
})

test('importReplay notifies on malformed JSON', () => {
  const ctx = createTestDeps()
  ctx.replayImportText.value = '{not-json'
  const debug = createLiveMatchShellMaintainerDebug(ctx.deps)

  debug.importReplay()

  assert.equal(ctx.notifyCalls.length, 1)
  assert.equal(ctx.notifyCalls[0].type, 'negative')
})

test('importReplay applies valid envelope to match and presentation state', () => {
  const ctx = createTestDeps()
  const setup = { totalSeats: 2, opponents: [{ type: 'randombot' }] }
  const envelope = exportReplayEnvelope({
    seed: 99,
    setup,
    history: [
      {
        action: { type: 'PASS' },
        actorSeatId: 'seat-1',
        rngStepBefore: 0,
        rngStepAfter: 1,
      },
    ],
    presentationSpeedProfile: 'brisk',
  })
  ctx.replayImportText.value = JSON.stringify(envelope)
  const debug = createLiveMatchShellMaintainerDebug({
    ...ctx.deps,
    buildStateFromReplayEnvelope: () => ({
      ok: true,
      state: { rng: { seed: 99, step: 3 }, history: [] },
    }),
  })

  debug.importReplay()

  assert.equal(ctx.notifyCalls.length, 0)
  assert.equal(ctx.match.value?.schemaVersion, CURRENT_MATCH_SCHEMA_VERSION)
  assert.match(ctx.match.value?.id ?? '', /^match-\d+$/)
  assert.deepEqual(ctx.match.value?.setup, setup)
  assert.deepEqual(ctx.match.value?.history, [])
  assert.equal(ctx.match.value?.state?.rng?.seed, 99)
  assert.equal(ctx.match.value?.presentationSpeedProfile, 'brisk')
  assert.equal(ctx.deferredPostDungeonState.value, null)
  assert.equal(ctx.presentationSpeedProfile.value, 'brisk')
  assert.deepEqual(ctx.applyImportedPresentationPaceCalls, [
    ['setAnimationPace', 'brisk'],
    ['applyImportedPresentationPace', 'brisk'],
  ])
})

test('importReplay defaults presentation pace to cinematic when profile is absent', () => {
  const ctx = createTestDeps()
  const envelope = exportReplayEnvelope({
    seed: 55,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [],
  })
  ctx.replayImportText.value = JSON.stringify(envelope)
  const debug = createLiveMatchShellMaintainerDebug(ctx.deps)

  debug.importReplay()

  assert.equal(ctx.notifyCalls.length, 0)
  assert.equal(ctx.match.value?.presentationSpeedProfile, 'cinematic')
  assert.equal(ctx.presentationSpeedProfile.value, 'cinematic')
  assert.deepEqual(ctx.applyImportedPresentationPaceCalls, [
    ['setAnimationPace', 'cinematic'],
    ['applyImportedPresentationPace', 'cinematic'],
  ])
})

test('importReplay rebuilds state via injectable buildStateFromReplayEnvelope', () => {
  const ctx = createTestDeps()
  const envelope = exportReplayEnvelope({
    seed: 12,
    setup: { totalSeats: 2, opponents: [{ type: 'randombot' }] },
    history: [],
  })
  ctx.replayImportText.value = JSON.stringify(envelope)
  const buildCalls = []
  const debug = createLiveMatchShellMaintainerDebug({
    ...ctx.deps,
    buildStateFromReplayEnvelope: (replay) => {
      buildCalls.push(replay)
      return { ok: true, state: { rng: { seed: replay.seed }, history: [] } }
    },
  })

  debug.importReplay()

  assert.equal(buildCalls.length, 1)
  assert.equal(buildCalls[0].seed, 12)
})

test('importReplay end-to-end with real buildStateFromReplayEnvelope', () => {
  const setup = { totalSeats: 3, opponents: [{ type: 'randombot' }, { type: 'randombot' }] }
  const seed = 88
  const bootstrapState = bootstrapMatchStateForReplay(setup, seed)
  const actorSeatId = bootstrapState.turn.activeSeatId
  const choose = getLegalActions(bootstrapState, { seatId: actorSeatId }).find(
    (action) => action.type === 'CHOOSE_NEXT_ADVENTURER',
  )
  assert.ok(choose)
  const applied = applyAction(bootstrapState, choose, { seatId: actorSeatId })
  assert.equal(applied.ok, true)

  const ctx = createTestDeps()
  const envelope = exportReplayEnvelope({
    seed,
    setup,
    history: [
      {
        action: choose,
        actorSeatId,
        rngStepBefore: 0,
        rngStepAfter: applied.state.rng.step,
      },
    ],
    presentationSpeedProfile: 'cinematic',
  })
  ctx.replayImportText.value = JSON.stringify(envelope)
  const debug = createLiveMatchShellMaintainerDebug({
    ...ctx.deps,
    buildStateFromReplayEnvelope,
  })

  debug.importReplay()

  assert.equal(ctx.notifyCalls.length, 0)
  assert.equal(ctx.match.value?.state?.rng?.seed, seed)
  assert.equal(ctx.match.value?.state?.rng?.step, applied.state.rng.step)
})

test('nnRuntimeOptions omits trace wiring when debug mode is off', () => {
  const ctx = createTestDeps()
  const debug = createLiveMatchShellMaintainerDebug(ctx.deps)

  assert.deepEqual(debug.nnRuntimeOptions('model-a'), { modelId: 'model-a' })
})

test('nnRuntimeOptions records null seatId when match is absent', () => {
  const ctx = createTestDeps()
  ctx.debugMode.value = true
  const debug = createLiveMatchShellMaintainerDebug(ctx.deps)
  const options = debug.nnRuntimeOptions('model-a')

  options.debugLogger({ step: 'prefetch' })

  assert.equal(ctx.nnDebugTraceHistory.value[0].seatId, null)
})

test('nnRuntimeOptions records NN trace when debug mode is on', () => {
  const ctx = createTestDeps()
  ctx.debugMode.value = true
  ctx.match.value = { state: { turn: { activeSeatId: 'seat-2' } } }
  const debug = createLiveMatchShellMaintainerDebug(ctx.deps)
  const options = debug.nnRuntimeOptions('model-a')

  assert.equal(options.modelId, 'model-a')
  assert.equal(options.pipelineTrace, true)
  assert.equal(options.debugTrace, true)
  assert.equal(typeof options.debugLogger, 'function')

  options.debugLogger({ step: 'infer' })

  assert.equal(ctx.nnDebugTraceHistory.value.length, 1)
  assert.equal(ctx.nnDebugTraceHistory.value[0].modelId, 'model-a')
  assert.equal(ctx.nnDebugTraceHistory.value[0].seatId, 'seat-2')
  assert.equal(ctx.nnDebugTraceHistory.value[0].trace.step, 'infer')
  assert.equal(typeof ctx.nnDebugTraceHistory.value[0].at, 'string')
  assert.equal(ctx.nnDebugTraceText.value.includes('"model-a"'), true)
})

test('nnRuntimeOptions caps debug trace history at twenty entries', () => {
  const ctx = createTestDeps()
  ctx.debugMode.value = true
  ctx.nnDebugTraceHistory.value = Array.from({ length: 20 }, (_, index) => ({ index }))
  const debug = createLiveMatchShellMaintainerDebug(ctx.deps)
  const options = debug.nnRuntimeOptions('model-a')

  options.debugLogger({ step: 'new' })

  assert.equal(ctx.nnDebugTraceHistory.value.length, 20)
  assert.equal(ctx.nnDebugTraceHistory.value[0].trace.step, 'new')
})
