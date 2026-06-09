import assert from 'node:assert/strict'
import test from 'node:test'
import { effectScope, nextTick, ref } from 'vue'
import { MATCH_PHASES } from '../../engine/kernel.js'
import { SPEED_PROFILES } from '../presentationOrchestrator.js'
import { createLiveMatchShellPresentationBinding } from './createLiveMatchShellPresentationBinding.js'

function createMockOrchestrator(overrides = {}) {
  let locked = false
  /** @type {object | null} */
  let activeAnimation = null
  const calls = []
  return {
    calls,
    set locked(next) {
      locked = next
    },
    set active(next) {
      activeAnimation = next
    },
    isGameplayInputLocked: () => locked,
    getActiveAnimation: () => activeAnimation,
    getQueueSnapshot: () => [],
    setSpeedProfile: (pace) => {
      calls.push(['setSpeedProfile', pace])
    },
    clear: () => {
      calls.push('clear')
    },
    skipActiveAnimation: () => {
      calls.push('skipActiveAnimation')
    },
    enqueueEngineTransition: (transition, options) => {
      calls.push(['enqueueEngineTransition', transition, options])
    },
    flushPostDungeonOutcomeAnimations: () => {
      calls.push('flushPostDungeonOutcomeAnimations')
    },
    ...overrides,
  }
}

function createBinding(overrides = {}) {
  const presentationSpeedProfile = ref('cinematic')
  const match = ref({
    id: 'match-1',
    state: {
      phase: 'bidding',
      turn: { activeSeatId: 'seat-human' },
      seats: [{ id: 'seat-human', role: { type: 'human' } }],
      dungeon: null,
    },
  })
  const unlockCalls = []
  const orchestrator = createMockOrchestrator()
  let motionCapture = null

  const binding = createLiveMatchShellPresentationBinding({
    presentationSpeedProfile,
    getHumanSeatId: () => 'seat-human',
    getMatch: () => match.value,
    presentationTraceEnabled: () => false,
    onPersistPresentationSpeedProfile: () => {},
    onGameplayInputUnlocked: () => {
      unlockCalls.push('unlock')
    },
    getPresentationActiveTraceContext: () => ({}),
    debugMode: ref(false),
    aiTurnTrace: () => () => {},
    shouldDeferDungeonExitUntilOutcomeAck: () => false,
    createPresentationOrchestrator: () => orchestrator,
    usePresentationMotion: (opts) => {
      motionCapture = opts
    },
    ...overrides.deps,
  })

  return { binding, orchestrator, unlockCalls, presentationSpeedProfile, match, motionCapture }
}

test('syncPresentationLabel mirrors orchestrator gameplay lock into gameplayInputLocked', () => {
  const { binding, orchestrator } = createBinding()
  orchestrator.locked = true
  orchestrator.active = { id: 'a1', kind: 'TURN_ADVANCE', label: 'Turn' }

  binding.syncPresentationLabel()

  assert.equal(binding.gameplayInputLocked.value, true)
  assert.equal(binding.activePresentationLabel.value, 'Turn')
})

test('syncPresentationLabel calls onGameplayInputUnlocked when lock releases', () => {
  const { binding, orchestrator, unlockCalls } = createBinding()
  orchestrator.locked = true
  binding.syncPresentationLabel()
  assert.equal(unlockCalls.length, 0)

  orchestrator.locked = false
  binding.syncPresentationLabel()

  assert.equal(unlockCalls.length, 1)
  assert.equal(binding.gameplayInputLocked.value, false)
})

test('syncPresentationLabel does not call onGameplayInputUnlocked while lock stays active', () => {
  const { binding, orchestrator, unlockCalls } = createBinding()
  orchestrator.locked = true
  binding.syncPresentationLabel()
  binding.syncPresentationLabel()
  assert.equal(unlockCalls.length, 0)
})

test('setPresentationInputWasLockedFalse resets unlock edge detection', () => {
  const { binding, orchestrator, unlockCalls } = createBinding()
  orchestrator.locked = true
  binding.syncPresentationLabel()
  binding.setPresentationInputWasLockedFalse()
  orchestrator.locked = false
  binding.syncPresentationLabel()
  assert.equal(unlockCalls.length, 0)
})

test('enqueuePresentationTransition enqueues engine transition and syncs presentation', () => {
  const { binding, orchestrator } = createBinding()
  const prevState = {
    phase: MATCH_PHASES.BIDDING,
    turn: { activeSeatId: 'seat-a' },
    lastDungeonRun: null,
    centerEquipment: [],
    hero: null,
    dungeon: null,
    bidding: { revealedMonsterCard: null, revealedBySeatId: null },
  }
  const nextState = {
    phase: MATCH_PHASES.DUNGEON,
    turn: { activeSeatId: 'seat-b' },
    lastDungeonRun: { result: 'success' },
    centerEquipment: [],
    hero: null,
    dungeon: { subphase: 'reveal', hp: 3, remainingMonsters: [], discardedRunMonsters: [] },
  }

  binding.enqueuePresentationTransition(
    prevState,
    nextState,
    { type: 'ENTER_DUNGEON' },
    'seat-human',
    'human',
  )

  assert.equal(orchestrator.calls.length, 1)
  assert.equal(orchestrator.calls[0][0], 'enqueueEngineTransition')
  assert.equal(orchestrator.calls[0][2].deferPostDungeonOutcomeAck, false)
})

test('skipActivePresentation skips active animation and syncs label', () => {
  const { binding, orchestrator } = createBinding()
  orchestrator.active = { id: 'a1', kind: 'TURN_ADVANCE', label: 'Turn' }

  binding.skipActivePresentation()

  assert.deepEqual(orchestrator.calls, ['skipActiveAnimation'])
})

test('humanDungeonAutoRevealGapMs uses speed profile dungeonContinueMs', () => {
  const { binding, presentationSpeedProfile } = createBinding()
  presentationSpeedProfile.value = 'brisk'
  assert.equal(binding.humanDungeonAutoRevealGapMs(), SPEED_PROFILES.brisk.dungeonContinueMs)
})

test('syncPresentationLabel enriches BIDDING_DRAW payload for viewer seat', () => {
  const { binding, orchestrator } = createBinding()
  orchestrator.active = {
    id: 'draw-1',
    kind: 'BIDDING_DRAW',
    label: 'Draw',
    payload: { actorSeatId: 'seat-human' },
  }

  binding.syncPresentationLabel()

  assert.equal(binding.activePresentation.value.payload.shouldFlipFaceAfterArrival, true)
})

test('syncPresentationLabel enriches BIDDING_ADD payload for human actor', () => {
  const { binding, orchestrator } = createBinding()
  orchestrator.active = {
    id: 'add-1',
    kind: 'BIDDING_ADD',
    label: 'Add',
    payload: { actorSeatId: 'seat-human', actorRoleType: 'human' },
  }

  binding.syncPresentationLabel()

  assert.equal(binding.activePresentation.value.payload.shouldFlipToBackBeforeDungeon, true)
})

test('dungeonStageAnimationClass reflects synced active presentation kind', () => {
  const scope = effectScope()
  scope.run(() => {
    const { binding, orchestrator } = createBinding()
    orchestrator.active = { id: 'r1', kind: 'DUNGEON_REVEAL', label: 'Reveal' }
    binding.syncPresentationLabel()
    assert.equal(binding.dungeonStageAnimationClass.value, '')
  })
  scope.stop()
})

test('presentation speed profile watch updates orchestrator and persists', async () => {
  const scope = effectScope()
  await scope.run(async () => {
    const persistCalls = []
    const orchestrator = createMockOrchestrator()
    const presentationSpeedProfile = ref('cinematic')
    const match = ref({ id: 'm1', presentationSpeedProfile: 'cinematic' })

    createLiveMatchShellPresentationBinding({
      presentationSpeedProfile,
      getHumanSeatId: () => 'seat-human',
      getMatch: () => match.value,
      presentationTraceEnabled: () => false,
      onPersistPresentationSpeedProfile: (next) => {
        persistCalls.push(next)
        match.value = { ...match.value, presentationSpeedProfile: next }
      },
      onGameplayInputUnlocked: () => {},
      getPresentationActiveTraceContext: () => ({}),
      debugMode: ref(false),
      aiTurnTrace: () => () => {},
      shouldDeferDungeonExitUntilOutcomeAck: () => false,
      createPresentationOrchestrator: () => orchestrator,
      usePresentationMotion: () => {},
    })

    presentationSpeedProfile.value = 'brisk'
    await nextTick()

    assert.deepEqual(orchestrator.calls, [['setSpeedProfile', 'brisk']])
    assert.deepEqual(persistCalls, ['brisk'])
    assert.equal(match.value.presentationSpeedProfile, 'brisk')
  })
  scope.stop()
})

test('enqueuePresentationTransition passes deferPostDungeonOutcomeAck when defer policy applies', () => {
  const { binding, orchestrator } = createBinding({
    deps: {
      shouldDeferDungeonExitUntilOutcomeAck: () => true,
    },
  })
  const prevState = {
    phase: MATCH_PHASES.DUNGEON,
    turn: { activeSeatId: 'seat-a' },
    lastDungeonRun: null,
    centerEquipment: [],
    hero: null,
    dungeon: null,
  }
  const nextState = { ...prevState, phase: MATCH_PHASES.BIDDING }

  binding.enqueuePresentationTransition(
    prevState,
    nextState,
    { type: 'CONTINUE' },
    'seat-human',
    'human',
  )

  assert.equal(orchestrator.calls[0][2].deferPostDungeonOutcomeAck, true)
})

test('enqueuePresentationTransition summarizes dungeon and bidding context for orchestrator', () => {
  const { binding, orchestrator } = createBinding()
  const prevState = {
    phase: MATCH_PHASES.BIDDING,
    turn: { activeSeatId: 'seat-a' },
    lastDungeonRun: null,
    centerEquipment: ['W_PLATE'],
    hero: 'WARRIOR',
    dungeon: null,
    bidding: { revealedMonsterCard: 'M_GOBLIN', revealedBySeatId: 'seat-a' },
  }
  const nextState = {
    phase: MATCH_PHASES.DUNGEON,
    turn: { activeSeatId: 'seat-b' },
    lastDungeonRun: { result: 'success' },
    centerEquipment: ['W_PLATE', 'R_DAGGER'],
    hero: 'ROGUE',
    dungeon: {
      subphase: 'reveal',
      hp: 4,
      currentMonster: 'M_ORC',
      remainingMonsters: ['M_TROLL'],
      discardedRunMonsters: ['M_GOBLIN'],
      lastDefeatRecord: {
        monsterCard: 'M_GOBLIN',
        byEquipmentIds: ['W_PLATE'],
        expendedEquipmentIds: [],
      },
    },
  }

  binding.enqueuePresentationTransition(
    prevState,
    nextState,
    { type: 'ENTER_DUNGEON' },
    'seat-human',
    'human',
  )

  const transition = orchestrator.calls[0][1]
  assert.equal(transition.phaseBefore, MATCH_PHASES.BIDDING)
  assert.equal(transition.phaseAfter, MATCH_PHASES.DUNGEON)
  assert.equal(transition.dungeonRunResult, 'success')
  assert.deepEqual(transition.centerEquipmentBefore, ['W_PLATE'])
  assert.deepEqual(transition.centerEquipmentAfter, ['W_PLATE', 'R_DAGGER'])
  assert.equal(transition.heroBefore, 'WARRIOR')
  assert.equal(transition.heroAfter, 'ROGUE')
  assert.deepEqual(transition.biddingBefore, {
    revealedMonsterCard: 'M_GOBLIN',
    revealedBySeatId: 'seat-a',
  })
  assert.equal(transition.dungeonBefore, null)
  assert.equal(transition.dungeonAfter.subphase, 'reveal')
  assert.equal(transition.dungeonAfter.currentMonster, 'M_ORC')
  assert.equal(transition.dungeonAfter.remainingMonsterCount, 1)
  assert.equal(transition.dungeonAfter.discardedMonsterCount, 1)
  assert.deepEqual(transition.dungeonAfter.discardedRunMonsterIds, ['M_GOBLIN'])
  assert.equal(transition.dungeonAfter.hp, 4)
  assert.deepEqual(transition.dungeonAfter.lastDefeatRecord.byEquipmentIds, ['W_PLATE'])
})

test('enqueuePresentationTransition omits biddingBefore when leaving non-bidding phase', () => {
  const { binding, orchestrator } = createBinding()
  const state = {
    phase: MATCH_PHASES.DUNGEON,
    turn: { activeSeatId: 'seat-a' },
    lastDungeonRun: null,
    centerEquipment: [],
    hero: null,
    dungeon: { subphase: 'continue', hp: 2, remainingMonsters: [], discardedRunMonsters: [] },
  }

  binding.enqueuePresentationTransition(state, state, { type: 'CONTINUE' }, 'seat-a', 'human')

  assert.equal(orchestrator.calls[0][1].biddingBefore, null)
})

test('resetPresentationForBootstrap clears orchestrator, applies pace, and syncs label', () => {
  const { binding, orchestrator } = createBinding()
  orchestrator.active = { id: 'stale', kind: 'TURN_ADVANCE', label: 'Stale' }

  binding.resetPresentationForBootstrap('brisk')

  assert.deepEqual(orchestrator.calls, ['clear', ['setSpeedProfile', 'brisk']])
  assert.equal(binding.activePresentationLabel.value, 'Stale')
})

test('resetPresentationForBootstrap updates presentationSpeedProfile ref', () => {
  const { binding, presentationSpeedProfile } = createBinding()

  binding.resetPresentationForBootstrap('brisk')

  assert.equal(presentationSpeedProfile.value, 'brisk')
})

test('applyImportedPresentationPace resets orchestrator and syncs active presentation', () => {
  const { binding, orchestrator, presentationSpeedProfile } = createBinding()
  orchestrator.active = { id: 'a1', kind: 'TURN_ADVANCE', label: 'Turn' }

  binding.applyImportedPresentationPace('brisk')

  assert.equal(presentationSpeedProfile.value, 'brisk')
  assert.deepEqual(orchestrator.calls, [['setSpeedProfile', 'brisk'], 'clear'])
  assert.equal(binding.activePresentationLabel.value, 'Turn')
})

test('clearPresentationOrchestrator clears orchestrator queue', () => {
  const { binding, orchestrator } = createBinding()

  binding.clearPresentationOrchestrator()

  assert.deepEqual(orchestrator.calls, ['clear'])
})

test('flushPostDungeonOutcomeAnimations delegates to orchestrator', () => {
  const { binding, orchestrator } = createBinding()

  binding.flushPostDungeonOutcomeAnimations()

  assert.deepEqual(orchestrator.calls, ['flushPostDungeonOutcomeAnimations'])
})

test('preparePresentationOnMount applies current speed profile', () => {
  const { binding, orchestrator, presentationSpeedProfile } = createBinding()
  presentationSpeedProfile.value = 'brisk'

  binding.preparePresentationOnMount()

  assert.deepEqual(orchestrator.calls, [['setSpeedProfile', 'brisk']])
})

test('bindBoardShellRef assigns component ref target', () => {
  const { binding } = createBinding()
  const el = { nodeType: 1, tagName: 'DIV' }

  binding.bindBoardShellRef(el)

  assert.equal(binding.boardShellRef.value?.tagName, 'DIV')
})

test('bindBiddingEquipmentBadgeRef tracks equipment motion anchors', () => {
  const { binding, motionCapture } = createBinding()
  const equipmentNode = { nodeType: 1, tagName: 'SPAN' }

  binding.bindBiddingEquipmentBadgeRef('W_PLATE', equipmentNode)
  const refs = motionCapture.getMotionRefs({
    kind: 'BIDDING_SACRIFICE',
    payload: { responsibleEquipmentIds: ['W_PLATE'] },
  })

  assert.equal(refs.equipment_W_PLATE?.tagName, 'SPAN')
})

test('motion refs use hero overlay path for HERO_CHANGE_INTERSTITIAL', () => {
  const { binding, motionCapture } = createBinding()
  const overlay = { nodeType: 1, tagName: 'SECTION' }
  const board = { nodeType: 1, tagName: 'MAIN' }
  binding.bindHeroChangeInterstitialOverlayRef(overlay)
  binding.bindBoardShellRef(board)

  const refs = motionCapture.getMotionRefs({ kind: 'HERO_CHANGE_INTERSTITIAL' })

  assert.equal(refs.heroChangeInterstitialOverlay?.tagName, 'SECTION')
  assert.equal(refs.boardShell?.tagName, 'MAIN')
  assert.equal(refs.dungeonCardWrap, undefined)
})

test('syncPresentationLabel enriches BIDDING_DRAW as hidden for non-viewer seat', () => {
  const { binding, orchestrator } = createBinding()
  orchestrator.active = {
    id: 'draw-1',
    kind: 'BIDDING_DRAW',
    label: 'Draw',
    payload: { actorSeatId: 'seat-bot' },
  }

  binding.syncPresentationLabel()

  assert.equal(binding.activePresentation.value.payload.shouldFlipFaceAfterArrival, false)
})

test('syncPresentationLabel enriches BIDDING_ADD as no flip for bot actor', () => {
  const { binding, orchestrator } = createBinding()
  orchestrator.active = {
    id: 'add-1',
    kind: 'BIDDING_ADD',
    label: 'Add',
    payload: { actorSeatId: 'seat-bot', actorRoleType: 'randombot' },
  }

  binding.syncPresentationLabel()

  assert.equal(binding.activePresentation.value.payload.shouldFlipToBackBeforeDungeon, false)
})

test('syncPresentationLabel logs presentation unlock trace when debug mode is on', () => {
  const traceSteps = []
  const { binding, orchestrator } = createBinding({
    deps: {
      debugMode: ref(true),
      aiTurnTrace: () => (step, detail) => {
        traceSteps.push([step, detail])
      },
      getIsHumanTurn: () => true,
    },
  })
  orchestrator.locked = true
  binding.syncPresentationLabel()
  orchestrator.locked = false
  binding.syncPresentationLabel()

  assert.equal(traceSteps.length, 1)
  assert.equal(traceSteps[0][0], 'presentation.unlock')
  assert.equal(traceSteps[0][1].isHumanTurn, true)
})

test('humanDungeonAutoRevealGapMs falls back to cinematic profile for unknown pace', () => {
  const { binding, presentationSpeedProfile } = createBinding()
  presentationSpeedProfile.value = 'unknown-pace'

  assert.equal(binding.humanDungeonAutoRevealGapMs(), SPEED_PROFILES.cinematic.dungeonContinueMs)
})
