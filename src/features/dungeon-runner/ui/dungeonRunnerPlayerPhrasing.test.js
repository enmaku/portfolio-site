import assert from 'node:assert/strict'
import test from 'node:test'
import {
  historyHeadlineForHistoryEntry,
  legalActionBoardLabel,
  matchPhaseBoardLabel,
} from './dungeonRunnerPlayerPhrasing.js'

test('matchPhaseBoardLabel maps engine phases to player-facing names', () => {
  assert.equal(matchPhaseBoardLabel('bidding'), 'Bidding')
  assert.equal(matchPhaseBoardLabel('dungeon'), 'Dungeon')
  assert.equal(matchPhaseBoardLabel('pick-adventurer'), 'Choose adventurer')
  assert.equal(matchPhaseBoardLabel('match-over'), 'Match over')
  assert.equal(matchPhaseBoardLabel('unknown-phase'), 'unknown-phase')
})

test('legalActionBoardLabel covers all standard engine action types', () => {
  assert.equal(legalActionBoardLabel({ type: 'PASS' }), 'Pass')
  assert.equal(legalActionBoardLabel({ type: 'DRAW' }), 'Draw from deck')
  assert.equal(legalActionBoardLabel({ type: 'ADD_TO_DUNGEON' }), 'Add card to dungeon')
  assert.equal(legalActionBoardLabel({ type: 'SACRIFICE', equipmentId: 'W_SHIELD' }), 'Sacrifice Shield')
  assert.equal(legalActionBoardLabel({ type: 'DECLARE_VORPAL', species: 'goblin' }), 'Declare goblin')
  assert.equal(legalActionBoardLabel({ type: 'CHOOSE_NEXT_ADVENTURER', hero: 'MAGE' }), 'Play as Mage')
  assert.equal(legalActionBoardLabel({ type: 'REVEAL_OR_CONTINUE' }), 'Reveal / continue')
  assert.equal(legalActionBoardLabel({ type: 'USE_FIRE_AXE' }), 'Use Fire Axe')
  assert.equal(legalActionBoardLabel({ type: 'DECLINE_FIRE_AXE' }), 'Continue (skip Fire Axe)')
  assert.equal(legalActionBoardLabel({ type: 'USE_POLYMORPH' }), 'Use Polymorph')
  assert.equal(legalActionBoardLabel({ type: 'DECLINE_POLYMORPH' }), 'Continue (skip Polymorph)')
  assert.equal(legalActionBoardLabel({ type: 'ADVANCE_DUNGEON' }), 'Run dungeon')
  assert.equal(legalActionBoardLabel({ type: 'WEIRD' }), 'WEIRD')
})

test('historyHeadlineForHistoryEntry uses board-aligned wording and dungeon run results', () => {
  assert.equal(
    historyHeadlineForHistoryEntry('Alice', {
      action: { type: 'DRAW' },
      dungeonRunResult: null,
    }),
    'Alice drew from the deck.',
  )
  assert.equal(
    historyHeadlineForHistoryEntry('Player', {
      action: { type: 'PASS' },
      dungeonRunResult: null,
    }),
    'Player passed.',
  )
  assert.equal(
    historyHeadlineForHistoryEntry('Bob', {
      action: { type: 'ADD_TO_DUNGEON' },
      dungeonRunResult: null,
    }),
    'Bob added a card to the dungeon.',
  )
  assert.equal(
    historyHeadlineForHistoryEntry('Player', {
      action: { type: 'CHOOSE_NEXT_ADVENTURER', hero: 'ROGUE' },
      dungeonRunResult: null,
    }),
    'Player chose to play as Rogue.',
  )
  assert.equal(
    historyHeadlineForHistoryEntry('Player', {
      action: { type: 'USE_FIRE_AXE' },
      dungeonRunResult: null,
    }),
    'Player used Fire Axe.',
  )
  assert.equal(
    historyHeadlineForHistoryEntry('Player', {
      action: { type: 'DECLINE_FIRE_AXE' },
      dungeonRunResult: null,
    }),
    'Player continued without using Fire Axe.',
  )
  assert.equal(
    historyHeadlineForHistoryEntry('Player', {
      action: { type: 'REVEAL_OR_CONTINUE' },
      dungeonRunResult: null,
    }),
    'Player revealed / continued.',
  )
  assert.equal(
    historyHeadlineForHistoryEntry('Player', {
      action: { type: 'DECLARE_VORPAL', species: 'dragon' },
      dungeonRunResult: null,
    }),
    'Player declared dragon.',
  )
  assert.equal(
    historyHeadlineForHistoryEntry('Player', {
      action: { type: 'ADVANCE_DUNGEON' },
      dungeonRunResult: 'success',
    }),
    'Player resolved the dungeon run (success).',
  )
})
