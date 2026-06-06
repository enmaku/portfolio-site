import assert from 'node:assert/strict'
import test from 'node:test'
import {
  annotateVorpalPickerHandCards,
  applyVorpalPickerSpeciesTap,
  createVorpalDeclarationPickerView,
} from './vorpalDeclarationPickerInteractions.js'

const POLICY_ORDER_LEGAL = [
  { type: 'DECLARE_VORPAL', species: 'goblin' },
  { type: 'DECLARE_VORPAL', species: 'skeleton' },
  { type: 'DECLARE_VORPAL', species: 'dragon' },
]

const OPEN_INPUT = {
  isHumanTurn: true,
  gameplayInputLocked: false,
  phase: 'dungeon',
  subphase: 'vorpal',
  legalActions: POLICY_ORDER_LEGAL,
}

test('picker open inherits prompt timing at dungeon vorpal subphase', () => {
  const open = createVorpalDeclarationPickerView(OPEN_INPUT)
  assert.equal(open.open, true)

  const closed = createVorpalDeclarationPickerView({
    ...OPEN_INPUT,
    subphase: 'reveal',
  })
  assert.equal(closed.open, false)
})

test('picker open is false when gameplay input is locked', () => {
  const locked = createVorpalDeclarationPickerView({
    ...OPEN_INPUT,
    gameplayInputLocked: true,
  })
  assert.equal(locked.open, false)
})

test('picker cards follow legal DECLARE_VORPAL species order', () => {
  const view = createVorpalDeclarationPickerView(OPEN_INPUT)
  assert.deepEqual(
    view.cards.map((card) => card.species),
    ['goblin', 'skeleton', 'dragon'],
  )
})

test('picker card selected flag tracks selectedSpecies', () => {
  const view = createVorpalDeclarationPickerView({
    ...OPEN_INPUT,
    selectedSpecies: 'skeleton',
  })
  assert.deepEqual(
    view.cards.map((card) => card.selected),
    [false, true, false],
  )
})

test('picker cards are not selectable when human gameplay is blocked', () => {
  const view = createVorpalDeclarationPickerView({
    ...OPEN_INPUT,
    humanGameplayBlocked: true,
  })
  assert.ok(view.cards.every((card) => card.selectable === false))
})

test('applyVorpalPickerSpeciesTap sets species on first tap', () => {
  assert.equal(
    applyVorpalPickerSpeciesTap({
      selectedSpecies: null,
      tappedSpecies: 'orc',
      humanGameplayBlocked: false,
    }),
    'orc',
  )
})

test('applyVorpalPickerSpeciesTap is no-op when re-tapping selected species', () => {
  assert.equal(
    applyVorpalPickerSpeciesTap({
      selectedSpecies: 'orc',
      tappedSpecies: 'orc',
      humanGameplayBlocked: false,
    }),
    'orc',
  )
})

test('applyVorpalPickerSpeciesTap is no-op when human gameplay is blocked', () => {
  assert.equal(
    applyVorpalPickerSpeciesTap({
      selectedSpecies: null,
      tappedSpecies: 'orc',
      humanGameplayBlocked: true,
    }),
    null,
  )
})

test('confirmEnabled is false without selection or when gameplay blocked', () => {
  const noSelection = createVorpalDeclarationPickerView(OPEN_INPUT)
  assert.equal(noSelection.confirmEnabled, false)

  const blocked = createVorpalDeclarationPickerView({
    ...OPEN_INPUT,
    selectedSpecies: 'goblin',
    humanGameplayBlocked: true,
  })
  assert.equal(blocked.confirmEnabled, false)
})

test('confirmEnabled and confirmAction when selection is present', () => {
  const view = createVorpalDeclarationPickerView({
    ...OPEN_INPUT,
    selectedSpecies: 'dragon',
  })
  assert.equal(view.confirmEnabled, true)
  assert.deepEqual(view.confirmAction, { type: 'DECLARE_VORPAL', species: 'dragon' })
})

test('memoryAidCaption appears only when memory aid is on and count is greater than zero', () => {
  const view = createVorpalDeclarationPickerView({
    ...OPEN_INPUT,
    memoryAidEnabled: true,
    viewerOwnPileAdds: ['goblin', 'goblin', 'skeleton'],
  })
  const goblin = view.cards.find((card) => card.species === 'goblin')
  const skeleton = view.cards.find((card) => card.species === 'skeleton')
  const dragon = view.cards.find((card) => card.species === 'dragon')
  assert.equal(goblin.memoryAidCaption, '2')
  assert.equal(skeleton.memoryAidCaption, '1')
  assert.equal(dragon.memoryAidCaption, null)
})

test('memoryAidCaption is omitted when memory aid is disabled', () => {
  const view = createVorpalDeclarationPickerView({
    ...OPEN_INPUT,
    memoryAidEnabled: false,
    viewerOwnPileAdds: ['goblin', 'goblin'],
  })
  assert.ok(view.cards.every((card) => card.memoryAidCaption === null))
})

test('hand cards stay continuous splay when no species is selected', () => {
  const cards = [
    { species: 'goblin', selected: false, selectable: true, memoryAidCaption: null },
    { species: 'dragon', selected: false, selectable: true, memoryAidCaption: null },
  ]
  assert.deepEqual(
    annotateVorpalPickerHandCards(cards, null).map((card) => card.layoutRole),
    ['splay', 'splay'],
  )
})

test('hand cards keep policy order with one break below the selected species', () => {
  const cards = [
    { species: 'goblin', selected: false, selectable: true, memoryAidCaption: null },
    { species: 'skeleton', selected: true, selectable: true, memoryAidCaption: null },
    { species: 'dragon', selected: false, selectable: true, memoryAidCaption: null },
  ]
  assert.deepEqual(
    annotateVorpalPickerHandCards(cards, 'skeleton').map((card) => card.layoutRole),
    ['above', 'selected', 'below-break'],
  )
})

test('picker exposes continuous hand cards when a species is selected', () => {
  const view = createVorpalDeclarationPickerView({
    ...OPEN_INPUT,
    selectedSpecies: 'skeleton',
  })
  assert.equal(view.handCards.length, 3)
  assert.deepEqual(
    view.handCards.map((card) => card.layoutRole),
    ['above', 'selected', 'below-break'],
  )
  assert.equal(view.handCards[1].species, 'skeleton')
})
