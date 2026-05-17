import assert from 'node:assert/strict'
import test from 'node:test'
import { ACTION_TYPES, applyAction, createInitialMatchState } from '../engine/kernel.js'
import {
  SPEED_PROFILES,
  createPresentationOrchestrator,
  mapEngineTransitionToAnimations,
  splitPresentationAfterDungeonOutcome,
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
  const reveal = animations.find((a) => a.kind === 'DUNGEON_REVEAL')
  assert.deepEqual(reveal?.payload, { revealedMonsterId: 'dragon' })
})

test('dungeon equipment use maps to neutralize animation kind', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'USE_FIRE_AXE' },
    centerEquipmentBefore: ['B_AXE', 'W_PLATE'],
    centerEquipmentAfter: ['W_PLATE'],
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
  const neutralize = animations.find((a) => a.kind === 'DUNGEON_NEUTRALIZE')
  assert.ok(neutralize)
  assert.deepEqual(neutralize.payload, {
    neutralizedMonsterIds: ['orc'],
    consumedEquipmentIds: ['B_AXE'],
    responsibleEquipmentIds: ['B_AXE'],
    expendedEquipmentIds: ['B_AXE'],
    engineActionType: 'USE_FIRE_AXE',
    isFinalDungeonMonsterDefeat: false,
  })
  const continueBeat = animations.find((a) => a.kind === 'DUNGEON_CONTINUE')
  assert.ok(continueBeat)
  assert.deepEqual(continueBeat.payload, { dungeonSubphaseAfter: 'reveal' })
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
    dungeonBefore: dungeonSummary({
      currentMonster: null,
      remainingMonsterCount: 1,
      discardedMonsterCount: 2,
      hp: 4,
      discardedRunMonsterIds: ['a', 'b'],
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 0,
      discardedMonsterCount: 3,
      hp: 4,
      discardedRunMonsterIds: ['a', 'b', 'lich'],
    }),
  })
  assert.deepEqual(
    animations.filter((animation) => animation.kind.startsWith('DUNGEON_')).map((animation) => animation.kind),
    ['DUNGEON_REVEAL', 'DUNGEON_NEUTRALIZE', 'DUNGEON_CONTINUE'],
  )
  const reveal = animations.find((a) => a.kind === 'DUNGEON_REVEAL')
  assert.deepEqual(reveal?.payload, { revealedMonsterId: 'lich' })
  const neutralize = animations.find((a) => a.kind === 'DUNGEON_NEUTRALIZE')
  assert.deepEqual(neutralize?.payload, {
    neutralizedMonsterIds: ['lich'],
    consumedEquipmentIds: [],
    responsibleEquipmentIds: [],
    expendedEquipmentIds: [],
    engineActionType: 'REVEAL_OR_CONTINUE',
    isFinalDungeonMonsterDefeat: true,
  })
})

test('dungeon neutralize payload prefers discard pile diff when ids are present', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'USE_POLYMORPH' },
    centerEquipmentBefore: ['M_POLY', 'B_AXE'],
    centerEquipmentAfter: ['B_AXE'],
    dungeonBefore: dungeonSummary({
      subphase: 'pick-polymorph',
      currentMonster: 'golem',
      remainingMonsterCount: 1,
      discardedMonsterCount: 2,
      hp: 5,
      discardedRunMonsterIds: ['a', 'b'],
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 0,
      discardedMonsterCount: 3,
      hp: 3,
      discardedRunMonsterIds: ['a', 'b', 'golem'],
    }),
  })
  const neutralize = animations.find((a) => a.kind === 'DUNGEON_NEUTRALIZE')
  assert.deepEqual(neutralize?.payload, {
    neutralizedMonsterIds: ['golem'],
    consumedEquipmentIds: ['M_POLY'],
    responsibleEquipmentIds: ['M_POLY'],
    expendedEquipmentIds: ['M_POLY'],
    engineActionType: 'USE_POLYMORPH',
    isFinalDungeonMonsterDefeat: true,
  })
  const damage = animations.find((a) => a.kind === 'DUNGEON_DAMAGE')
  assert.deepEqual(damage?.payload, { hpDelta: -2 })
})

test('dungeon neutralize payload reads responsible/expended ids from defeat record (passive torch)', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'REVEAL_OR_CONTINUE' },
    dungeonBefore: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 2,
      discardedMonsterCount: 1,
      hp: 6,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 1,
      discardedMonsterCount: 2,
      hp: 6,
      lastDefeatRecord: {
        monsterCard: 'goblin',
        byEquipmentIds: ['W_TORCH'],
        expendedEquipmentIds: [],
      },
    }),
  })
  assert.equal(animations.findIndex((a) => a.kind === 'DUNGEON_REVEAL'), 0)
  assert.deepEqual(animations.find((a) => a.kind === 'DUNGEON_REVEAL')?.payload, {
    revealedMonsterId: 'goblin',
  })
  const neutralize = animations.find((a) => a.kind === 'DUNGEON_NEUTRALIZE')
  assert.ok(neutralize)
  assert.deepEqual(neutralize.payload.responsibleEquipmentIds, ['W_TORCH'])
  assert.deepEqual(neutralize.payload.expendedEquipmentIds, [])
  assert.deepEqual(neutralize.payload.consumedEquipmentIds, [])
  assert.equal(neutralize.payload.isFinalDungeonMonsterDefeat, false)
})

test('dungeon neutralize payload reads responsible/expended ids from defeat record (single-use vorpal)', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'REVEAL_OR_CONTINUE' },
    dungeonBefore: dungeonSummary({
      subphase: 'vorpal',
      currentMonster: null,
      remainingMonsterCount: 1,
      discardedMonsterCount: 0,
      hp: 6,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 0,
      discardedMonsterCount: 1,
      hp: 6,
      lastDefeatRecord: {
        monsterCard: 'dragon',
        byEquipmentIds: ['W_VORPAL'],
        expendedEquipmentIds: ['W_VORPAL'],
      },
    }),
  })
  assert.deepEqual(
    animations.filter((a) => a.kind.startsWith('DUNGEON_')).map((a) => a.kind),
    ['DUNGEON_REVEAL', 'DUNGEON_NEUTRALIZE', 'DUNGEON_CONTINUE'],
  )
  assert.deepEqual(animations.find((a) => a.kind === 'DUNGEON_REVEAL')?.payload, {
    revealedMonsterId: 'dragon',
  })
  const neutralize = animations.find((a) => a.kind === 'DUNGEON_NEUTRALIZE')
  assert.ok(neutralize)
  assert.deepEqual(neutralize.payload.responsibleEquipmentIds, ['W_VORPAL'])
  assert.deepEqual(neutralize.payload.expendedEquipmentIds, ['W_VORPAL'])
  assert.deepEqual(neutralize.payload.consumedEquipmentIds, ['W_VORPAL'])
  assert.equal(neutralize.payload.isFinalDungeonMonsterDefeat, true)
})

test('dungeon neutralize payload omits responsible ids for combat-only defeat', () => {
  const animations = mapEngineTransitionToAnimations({
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
      discardedMonsterCount: 0,
      hp: 6,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 0,
      discardedMonsterCount: 1,
      hp: 4,
      lastDefeatRecord: {
        monsterCard: 'orc',
        byEquipmentIds: [],
        expendedEquipmentIds: [],
      },
    }),
  })
  assert.deepEqual(animations.find((a) => a.kind === 'DUNGEON_REVEAL')?.payload, {
    revealedMonsterId: 'orc',
  })
  const neutralize = animations.find((a) => a.kind === 'DUNGEON_NEUTRALIZE')
  assert.ok(neutralize)
  assert.deepEqual(neutralize.payload.responsibleEquipmentIds, [])
  assert.deepEqual(neutralize.payload.expendedEquipmentIds, [])
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
      discardedRunMonsterIds: ['x', 'y'],
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 0,
      discardedMonsterCount: 3,
      hp: 4,
      discardedRunMonsterIds: ['x', 'y', 'z'],
    }),
  })
  assert.deepEqual(
    neutralizeAndContinue.filter((animation) => animation.kind.startsWith('DUNGEON_')).map((animation) => animation.kind),
    ['DUNGEON_REVEAL', 'DUNGEON_NEUTRALIZE', 'DUNGEON_CONTINUE'],
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

test('combat damage from reveal step still flashes reveal when remaining count drops', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'REVEAL_OR_CONTINUE' },
    dungeonBefore: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 3,
      discardedMonsterCount: 0,
      hp: 7,
    }),
    dungeonAfter: dungeonSummary({
      subphase: 'reveal',
      currentMonster: null,
      remainingMonsterCount: 2,
      discardedMonsterCount: 0,
      hp: 5,
    }),
  })
  assert.deepEqual(
    animations.filter((animation) => animation.kind.startsWith('DUNGEON_')).map((animation) => animation.kind),
    ['DUNGEON_REVEAL', 'DUNGEON_DAMAGE', 'DUNGEON_CONTINUE'],
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
  assert.deepEqual(outcome.payload, { dungeonRunResult: 'success' })
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

test('splitPresentationAfterDungeonOutcome ends immediate queue on DUNGEON_OUTCOME', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'pick-adventurer',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-2',
    dungeonRunResult: 'success',
    actorRoleType: 'human',
  })
  const { immediate, deferred } = splitPresentationAfterDungeonOutcome(animations)
  assert.equal(immediate[immediate.length - 1]?.kind, 'DUNGEON_OUTCOME')
  assert.ok(deferred.some((a) => a.kind === 'PHASE_PICK_ADVENTURER'))
  assert.ok(deferred.some((a) => a.kind === 'TURN_ADVANCE'))
})

test('splitPresentationAfterDungeonOutcome without outcome leaves full queue immediate', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'bidding',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-a',
    turnAfterSeatId: 'seat-b',
    dungeonRunResult: null,
  })
  const { immediate, deferred } = splitPresentationAfterDungeonOutcome(animations)
  assert.deepEqual(immediate, animations)
  assert.equal(deferred.length, 0)
})

test('deferPostDungeonOutcomeAck drains outcome then flush enqueues deferred phase animations', () => {
  const transition = {
    phaseBefore: 'dungeon',
    phaseAfter: 'pick-adventurer',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-2',
    dungeonRunResult: 'success',
    actorRoleType: 'human',
  }
  const full = mapEngineTransitionToAnimations(transition)
  const outcomeMs = full.find((a) => a.kind === 'DUNGEON_OUTCOME')?.durationMs ?? 0
  const orchestrator = createPresentationOrchestrator()
  orchestrator.enqueueEngineTransition(transition, { deferPostDungeonOutcomeAck: true })

  const kindsBefore = orchestrator.getQueueSnapshot().map((a) => a.kind)
  assert.ok(kindsBefore.includes('DUNGEON_OUTCOME'))
  assert.equal(kindsBefore.includes('PHASE_PICK_ADVENTURER'), false)

  orchestrator.advance(outcomeMs)
  assert.equal(orchestrator.getActiveAnimation(), null)

  orchestrator.flushPostDungeonOutcomeAnimations()
  assert.equal(orchestrator.getActiveAnimation()?.kind, 'PHASE_PICK_ADVENTURER')
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

test('bot bidding actions enqueue presentation kinds without hidden card info', () => {
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

  const botBidding = orchestrator
    .getQueueSnapshot()
    .filter((animation) => animation.kind.startsWith('BIDDING_'))

  assert.equal(botBidding.length, 3)
  assert.deepEqual(
    botBidding.map((animation) => animation.kind),
    ['BIDDING_DRAW', 'BIDDING_ADD', 'BIDDING_SACRIFICE'],
  )
  assert.equal(botBidding[0].label, '')
  assert.equal(botBidding[0].payload?.revealedMonsterCard, undefined)
  assert.deepEqual(botBidding[2].payload?.consumedEquipmentIds, ['W_SHIELD'])
  assert.equal(botBidding[2].payload?.engineActionType, 'SACRIFICE')
})

test('bot bidding sacrifice payload falls back to action equipmentId when center diff missing', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-2',
    turnAfterSeatId: 'seat-3',
    dungeonRunResult: null,
    action: { type: 'SACRIFICE', equipmentId: 'W_SHIELD' },
    actorRoleType: 'randombot',
    centerEquipmentBefore: [],
    centerEquipmentAfter: [],
  })
  const sacrifice = animations.find((a) => a.kind === 'BIDDING_SACRIFICE')
  assert.ok(sacrifice)
  assert.deepEqual(sacrifice.payload.consumedEquipmentIds, ['W_SHIELD'])
})

test('bidding sacrifice payload carries eliminated monster context from biddingBefore', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-2',
    dungeonRunResult: null,
    action: { type: 'SACRIFICE', equipmentId: 'W_SHIELD' },
    actorRoleType: 'human',
    actorSeatId: 'seat-2',
    centerEquipmentBefore: ['W_PLATE', 'W_SHIELD'],
    centerEquipmentAfter: ['W_PLATE'],
    biddingBefore: {
      revealedMonsterCard: 'dragon',
      revealedBySeatId: 'seat-1',
    },
  })
  const sacrifice = animations.find((a) => a.kind === 'BIDDING_SACRIFICE')
  assert.equal(sacrifice?.payload?.eliminatedMonsterCard, 'dragon')
  assert.equal(sacrifice?.payload?.revealedToSeatId, 'seat-1')
})

test('human bidding sacrifice queues same BIDDING_SACRIFICE payload shape as bot', () => {
  const animations = mapEngineTransitionToAnimations({
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-2',
    dungeonRunResult: null,
    action: { type: 'SACRIFICE', equipmentId: 'W_SHIELD' },
    actorRoleType: 'human',
    actorSeatId: 'seat-1',
    centerEquipmentBefore: ['W_PLATE', 'W_SHIELD'],
    centerEquipmentAfter: ['W_PLATE'],
  })
  const kinds = animations.map((a) => a.kind)
  assert.ok(kinds.includes('BIDDING_SACRIFICE'))
  assert.equal(kinds.includes('BIDDING_DRAW'), false)
  assert.equal(kinds.includes('BIDDING_ADD'), false)
  const sacrifice = animations.find((a) => a.kind === 'BIDDING_SACRIFICE')
  assert.deepEqual(sacrifice?.payload?.consumedEquipmentIds, ['W_SHIELD'])
  assert.equal(sacrifice?.payload?.engineActionType, 'SACRIFICE')
  assert.equal(sacrifice?.payload?.actorSeatId, 'seat-1')
  assert.equal(sacrifice?.payload?.eliminatedMonsterCard ?? null, null)
  assert.equal(sacrifice?.payload?.revealedToSeatId ?? null, null)
})

test('human bidding draw and add enqueue same kinds as bot', () => {
  const draw = mapEngineTransitionToAnimations({
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'DRAW' },
    actorRoleType: 'human',
    actorSeatId: 'seat-1',
  })
  assert.ok(draw.some((a) => a.kind === 'BIDDING_DRAW'))
  const drawBeat = draw.find((a) => a.kind === 'BIDDING_DRAW')
  assert.equal(drawBeat?.payload?.engineActionType, 'DRAW')
  assert.equal(drawBeat?.payload?.actorSeatId, 'seat-1')

  const add = mapEngineTransitionToAnimations({
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'ADD_TO_DUNGEON' },
    actorRoleType: 'human',
    actorSeatId: 'seat-2',
  })
  assert.ok(add.some((a) => a.kind === 'BIDDING_ADD'))
  assert.equal(add.find((a) => a.kind === 'BIDDING_ADD')?.payload?.actorSeatId, 'seat-2')
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

test('flight-related beats expose stable payload keys from engine facts', () => {
  const neutralize = mapEngineTransitionToAnimations({
    phaseBefore: 'dungeon',
    phaseAfter: 'dungeon',
    turnBeforeSeatId: 'seat-1',
    turnAfterSeatId: 'seat-1',
    dungeonRunResult: null,
    action: { type: 'USE_FIRE_AXE' },
    centerEquipmentBefore: ['B_AXE', 'W_PLATE'],
    centerEquipmentAfter: ['W_PLATE'],
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
  }).find((a) => a.kind === 'DUNGEON_NEUTRALIZE')

  assert.ok(neutralize)
  assert.deepEqual(Object.keys(neutralize.payload).sort(), [
    'consumedEquipmentIds',
    'engineActionType',
    'expendedEquipmentIds',
    'isFinalDungeonMonsterDefeat',
    'neutralizedMonsterIds',
    'responsibleEquipmentIds',
  ])
  assert.equal(neutralize.payload.engineActionType, 'USE_FIRE_AXE')

  const sacrifice = mapEngineTransitionToAnimations({
    phaseBefore: 'bidding',
    phaseAfter: 'bidding',
    turnBeforeSeatId: 'seat-2',
    turnAfterSeatId: 'seat-3',
    dungeonRunResult: null,
    action: { type: 'SACRIFICE', equipmentId: 'W_SHIELD' },
    actorRoleType: 'randombot',
    centerEquipmentBefore: ['W_PLATE', 'W_SHIELD'],
    centerEquipmentAfter: ['W_PLATE'],
  }).find((a) => a.kind === 'BIDDING_SACRIFICE')

  assert.ok(sacrifice)
  assert.deepEqual(Object.keys(sacrifice.payload).sort(), [
    'actorRoleType',
    'actorSeatId',
    'consumedEquipmentIds',
    'eliminatedMonsterCard',
    'engineActionType',
    'expendedEquipmentIds',
    'responsibleEquipmentIds',
    'revealedToSeatId',
  ])
  assert.equal(sacrifice.payload.engineActionType, 'SACRIFICE')
})

function dungeonSummary({
  subphase = 'reveal',
  currentMonster = null,
  remainingMonsterCount = 0,
  discardedMonsterCount = 0,
  discardedRunMonsterIds,
  hp = 0,
  lastDefeatRecord,
} = {}) {
  const out = { subphase, currentMonster, remainingMonsterCount, discardedMonsterCount, hp }
  if (discardedRunMonsterIds !== undefined) {
    out.discardedRunMonsterIds = discardedRunMonsterIds
  }
  if (lastDefeatRecord !== undefined) {
    out.lastDefeatRecord = lastDefeatRecord
  }
  return out
}
