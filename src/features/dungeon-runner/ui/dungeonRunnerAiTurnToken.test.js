import assert from 'node:assert/strict'
import test from 'node:test'
import { BIDDING_SUBPHASES, DUNGEON_SUBPHASES, MATCH_PHASES } from '../engine/kernel.js'
import { buildAiTurnRunToken } from './dungeonRunnerAiTurnToken.js'

test('bidding draw and follow-up resolve use different tokens at the same turn number', () => {
  const matchId = 'match-1'
  const beforeDraw = {
    turn: { turnNumber: 1, activeSeatId: 'seat-3' },
    phase: MATCH_PHASES.BIDDING,
    bidding: { subphase: BIDDING_SUBPHASES.TURN, revealedMonsterCard: null },
  }
  const afterDraw = {
    ...beforeDraw,
    bidding: { subphase: BIDDING_SUBPHASES.PENDING, revealedMonsterCard: 'goblin-1' },
  }

  assert.notEqual(
    buildAiTurnRunToken({ matchId, state: beforeDraw }),
    buildAiTurnRunToken({ matchId, state: afterDraw }),
  )
})

test('dungeon runner subphases are distinct tokens for the same turn number', () => {
  const matchId = 'match-1'
  const base = {
    turn: { turnNumber: 4, activeSeatId: 'seat-2' },
    phase: MATCH_PHASES.DUNGEON,
    rng: { seed: 1, state: 2, step: 10 },
  }
  const vorpal = { ...base, dungeon: { subphase: DUNGEON_SUBPHASES.VORPAL, remainingMonsters: [] } }
  const reveal = { ...base, dungeon: { subphase: DUNGEON_SUBPHASES.REVEAL, remainingMonsters: [] } }

  assert.notEqual(
    buildAiTurnRunToken({ matchId, state: vorpal }),
    buildAiTurnRunToken({ matchId, state: reveal }),
  )
})

test('dungeon reveal loop steps differ while subphase stays reveal', () => {
  const matchId = 'match-1'
  const afterReveal = {
    turn: { turnNumber: 17, activeSeatId: 'seat-4' },
    phase: MATCH_PHASES.DUNGEON,
    rng: { seed: 9, state: 100, step: 42 },
    dungeon: {
      subphase: DUNGEON_SUBPHASES.REVEAL,
      currentMonster: 'goblin',
      remainingMonsters: ['orc', 'troll'],
    },
  }
  const afterCombat = {
    ...afterReveal,
    rng: { seed: 9, state: 101, step: 43 },
    dungeon: {
      subphase: DUNGEON_SUBPHASES.REVEAL,
      currentMonster: null,
      remainingMonsters: ['orc', 'troll'],
    },
  }

  assert.notEqual(
    buildAiTurnRunToken({ matchId, state: afterReveal }),
    buildAiTurnRunToken({ matchId, state: afterCombat }),
  )
})

test('identical decision points produce identical tokens', () => {
  const matchId = 'match-1'
  const state = {
    turn: { turnNumber: 2, activeSeatId: 'seat-1' },
    phase: MATCH_PHASES.BIDDING,
    bidding: { subphase: BIDDING_SUBPHASES.TURN, revealedMonsterCard: null },
  }

  assert.equal(
    buildAiTurnRunToken({ matchId, state }),
    buildAiTurnRunToken({ matchId, state: { ...state, rng: { seed: 99 } } }),
  )
})
