import assert from 'node:assert/strict'
import test from 'node:test'
import { ACTION_TYPES, applyAction, createInitialMatchState } from '../engine/kernel.js'
import {
  SPEED_PROFILES,
  createPresentationOrchestrator,
  mapEngineTransitionToAnimations,
} from './presentationOrchestrator.js'

test('orchestrator defaults to cinematic and supports brisk profile', () => {
  const cinematic = createPresentationOrchestrator()
  const brisk = createPresentationOrchestrator({ speedProfile: 'brisk' })
  const turnTransition = {
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-a',
    turnAfterSeatId: 'seat-b',
    dungeonRunResult: null,
  }

  cinematic.enqueueEngineTransition(turnTransition)
  brisk.enqueueEngineTransition(turnTransition)

  assert.equal(cinematic.getQueueSnapshot()[0].durationMs, SPEED_PROFILES.cinematic.turnAdvanceMs)
  assert.equal(brisk.getQueueSnapshot()[0].durationMs, SPEED_PROFILES.brisk.turnAdvanceMs)
})

test('gameplay lock stays active until queued gameplay animation drains', () => {
  const orchestrator = createPresentationOrchestrator()
  orchestrator.enqueueEngineTransition({
    phaseBefore: 'bidding',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-a',
    turnAfterSeatId: 'seat-b',
    dungeonRunResult: null,
  })

  assert.equal(orchestrator.isGameplayInputLocked(), true)
  const totalQueuedMs = orchestrator.getQueueSnapshot().reduce((sum, item) => sum + item.durationMs, 0)
  orchestrator.advance(totalQueuedMs - 1)
  assert.equal(orchestrator.isGameplayInputLocked(), true)
  orchestrator.advance(1)
  assert.equal(orchestrator.isGameplayInputLocked(), false)
})

test('utility ui remains accessible while gameplay input is locked', () => {
  const orchestrator = createPresentationOrchestrator()
  orchestrator.enqueueEngineTransition({
    phaseBefore: 'bidding',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-a',
    turnAfterSeatId: 'seat-b',
    dungeonRunResult: null,
  })

  assert.equal(orchestrator.isGameplayInputLocked(), true)
  assert.equal(orchestrator.isUtilityUiAccessible(), true)
})

test('bidding-to-dungeon engine transition maps to visible queued animation', () => {
  const initial = createInitialMatchState(
    { totalSeats: 3, opponents: [{ type: 'randombot' }, { type: 'randombot' }] },
    { seed: 111 },
  )

  let state = initial
  for (let i = 0; i < 2; i += 1) {
    const seatId = state.turn.activeSeatId
    const result = applyAction(state, { type: ACTION_TYPES.PASS }, { seatId })
    assert.equal(result.ok, true)
    state = result.state
  }

  const animations = mapEngineTransitionToAnimations({
    phaseBefore: initial.phase,
    phaseAfter: state.phase,
    turnBeforeSeatId: initial.turn.activeSeatId,
    turnAfterSeatId: state.turn.activeSeatId,
    dungeonRunResult: state.lastDungeonRun?.result ?? null,
  })

  assert.equal(animations.some((animation) => animation.kind === 'PHASE_ENTER_DUNGEON'), true)
})

test('dungeon reveal action maps to reveal animation kind', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'REVEAL_OR_CONTINUE' },
    dungeonBefore: dungeonSummary({ currentMonster: null, remainingMonsterCount: 3, discardedMonsterCount: 0, hp: 8 }),
    dungeonAfter: dungeonSummary({
      subphase: 'pick-fire-axe',
      currentMonster: 'dragon',
      remainingMonsterCount: 2,
      discardedMonsterCount: 0,
      hp: 8,
    }),
  })
  assert.deepEqual(
    animations.filter((animation) => animation.kind.startsWith('DUNGEON_')).map((animation) => animation.kind),
    ['DUNGEON_REVEAL'],
  )
})

test('dungeon equipment use maps to neutralize animation kind', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'USE_FIRE_AXE' },
    dungeonBefore: dungeonSummary({
      subphase: 'pick-fire-axe',
      currentMonster: 'orc',
      remainingMonsterCount: 2,
      discardedMonsterCount: 1,
      hp: 7,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 2,
      discardedMonsterCount: 2,
      hp: 7,
    }),
  })
  assert.deepEqual(
    animations.filter((animation) => animation.kind.startsWith('DUNGEON_')).map((animation) => animation.kind),
    ['DUNGEON_NEUTRALIZE', 'DUNGEON_CONTINUE'],
  )
})

test('dungeon decline fire axe does not map to damage when no hp lost', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'DECLINE_FIRE_AXE' },
    dungeonBefore: dungeonSummary({
      subphase: 'pick-fire-axe',
      currentMonster: 'orc',
      remainingMonsterCount: 2,
      discardedMonsterCount: 1,
      hp: 7,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'pick-polymorph',
      currentMonster: 'orc',
      remainingMonsterCount: 2,
      discardedMonsterCount: 1,
      hp: 7,
    }),
  })
  assert.equal(animations.some((animation) => animation.kind === 'DUNGEON_DAMAGE'), false)
})

test('dungeon decline fire axe includes damage when hp drops', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'DECLINE_FIRE_AXE' },
    dungeonBefore: dungeonSummary({
      subphase: 'pick-fire-axe',
      currentMonster: 'vampire',
      remainingMonsterCount: 2,
      discardedMonsterCount: 1,
      hp: 7,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 2,
      discardedMonsterCount: 2,
      hp: 3,
    }),
  })
  const dungeonKinds = animations
    .filter((animation) => animation.kind.startsWith('DUNGEON_'))
    .map((animation) => animation.kind)
  assert.equal(dungeonKinds.includes('DUNGEON_DAMAGE'), true)
  assert.equal(dungeonKinds.includes('DUNGEON_CONTINUE'), true)
})

test('dungeon reveal-or-continue queues reveal/neutralize/continue when deltas include all', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'REVEAL_OR_CONTINUE' },
    dungeonBefore: dungeonSummary({ currentMonster: null, remainingMonsterCount: 1, discardedMonsterCount: 2, hp: 4 }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 0,
      discardedMonsterCount: 3,
      hp: 4,
    }),
  })
  assert.deepEqual(
    animations.filter((animation) => animation.kind.startsWith('DUNGEON_')).map((animation) => animation.kind),
    ['DUNGEON_NEUTRALIZE', 'DUNGEON_CONTINUE'],
  )
})

test('dungeon animation ordering is deterministic for reveal/resolve/continue steps', () => {
  const neutralizeAndContinue = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'REVEAL_OR_CONTINUE' },
    dungeonBefore: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 1,
      discardedMonsterCount: 2,
      hp: 4,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 0,
      discardedMonsterCount: 3,
      hp: 4,
    }),
  })
  assert.deepEqual(
    neutralizeAndContinue.filter((animation) => animation.kind.startsWith('DUNGEON_')).map((animation) => animation.kind),
    ['DUNGEON_NEUTRALIZE', 'DUNGEON_CONTINUE'],
  )

  const neutralizeDamageContinue = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'USE_POLYMORPH' },
    dungeonBefore: dungeonSummary({
      subphase: 'pick-polymorph',
      currentMonster: 'golem',
      remainingMonsterCount: 1,
      discardedMonsterCount: 2,
      hp: 5,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 0,
      discardedMonsterCount: 3,
      hp: 3,
    }),
  })
  assert.deepEqual(
    neutralizeDamageContinue
      .filter((animation) => animation.kind.startsWith('DUNGEON_'))
      .map((animation) => animation.kind),
    ['DUNGEON_NEUTRALIZE', 'DUNGEON_DAMAGE', 'DUNGEON_CONTINUE'],
  )
})

test('preventable-damage pauses do not enqueue auto-continue animation', () => {
  const fireAxeWindow = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'DECLINE_FIRE_AXE' },
    dungeonBefore: dungeonSummary({
      subphase: 'pick-fire-axe',
      currentMonster: 'orc',
      remainingMonsterCount: 2,
      discardedMonsterCount: 1,
      hp: 7,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'pick-polymorph',
      currentMonster: 'orc',
      remainingMonsterCount: 2,
      discardedMonsterCount: 1,
      hp: 7,
    }),
  })
  const fireAxeKinds = fireAxeWindow.filter((animation) => animation.kind.startsWith('DUNGEON_')).map((animation) => animation.kind)
  assert.equal(fireAxeKinds.includes('DUNGEON_CONTINUE'), false)

  const polymorphWindow = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'DECLINE_POLYMORPH' },
    dungeonBefore: dungeonSummary({
      subphase: 'pick-polymorph',
      currentMonster: 'orc',
      remainingMonsterCount: 2,
      discardedMonsterCount: 1,
      hp: 7,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 2,
      discardedMonsterCount: 2,
      hp: 5,
    }),
  })
  const polymorphKinds = polymorphWindow
    .filter((animation) => animation.kind.startsWith('DUNGEON_'))
    .map((animation) => animation.kind)
  assert.equal(polymorphKinds.includes('DUNGEON_CONTINUE'), true)
})

test('deterministic reveal-or-continue transitions include auto-continue cue', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'REVEAL_OR_CONTINUE' },
    dungeonBefore: dungeonSummary({
      subphase: 'reveal',
      currentMonster: 'goblin',
      remainingMonsterCount: 2,
      discardedMonsterCount: 1,
      hp: 7,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 2,
      discardedMonsterCount: 2,
      hp: 7,
    }),
  })
  assert.deepEqual(
    animations.filter((animation) => animation.kind.startsWith('DUNGEON_')).map((animation) => animation.kind),
    ['DUNGEON_NEUTRALIZE', 'DUNGEON_CONTINUE'],
  )
})

test('use polymorph emits replacement reveal and follow-on continue branch when deterministic', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'USE_POLYMORPH' },
    dungeonBefore: dungeonSummary({
      subphase: 'pick-polymorph',
      currentMonster: 'golem',
      remainingMonsterCount: 1,
      discardedMonsterCount: 2,
      hp: 5,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 0,
      discardedMonsterCount: 3,
      hp: 3,
    }),
  })
  assert.deepEqual(
    animations.filter((animation) => animation.kind.startsWith('DUNGEON_')).map((animation) => animation.kind),
    ['DUNGEON_NEUTRALIZE', 'DUNGEON_DAMAGE', 'DUNGEON_CONTINUE'],
  )
})

test('dungeon run result maps to outcome animation kind', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'pick-adventurer',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: 'success',
  })
  const outcome = animations.find((animation) => animation.kind === 'DUNGEON_OUTCOME')
  assert.ok(outcome)
  assert.equal(outcome.durationMs, SPEED_PROFILES.cinematic.dungeonOutcomeMs)
})

test('dungeon resolution plays before phase transition when leaving dungeon for pick-adventurer', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'pick-adventurer',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-2',
    dungeonRunResult: 'success',
    actorRoleType: 'human',
  })
  const kinds = animations.map((a) => a.kind)
  const outcomeIdx = kinds.indexOf('DUNGEON_OUTCOME')
  const pickIdx = kinds.indexOf('PHASE_PICK_ADVENTURER')
  const turnIdx = kinds.indexOf('TURN_ADVANCE')
  assert.ok(outcomeIdx >= 0)
  assert.ok(pickIdx >= 0)
  assert.ok(turnIdx >= 0)
  assert.ok(outcomeIdx < pickIdx, 'outcome should play before pick-adventurer phase cue')
  assert.ok(pickIdx < turnIdx, 'phase cue should play before turn advance')
})

test('dungeon conclusion to match-over still maps outcome animation when run result is absent', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'match-over',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: null,
    dungeonRunResult: null,
    action: { type: 'REVEAL_OR_CONTINUE' },
    dungeonBefore: dungeonSummary({
      subphase: 'reveal',
      currentMonster: 'demon',
      remainingMonsterCount: 0,
      discardedMonsterCount: 4,
      hp: 1,
    }),
    dungeonAfter: dungeonSummary({
      subphase: null,
      currentMonster: null,
      remainingMonsterCount: 0,
      discardedMonsterCount: 5,
      hp: 0,
    }),
  })
  assert.equal(animations.some((animation) => animation.kind === 'DUNGEON_OUTCOME'), true)
  const kinds = animations.map((a) => a.kind)
  assert.ok(kinds.indexOf('DUNGEON_OUTCOME') < kinds.indexOf('PHASE_MATCH_OVER'))
})

test('turn advance is silent when actor is not human', () => {
  const bot = mapEngineTransitionToAnimations({
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-2',
    dungeonRunResult: null,
    action: { type: 'DRAW' },
    actorRoleType: 'randombot',
  })
  const botTurn = bot.find((animation) => animation.kind === 'TURN_ADVANCE')
  assert.ok(botTurn)
  assert.equal(botTurn.label, '')

  const human = mapEngineTransitionToAnimations({
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-2',
    dungeonRunResult: null,
    action: { type: 'PASS' },
    actorRoleType: 'human',
  })
  const humanTurn = human.find((animation) => animation.kind === 'TURN_ADVANCE')
  assert.ok(humanTurn)
  assert.equal(humanTurn.label, 'Advancing turn...')
})

test('bot bidding actions enqueue silent storytelling cues without hidden card info', () => {
  const orchestrator = createPresentationOrchestrator()

  orchestrator.enqueueEngineTransition({
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-2',
    turnAfterSeatId: 'seat-3',
    dungeonRunResult: null,
    action: { type: 'DRAW' },
    actorSeatId: 'seat-2',
    actorRoleType: 'randombot',
    centerEquipmentBefore: ['W_PLATE', 'W_SHIELD'],
    centerEquipmentAfter: ['W_PLATE', 'W_SHIELD'],
  })
  orchestrator.enqueueEngineTransition({
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-2',
    turnAfterSeatId: 'seat-3',
    dungeonRunResult: null,
    action: { type: 'ADD_TO_DUNGEON' },
    actorSeatId: 'seat-2',
    actorRoleType: 'randombot',
    centerEquipmentBefore: ['W_PLATE', 'W_SHIELD'],
    centerEquipmentAfter: ['W_PLATE', 'W_SHIELD'],
  })
  orchestrator.enqueueEngineTransition({
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-2',
    turnAfterSeatId: 'seat-3',
    dungeonRunResult: null,
    action: { type: 'SACRIFICE', equipmentId: 'W_SHIELD' },
    actorSeatId: 'seat-2',
    actorRoleType: 'randombot',
    centerEquipmentBefore: ['W_PLATE', 'W_SHIELD'],
    centerEquipmentAfter: ['W_PLATE'],
  })

  const storytelling = orchestrator
    .getQueueSnapshot()
    .filter((animation) => animation.kind.startsWith('BOT_BIDDING_'))

  assert.equal(storytelling.length, 3)
  assert.deepEqual(
    storytelling.map((animation) => animation.kind),
    ['BOT_BIDDING_DRAW', 'BOT_BIDDING_ADD', 'BOT_BIDDING_SACRIFICE'],
  )
  assert.equal(storytelling[0].label, '')
  assert.equal(storytelling[0].payload?.revealedMonsterCard, undefined)
  assert.deepEqual(storytelling[2].payload?.consumedEquipmentIds, ['W_SHIELD'])
})

test('hero change transition queues interstitial with cinematic profile duration', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'pick-adventurer',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    heroBefore: 'WARRIOR',
    heroAfter: 'MAGE',
  })

  const interstitial = animations.find((animation) => animation.kind === 'HERO_CHANGE_INTERSTITIAL')
  assert.ok(interstitial)
  assert.equal(interstitial.durationMs, SPEED_PROFILES.cinematic.heroChangeInterstitialMs)
  assert.equal(interstitial.skippable, true)
  assert.deepEqual(interstitial.payload, { heroBefore: 'WARRIOR', heroAfter: 'MAGE' })
})

test('hero change interstitial duration follows brisk speed profile', () => {
  const animations = mapEngineTransitionToAnimations(
    {
      phaseBefore: 'pick-adventurer',
      phaseAfter: 'bidding',
      turnBeforeSeatId: 'seat-1',
      turnAfterSeatId: 'seat-1',
      dungeonRunResult: null,
      heroBefore: 'WARRIOR',
      heroAfter: 'MAGE',
    },
    'brisk',
  )

  const interstitial = animations.find((animation) => animation.kind === 'HERO_CHANGE_INTERSTITIAL')
  assert.ok(interstitial)
  assert.equal(interstitial.durationMs, SPEED_PROFILES.brisk.heroChangeInterstitialMs)
})

test('orchestrator can skip active interstitial animation immediately', () => {
  const orchestrator = createPresentationOrchestrator()
  orchestrator.enqueueEngineTransition({
    phaseBefore: 'pick-adventurer',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    heroBefore: 'WARRIOR',
    heroAfter: 'MAGE',
  })

  assert.equal(orchestrator.getActiveAnimation()?.kind, 'HERO_CHANGE_INTERSTITIAL')
  orchestrator.skipActiveAnimation()
  assert.equal(orchestrator.getActiveAnimation(), null)
  assert.equal(orchestrator.isGameplayInputLocked(), false)
})

test('skip does not dequeue non-skippable gameplay animations', () => {
  const orchestrator = createPresentationOrchestrator()
  orchestrator.enqueueEngineTransition({
    phaseBefore: 'bidding',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-a',
    turnAfterSeatId: 'seat-b',
    dungeonRunResult: null,
  })

  const before = orchestrator.getActiveAnimation()
  assert.equal(before?.kind, 'PHASE_ENTER_DUNGEON')
  assert.notEqual(before?.skippable, true)
  orchestrator.skipActiveAnimation()
  assert.equal(orchestrator.getActiveAnimation()?.kind, 'PHASE_ENTER_DUNGEON')
  assert.equal(orchestrator.isGameplayInputLocked(), true)
})

test('setSpeedProfile rescales queued items when pace changes mid-queue', () => {
  const orchestrator = createPresentationOrchestrator({ speedProfile: 'cinematic' })
  orchestrator.enqueueEngineTransition({
    phaseBefore: 'bidding',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-a',
    turnAfterSeatId: 'seat-b',
    dungeonRunResult: null,
  })
  const phaseCinematic = SPEED_PROFILES.cinematic.phaseTransitionMs
  const phaseBrisk = SPEED_PROFILES.brisk.phaseTransitionMs
  orchestrator.advance(400)
  const mid = orchestrator.getQueueSnapshot()
  assert.equal(mid[0].kind, 'PHASE_ENTER_DUNGEON')
  assert.equal(mid[0].remainingMs, phaseCinematic - 400)

  orchestrator.setSpeedProfile('brisk')
  const after = orchestrator.getQueueSnapshot()
  assert.equal(
    after[0].remainingMs,
    Math.round((phaseCinematic - 400) * (phaseBrisk / phaseCinematic)),
  )
  assert.equal(after[0].durationMs, SPEED_PROFILES.brisk.phaseTransitionMs)
  assert.equal(after[1].durationMs, SPEED_PROFILES.brisk.turnAdvanceMs)
  assert.equal(after[1].remainingMs, SPEED_PROFILES.brisk.turnAdvanceMs)
})

test('setSpeedProfile is a no-op for unknown profile keys', () => {
  const orchestrator = createPresentationOrchestrator()
  orchestrator.enqueueEngineTransition({
    phaseBefore: 'bidding',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-a',
    turnAfterSeatId: 'seat-b',
    dungeonRunResult: null,
  })
  orchestrator.setSpeedProfile('fast')
  assert.equal(orchestrator.getQueueSnapshot()[0].durationMs, SPEED_PROFILES.cinematic.phaseTransitionMs)
})

test('dungeon animation kinds use brisk timing profile durations', () => {
  const animations = mapEngineTransitionToAnimations(
    {
      phaseBefore: 'dungeon',
      phaseAfter: 'dungeon',
      turnBeforeSeatId: 'seat-1',
      turnAfterSeatId: 'seat-1',
      dungeonRunResult: null,
      action: { type: 'USE_POLYMORPH' },
      dungeonBefore: dungeonSummary({
        subphase: 'pick-polymorph',
        currentMonster: 'dragon',
        remainingMonsterCount: 1,
        discardedMonsterCount: 2,
        hp: 6,
      }),
      dungeonAfter: dungeonSummary({
        subphase: 'reveal',
        currentMonster: null,
        remainingMonsterCount: 0,
        discardedMonsterCount: 3,
        hp: 2,
      }),
    },
    'brisk',
  )
  const durations = Object.fromEntries(
    animations.filter((animation) => animation.kind.startsWith('DUNGEON_')).map((animation) => [animation.kind, animation.durationMs]),
  )
  assert.equal(durations.DUNGEON_NEUTRALIZE, SPEED_PROFILES.brisk.dungeonNeutralizeMs)
  assert.equal(durations.DUNGEON_DAMAGE, SPEED_PROFILES.brisk.dungeonDamageMs)
  assert.equal(durations.DUNGEON_CONTINUE, SPEED_PROFILES.brisk.dungeonContinueMs)
})

function dungeonSummary({
  subphase = 'reveal',
  currentMonster = null,
  remainingMonsterCount = 0,
  discardedMonsterCount = 0,
  hp = 0,
} = {}) {
  return { subphase, currentMonster, remainingMonsterCount, discardedMonsterCount, hp }
}
