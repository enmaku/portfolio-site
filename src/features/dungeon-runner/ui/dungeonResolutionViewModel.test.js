import assert from 'node:assert/strict'
import test from 'node:test'
import { createDungeonResolutionViewModel } from './dungeonResolutionViewModel.js'

test('shows face-down monster while reveal animation is active', () => {
  const model = createDungeonResolutionViewModel({
    visibleState: {
      dungeon: {
        currentMonster: 'goblin',
        hp: 8,
        inPlayEquipmentIds: ['B_AXE', 'M_POLY'],
      },
    },
    legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
    activeAnimation: { kind: 'DUNGEON_REVEAL' },
  })

  assert.equal(model.monster.visibility, 'face-down')
  assert.equal(model.monster.species, null)
  assert.equal(model.monster.frontFaceSpecies, 'goblin')
  assert.equal(model.resolutionStatus, 'revealing')
})

test('frontFaceSpecies matches species while monster is revealed', () => {
  const model = createDungeonResolutionViewModel({
    visibleState: {
      dungeon: {
        currentMonster: 'orc',
        hp: 8,
        inPlayEquipmentIds: [],
      },
    },
    legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
    activeAnimation: null,
  })

  assert.equal(model.monster.visibility, 'revealed')
  assert.equal(model.monster.species, 'orc')
  assert.equal(model.monster.frontFaceSpecies, 'orc')
})

test('shows empty staging slot when no current monster (between encounters)', () => {
  const model = createDungeonResolutionViewModel({
    visibleState: {
      dungeon: {
        currentMonster: null,
        hp: 8,
        inPlayEquipmentIds: [],
        subphase: 'reveal',
      },
    },
    legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
    activeAnimation: null,
  })

  assert.equal(model.monster.visibility, 'empty')
  assert.equal(model.monster.species, null)
  assert.equal(model.monster.frontFaceSpecies, null)
})

test('marks waiting-for-choice and highlights fire axe on fire-axe fork', () => {
  const model = createDungeonResolutionViewModel({
    visibleState: {
      dungeon: {
        currentMonster: 'orc',
        hp: 7,
        inPlayEquipmentIds: ['B_AXE', 'M_POLY', 'W_SHIELD'],
      },
    },
    legalActions: [{ type: 'USE_FIRE_AXE' }, { type: 'DECLINE_FIRE_AXE' }],
    activeAnimation: null,
  })

  assert.equal(model.resolutionStatus, 'waiting-for-choice')
  assert.deepEqual(model.highlightedEquipmentIds, ['B_AXE'])
  assert.equal(model.autoAdvanceAction, null)
})

test('marks waiting-for-choice and highlights polymorph on polymorph fork', () => {
  const model = createDungeonResolutionViewModel({
    visibleState: {
      dungeon: {
        currentMonster: 'golem',
        hp: 5,
        inPlayEquipmentIds: ['M_POLY', 'B_AXE'],
      },
    },
    legalActions: [{ type: 'USE_POLYMORPH' }, { type: 'DECLINE_POLYMORPH' }],
    activeAnimation: null,
  })

  assert.equal(model.resolutionStatus, 'waiting-for-choice')
  assert.deepEqual(model.highlightedEquipmentIds, ['M_POLY'])
  assert.equal(model.autoAdvanceAction, null)
})

test('marks waiting-for-choice on vorpal declaration options without equipment glow', () => {
  const model = createDungeonResolutionViewModel({
    visibleState: {
      dungeon: {
        currentMonster: null,
        hp: 7,
        inPlayEquipmentIds: ['W_VORPAL'],
      },
    },
    legalActions: [
      { type: 'DECLARE_VORPAL', species: 'goblin' },
      { type: 'DECLARE_VORPAL', species: 'dragon' },
    ],
    activeAnimation: null,
  })

  assert.equal(model.resolutionStatus, 'waiting-for-choice')
  assert.deepEqual(model.highlightedEquipmentIds, [])
  assert.equal(model.autoAdvanceAction, null)
})

test('marks waiting-for-choice for non-token non-deterministic legal actions', () => {
  const model = createDungeonResolutionViewModel({
    visibleState: {
      dungeon: {
        currentMonster: null,
        hp: 6,
        inPlayEquipmentIds: ['W_TORCH'],
      },
    },
    legalActions: [{ type: 'CHOOSE_LEFT' }, { type: 'CHOOSE_RIGHT' }],
    activeAnimation: null,
  })

  assert.equal(model.resolutionStatus, 'waiting-for-choice')
  assert.deepEqual(model.highlightedEquipmentIds, [])
  assert.equal(model.autoAdvanceAction, null)
})

test('marks auto-resolved when reveal/continue is deterministic', () => {
  const model = createDungeonResolutionViewModel({
    visibleState: {
      dungeon: {
        currentMonster: null,
        hp: 7,
        inPlayEquipmentIds: ['B_AXE'],
      },
    },
    legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
    activeAnimation: null,
  })

  assert.equal(model.resolutionStatus, 'auto-resolved')
  assert.deepEqual(model.autoAdvanceAction, { type: 'REVEAL_OR_CONTINUE' })
  assert.deepEqual(model.highlightedEquipmentIds, [])
})

test('derives damage chip from hp delta and damage animation', () => {
  const model = createDungeonResolutionViewModel({
    visibleState: {
      dungeon: {
        currentMonster: null,
        hp: 3,
        inPlayEquipmentIds: ['B_AXE'],
      },
    },
    previousVisibleState: {
      dungeon: {
        hp: 7,
      },
    },
    legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
    activeAnimation: { kind: 'DUNGEON_DAMAGE' },
  })

  assert.equal(model.resolutionStatus, 'damage-taken')
  assert.deepEqual(model.hpDelta, {
    value: -4,
    tone: 'damage',
    text: '-4 HP',
  })
})

test('keeps previous monster visible during damage animation after resolution step', () => {
  const model = createDungeonResolutionViewModel({
    visibleState: {
      dungeon: {
        currentMonster: null,
        hp: 3,
        inPlayEquipmentIds: [],
      },
    },
    previousVisibleState: {
      dungeon: {
        currentMonster: 'dragon',
        hp: 6,
      },
    },
    legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
    activeAnimation: { kind: 'DUNGEON_DAMAGE' },
  })

  assert.equal(model.monster.visibility, 'revealed')
  assert.equal(model.monster.species, 'dragon')
  assert.equal(model.monster.frontFaceSpecies, 'dragon')
})

test('reveals species from lane delta when engine cleared currentMonster before and after combat', () => {
  const model = createDungeonResolutionViewModel({
    visibleState: {
      dungeon: {
        currentMonster: null,
        hp: 5,
        remainingMonsters: ['orc', 'vampire', 'golem'],
        inPlayEquipmentIds: [],
      },
    },
    previousVisibleState: {
      dungeon: {
        currentMonster: null,
        hp: 8,
        remainingMonsters: ['goblin', 'orc', 'vampire', 'golem'],
        inPlayEquipmentIds: [],
      },
    },
    legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
    activeAnimation: { kind: 'DUNGEON_DAMAGE' },
  })

  assert.equal(model.monster.visibility, 'revealed')
  assert.equal(model.monster.species, 'goblin')
})

test('does not reveal from stale lane delta when idle between encounters (no dungeon animation)', () => {
  const model = createDungeonResolutionViewModel({
    visibleState: {
      dungeon: {
        currentMonster: null,
        hp: 5,
        remainingMonsters: ['orc', 'vampire', 'golem'],
        inPlayEquipmentIds: [],
      },
    },
    previousVisibleState: {
      dungeon: {
        currentMonster: null,
        hp: 8,
        remainingMonsters: ['goblin', 'orc', 'vampire', 'golem'],
        inPlayEquipmentIds: [],
      },
    },
    legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
    activeAnimation: null,
  })

  assert.equal(model.monster.visibility, 'empty')
  assert.equal(model.monster.species, null)
})

test('keeps final monster visible during neutralize transition before outcome', () => {
  const model = createDungeonResolutionViewModel({
    visibleState: {
      dungeon: {
        currentMonster: null,
        hp: 5,
        inPlayEquipmentIds: [],
      },
    },
    previousVisibleState: {
      dungeon: {
        currentMonster: 'goblin',
        hp: 5,
      },
    },
    legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
    activeAnimation: { kind: 'DUNGEON_NEUTRALIZE' },
  })

  assert.equal(model.monster.visibility, 'revealed')
  assert.equal(model.monster.species, 'goblin')
})

test('keeps final monster visible during continue transition before outcome', () => {
  const model = createDungeonResolutionViewModel({
    visibleState: {
      dungeon: {
        currentMonster: null,
        hp: 5,
        inPlayEquipmentIds: [],
      },
    },
    previousVisibleState: {
      dungeon: {
        currentMonster: 'goblin',
        hp: 5,
      },
    },
    legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
    activeAnimation: { kind: 'DUNGEON_CONTINUE' },
  })

  assert.equal(model.monster.visibility, 'revealed')
  assert.equal(model.monster.species, 'goblin')
})
