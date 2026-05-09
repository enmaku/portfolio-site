import assert from 'node:assert/strict'
import test from 'node:test'
import { createBiddingBoardViewModel } from './biddingBoardViewModel.js'

test('board view model prioritizes primary reveal card and compact secondary state', () => {
  const model = createBiddingBoardViewModel({
    state: {
      seats: [
        { id: 'seat-1', label: 'You', role: { type: 'human' } },
        { id: 'seat-2', label: 'Rival A', role: { type: 'randombot' } },
      ],
      turn: { activeSeatId: 'seat-2' },
      centerEquipment: ['W_PLATE', 'W_SHIELD'],
      bidding: {
        monsterDeck: ['dragon', 'goblin', 'orc'],
        dungeonMonsters: ['skeleton', 'orc'],
        passedSeatIds: ['seat-1'],
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
  assert.equal(model.secondary.activeSeatLabel, 'Rival A')
  assert.equal(model.secondary.seats[0].passed, true)
  assert.equal(model.secondary.seats[1].passed, false)
  assert.equal(model.secondary.seats[1].isActive, true)
})

test('pending bidding card shows hidden back to non-drawer using engine state', () => {
  const model = createBiddingBoardViewModel({
    state: {
      turn: { activeSeatId: 'seat-2' },
      centerEquipment: [],
      bidding: {
        subphase: 'pending',
        revealedMonsterCard: 'dragon',
        revealedBySeatId: 'seat-2',
        monsterDeck: [],
        dungeonMonsters: [],
      },
    },
    visibleState: { bidding: { revealedMonsterCard: null } },
    activeAnimation: null,
    viewerSeatId: 'seat-1',
  })
  assert.equal(model.primaryCard.variant, 'hidden')
  assert.equal(model.primaryCard.monsterCard, null)
})

test('idle bidding slot uses empty variant instead of a hidden card back', () => {
  const model = createBiddingBoardViewModel({
    state: {
      turn: { activeSeatId: 'seat-1' },
      centerEquipment: [],
      bidding: {
        monsterDeck: ['goblin'],
        dungeonMonsters: [],
      },
    },
    visibleState: { bidding: { revealedMonsterCard: null } },
    activeAnimation: null,
  })
  assert.equal(model.primaryCard.variant, 'empty')
})

test('active bidding card beat uses hidden variant when no card is revealed to viewer', () => {
  for (const kind of ['BIDDING_DRAW', 'BIDDING_ADD', 'BIDDING_SACRIFICE']) {
    const model = createBiddingBoardViewModel({
      state: {
        turn: { activeSeatId: 'seat-1' },
        centerEquipment: [],
        bidding: { monsterDeck: [], dungeonMonsters: [] },
      },
      visibleState: { bidding: { revealedMonsterCard: null } },
      activeAnimation: { kind, payload: {} },
    })
    assert.equal(model.primaryCard.variant, 'hidden', kind)
  }
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

  assert.equal(model.primaryCard.variant, 'empty')
  assert.equal(model.primaryCard.monsterCard, null)
})

test('board view model darkens consumed equipment from active bidding animation', () => {
  const model = createBiddingBoardViewModel({
    state: {
      turn: { activeSeatId: 'seat-2' },
      centerEquipment: ['W_PLATE', 'W_SHIELD'],
      bidding: {
        monsterDeck: ['goblin', 'orc'],
        dungeonMonsters: ['skeleton'],
        equipmentDisplayOrder: ['W_PLATE', 'W_SHIELD'],
      },
    },
    visibleState: { bidding: { revealedMonsterCard: null } },
    activeAnimation: {
      kind: 'BIDDING_SACRIFICE',
      payload: {
        consumedEquipmentIds: ['W_SHIELD'],
      },
    },
  })

  assert.equal(model.secondary.equipment[1].consumed, true)
  assert.equal(model.secondary.equipment[1].removed, false)
})

test('board view model darkens expended equipment from active dungeon neutralize animation', () => {
  const model = createBiddingBoardViewModel({
    state: {
      turn: { activeSeatId: 'seat-1' },
      centerEquipment: ['W_VORPAL', 'W_TORCH'],
      bidding: {
        monsterDeck: [],
        dungeonMonsters: ['dragon'],
        equipmentDisplayOrder: ['W_VORPAL', 'W_TORCH'],
      },
    },
    visibleState: { bidding: { revealedMonsterCard: null } },
    activeAnimation: {
      kind: 'DUNGEON_NEUTRALIZE',
      payload: {
        responsibleEquipmentIds: ['W_VORPAL'],
        expendedEquipmentIds: ['W_VORPAL'],
      },
    },
  })

  assert.equal(model.secondary.equipment[0].consumed, true)
  assert.equal(model.secondary.equipment[1].consumed, false)
})

test('board shows eliminated monster to drawer during bidding sacrifice beat', () => {
  const model = createBiddingBoardViewModel({
    state: {
      turn: { activeSeatId: 'seat-2' },
      centerEquipment: ['W_PLATE'],
      bidding: {
        monsterDeck: [],
        dungeonMonsters: [],
      },
    },
    visibleState: { bidding: { revealedMonsterCard: null } },
    activeAnimation: {
      kind: 'BIDDING_SACRIFICE',
      payload: {
        eliminatedMonsterCard: 'dragon',
        revealedToSeatId: 'seat-1',
        consumedEquipmentIds: ['W_SHIELD'],
      },
    },
    viewerSeatId: 'seat-1',
  })

  assert.equal(model.primaryCard.variant, 'revealed')
  assert.equal(model.primaryCard.monsterCard, 'dragon')
})

test('board hides eliminated monster species from non-drawer during bidding sacrifice beat', () => {
  const model = createBiddingBoardViewModel({
    state: {
      turn: { activeSeatId: 'seat-2' },
      centerEquipment: ['W_PLATE'],
      bidding: {
        monsterDeck: [],
        dungeonMonsters: [],
      },
    },
    visibleState: { bidding: { revealedMonsterCard: null } },
    activeAnimation: {
      kind: 'BIDDING_SACRIFICE',
      payload: {
        eliminatedMonsterCard: 'dragon',
        revealedToSeatId: 'seat-1',
        consumedEquipmentIds: ['W_SHIELD'],
      },
    },
    viewerSeatId: 'seat-2',
  })

  assert.equal(model.primaryCard.variant, 'hidden')
  assert.equal(model.primaryCard.monsterCard, null)
})

test('board view model keeps removed center equipment in display order as spent tiles', () => {
  const model = createBiddingBoardViewModel({
    state: {
      turn: { activeSeatId: 'seat-1' },
      centerEquipment: ['W_PLATE'],
      bidding: {
        monsterDeck: [],
        dungeonMonsters: [],
        equipmentDisplayOrder: ['W_PLATE', 'W_SHIELD'],
      },
    },
    visibleState: { bidding: { revealedMonsterCard: null } },
    activeAnimation: null,
  })

  assert.equal(model.secondary.equipment.length, 2)
  assert.equal(model.secondary.equipment[0].removed, false)
  assert.equal(model.secondary.equipment[1].removed, true)
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
  assert.equal(model.heroCue.badgeGlyph, 'M')
  assert.equal(model.heroCue.shortLabel, 'Mage')
  assert.equal(model.heroCue.buttonColor, 'deep-purple')
})

test('board view model warrior cue unifies button and badge colors', () => {
  const model = createBiddingBoardViewModel({
    state: {
      hero: 'WARRIOR',
      turn: { activeSeatId: 'seat-1' },
      centerEquipment: [],
      bidding: { monsterDeck: [], dungeonMonsters: [] },
    },
    visibleState: { bidding: { revealedMonsterCard: null } },
    activeAnimation: null,
  })
  assert.equal(model.heroCue.badgeColor, 'indigo')
  assert.equal(model.heroCue.buttonColor, 'indigo')
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
  assert.deepEqual(model.memoryAid.deckSplayCards[0], { visibility: 'face', species: 'goblin' })
  assert.deepEqual(model.memoryAid.deckSplayCards[1], { visibility: 'face', species: 'orc' })
  assert.deepEqual(model.memoryAid.deckSplayCards[2], { visibility: 'back', species: null })
})

test('memory aid deck splay keeps slots face-down when viewer has no personal pile adds', () => {
  const model = createBiddingBoardViewModel({
    state: {
      bidding: {
        monsterDeck: ['lich', 'demon'],
        dungeonMonsters: [],
      },
    },
    visibleState: {
      playerOwnPileAdds: { 'seat-1': [] },
    },
    activeAnimation: null,
    viewerSeatId: 'seat-1',
    settings: { memoryAidEnabled: true },
  })

  assert.equal(model.memoryAid.knownDeckCountHint, 0)
  assert.deepEqual(model.memoryAid.deckSplayCards, [
    { visibility: 'back', species: null },
    { visibility: 'back', species: null },
  ])
})

test('memory aid deck splay face-up depth caps at remaining deck size', () => {
  const model = createBiddingBoardViewModel({
    state: {
      bidding: {
        monsterDeck: ['orc', 'vampire'],
        dungeonMonsters: [],
      },
    },
    visibleState: {
      playerOwnPileAdds: { 'seat-1': ['goblin', 'skeleton', 'orc', 'dragon'] },
    },
    activeAnimation: null,
    viewerSeatId: 'seat-1',
    settings: { memoryAidEnabled: true },
  })

  assert.equal(model.memoryAid.deckSplayCards.length, 2)
  assert.deepEqual(model.memoryAid.deckSplayCards[0], { visibility: 'face', species: 'orc' })
  assert.deepEqual(model.memoryAid.deckSplayCards[1], { visibility: 'face', species: 'vampire' })
})
