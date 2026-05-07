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

test('hero change transition queues interstitial with default 1800ms duration', () => {
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
  assert.equal(interstitial.durationMs, 1800)
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
  orchestrator.advance(400)
  const mid = orchestrator.getQueueSnapshot()
  assert.equal(mid[0].kind, 'PHASE_ENTER_DUNGEON')
  assert.equal(mid[0].remainingMs, 500)

  orchestrator.setSpeedProfile('brisk')
  const after = orchestrator.getQueueSnapshot()
  assert.equal(after[0].remainingMs, 250)
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
