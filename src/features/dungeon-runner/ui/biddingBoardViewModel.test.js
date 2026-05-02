import assert from 'node:assert/strict'
import test from 'node:test'
import { createBiddingBoardViewModel } from './biddingBoardViewModel.js'

test('board view model prioritizes primary reveal card and compact secondary state', () => {
  const model = createBiddingBoardViewModel({
    state: {
      turn: { activeSeatId: 'seat-2' },
      centerEquipment: ['W_PLATE', 'W_SHIELD'],
      bidding: {
        monsterDeck: ['dragon', 'goblin', 'orc'],
        dungeonMonsters: ['skeleton', 'orc'],
      },
    },
    visibleState: {
      bidding: {
        revealedMonsterCard: 'dragon',
      },
    },
    activeAnimation: null,
  })

  assert.equal(model.primaryCard.variant, 'revealed')
  assert.equal(model.primaryCard.monsterCard, 'dragon')
  assert.equal(model.secondary.deckCount, 3)
  assert.equal(model.secondary.dungeonCount, 2)
  assert.equal(model.secondary.activeSeatId, 'seat-2')
})

test('board view model preserves hidden information for unrevealed card', () => {
  const model = createBiddingBoardViewModel({
    state: {
      turn: { activeSeatId: 'seat-2' },
      centerEquipment: ['W_PLATE', 'W_SHIELD'],
      bidding: {
        revealedMonsterCard: 'dragon',
        monsterDeck: ['goblin', 'orc'],
        dungeonMonsters: [],
      },
    },
    visibleState: {
      bidding: {
        revealedMonsterCard: null,
      },
    },
    activeAnimation: null,
  })

  assert.equal(model.primaryCard.variant, 'hidden')
  assert.equal(model.primaryCard.monsterCard, null)
})

test('board view model darkens consumed equipment from active bot animation', () => {
  const model = createBiddingBoardViewModel({
    state: {
      turn: { activeSeatId: 'seat-2' },
      centerEquipment: ['W_PLATE', 'W_SHIELD'],
      bidding: {
        monsterDeck: ['goblin', 'orc'],
        dungeonMonsters: ['skeleton'],
      },
    },
    visibleState: { bidding: { revealedMonsterCard: null } },
    activeAnimation: {
      kind: 'BOT_BIDDING_SACRIFICE',
      payload: {
        consumedEquipmentIds: ['W_SHIELD'],
      },
    },
  })

  assert.equal(model.secondary.equipment[1].consumed, true)
})

test('board view model exposes hero color cue tokens for in-match theming', () => {
  const model = createBiddingBoardViewModel({
    state: {
      hero: 'MAGE',
      turn: { activeSeatId: 'seat-1' },
      centerEquipment: [],
      bidding: {
        monsterDeck: [],
        dungeonMonsters: [],
      },
    },
    visibleState: { bidding: { revealedMonsterCard: null } },
    activeAnimation: null,
  })

  assert.equal(model.heroCue.hero, 'MAGE')
  assert.equal(model.heroCue.accentClass, 'dr-hero--mage')
  assert.equal(model.heroCue.badgeColor, 'deep-purple')
})

test('memory aid defaults off and keeps deck interaction disabled', () => {
  const model = createBiddingBoardViewModel({
    state: {
      bidding: {
        monsterDeck: ['goblin', 'orc'],
        dungeonMonsters: [],
      },
    },
    visibleState: {
      playerOwnPileAdds: {
        'seat-1': ['goblin'],
      },
    },
    activeAnimation: null,
    viewerSeatId: 'seat-1',
    settings: {},
  })

  assert.equal(model.memoryAid.enabled, false)
  assert.equal(model.memoryAid.deckTapEnabled, false)
  assert.equal(model.memoryAid.knownDeckCountHint, null)
  assert.equal(model.memoryAid.deckSplayCards.length, 0)
})

test('memory aid on enables deck interactions and personal known-count hint only for viewer', () => {
  const model = createBiddingBoardViewModel({
    state: {
      bidding: {
        monsterDeck: ['goblin', 'orc', 'dragon'],
        dungeonMonsters: [],
      },
    },
    visibleState: {
      playerOwnPileAdds: {
        'seat-1': ['goblin', 'skeleton'],
        'seat-2': ['dragon', 'orc', 'vampire'],
      },
    },
    activeAnimation: null,
    viewerSeatId: 'seat-1',
    settings: { memoryAidEnabled: true },
  })

  assert.equal(model.memoryAid.enabled, true)
  assert.equal(model.memoryAid.deckTapEnabled, true)
  assert.equal(model.memoryAid.knownDeckCountHint, 2)
  assert.equal(model.memoryAid.deckSplayCards.length, 3)
})
