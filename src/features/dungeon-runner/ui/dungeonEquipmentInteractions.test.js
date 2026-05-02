import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDungeonEquipmentTokenView,
  createDungeonEquipmentModalView,
  createVorpalDeclarationPromptView,
  pickAutoResolveDungeonAction,
} from './dungeonEquipmentInteractions.js'

test('token view marks only contextually usable equipment as glowing', () => {
  const tokenView = buildDungeonEquipmentTokenView({
    inPlayEquipmentIds: ['B_AXE', 'M_POLY', 'W_SHIELD'],
    legalActions: [{ type: 'USE_FIRE_AXE' }, { type: 'DECLINE_FIRE_AXE' }],
  })

  const fireAxe = tokenView.find((token) => token.equipmentId === 'B_AXE')
  const polymorph = tokenView.find((token) => token.equipmentId === 'M_POLY')
  const shield = tokenView.find((token) => token.equipmentId === 'W_SHIELD')
  assert.equal(fireAxe.canUseNow, true)
  assert.equal(fireAxe.glow, true)
  assert.equal(polymorph.canUseNow, false)
  assert.equal(polymorph.glow, false)
  assert.equal(shield.canUseNow, false)
  assert.equal(shield.glow, false)
})

test('token memory aids are gated to legal equipment timing windows', () => {
  const gatedOff = buildDungeonEquipmentTokenView({
    inPlayEquipmentIds: ['B_AXE', 'M_POLY'],
    legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
  })
  assert.equal(gatedOff.every((token) => token.hasModal === false), true)

  const gatedOn = buildDungeonEquipmentTokenView({
    inPlayEquipmentIds: ['B_AXE', 'M_POLY'],
    legalActions: [{ type: 'USE_FIRE_AXE' }, { type: 'DECLINE_FIRE_AXE' }],
  })
  const fireAxe = gatedOn.find((token) => token.equipmentId === 'B_AXE')
  const polymorph = gatedOn.find((token) => token.equipmentId === 'M_POLY')
  assert.equal(fireAxe?.hasModal, true)
  assert.equal(polymorph?.hasModal, false)
})

test('modal exposes USE only when legal and continue maps to implicit decline', () => {
  const fireAxeModal = createDungeonEquipmentModalView({
    equipmentId: 'B_AXE',
    legalActions: [{ type: 'USE_FIRE_AXE' }, { type: 'DECLINE_FIRE_AXE' }],
  })
  assert.equal(fireAxeModal.showUseButton, true)
  assert.deepEqual(fireAxeModal.useAction, { type: 'USE_FIRE_AXE' })
  assert.deepEqual(fireAxeModal.continueAction, { type: 'DECLINE_FIRE_AXE' })
  assert.equal(fireAxeModal.confirmUseMessage.length > 0, true)

  const blockedPolymorphModal = createDungeonEquipmentModalView({
    equipmentId: 'M_POLY',
    legalActions: [{ type: 'USE_FIRE_AXE' }, { type: 'DECLINE_FIRE_AXE' }],
  })
  assert.equal(blockedPolymorphModal.showUseButton, false)
  assert.equal(blockedPolymorphModal.useAction, null)
  assert.equal(blockedPolymorphModal.continueAction, null)
})

test('auto-resolve picks reveal/continue when no equipment choice point exists', () => {
  const revealAction = pickAutoResolveDungeonAction({
    legalActions: [{ type: 'REVEAL_OR_CONTINUE' }],
  })
  assert.deepEqual(revealAction, { type: 'REVEAL_OR_CONTINUE' })

  const pauseForChoice = pickAutoResolveDungeonAction({
    legalActions: [{ type: 'USE_FIRE_AXE' }, { type: 'DECLINE_FIRE_AXE' }],
  })
  assert.equal(pauseForChoice, null)
})

test('vorpal prompt view opens only at dungeon-start declaration timing', () => {
  const prompt = createVorpalDeclarationPromptView({
    isHumanTurn: true,
    gameplayInputLocked: false,
    phase: 'dungeon',
    subphase: 'vorpal',
    legalActions: [{ type: 'DECLARE_VORPAL', species: 'goblin' }],
  })
  assert.equal(prompt.open, true)

  const closed = createVorpalDeclarationPromptView({
    isHumanTurn: true,
    gameplayInputLocked: false,
    phase: 'dungeon',
    subphase: 'reveal',
    legalActions: [{ type: 'DECLARE_VORPAL', species: 'goblin' }],
  })
  assert.equal(closed.open, false)
})

test('vorpal prompt species options come from legal actions only', () => {
  const prompt = createVorpalDeclarationPromptView({
    isHumanTurn: true,
    gameplayInputLocked: false,
    phase: 'dungeon',
    subphase: 'vorpal',
    legalActions: [
      { type: 'DECLARE_VORPAL', species: 'goblin' },
      { type: 'DECLARE_VORPAL', species: 'dragon' },
    ],
    dungeon: {
      remainingMonsters: ['lich', 'demon'],
    },
  })

  assert.deepEqual(prompt.speciesOptions, ['goblin', 'dragon'])
})
