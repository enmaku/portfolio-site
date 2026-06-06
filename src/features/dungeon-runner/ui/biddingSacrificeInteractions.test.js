import assert from 'node:assert/strict'
import test from 'node:test'
import { createDungeonEquipmentModalView } from './dungeonEquipmentInteractions.js'
import {
  buildBiddingPostDrawActionPane,
  canEnterBiddingSacrificeMode,
  createBiddingSacrificeEquipmentModalView,
  isBiddingPostDrawContext,
  isSacrificeTargetEquipmentToken,
  legalSacrificeEquipmentIds,
  shouldUseBiddingSacrificeEquipmentModalView,
} from './biddingSacrificeInteractions.js'

const POST_DRAW_LEGAL = [
  { type: 'ADD_TO_DUNGEON' },
  { type: 'SACRIFICE', equipmentId: 'W_SHIELD' },
  { type: 'SACRIFICE', equipmentId: 'B_AXE' },
]

test('legalSacrificeEquipmentIds extracts equipment ids from SACRIFICE actions', () => {
  assert.deepEqual(legalSacrificeEquipmentIds(POST_DRAW_LEGAL), ['W_SHIELD', 'B_AXE'])
})

test('isBiddingPostDrawContext requires bidding phase, revealed card, and legal sacrifices', () => {
  assert.equal(
    isBiddingPostDrawContext({
      phase: 'bidding',
      revealedMonsterCard: 'goblin',
      legalActions: POST_DRAW_LEGAL,
    }),
    true,
  )
  assert.equal(
    isBiddingPostDrawContext({
      phase: 'dungeon',
      revealedMonsterCard: 'goblin',
      legalActions: POST_DRAW_LEGAL,
    }),
    false,
  )
  assert.equal(
    isBiddingPostDrawContext({
      phase: 'bidding',
      revealedMonsterCard: null,
      legalActions: POST_DRAW_LEGAL,
    }),
    false,
  )
  assert.equal(
    isBiddingPostDrawContext({
      phase: 'bidding',
      revealedMonsterCard: 'goblin',
      legalActions: [{ type: 'ADD_TO_DUNGEON' }],
    }),
    false,
  )
})

test('canEnterBiddingSacrificeMode blocks when not human turn or gameplay blocked', () => {
  const base = {
    phase: 'bidding',
    revealedMonsterCard: 'goblin',
    legalActions: POST_DRAW_LEGAL,
  }
  assert.equal(canEnterBiddingSacrificeMode({ ...base, isHumanTurn: true }), true)
  assert.equal(canEnterBiddingSacrificeMode({ ...base, isHumanTurn: false }), false)
  assert.equal(
    canEnterBiddingSacrificeMode({ ...base, isHumanTurn: true, humanGameplayBlocked: true }),
    false,
  )
})

test('buildBiddingPostDrawActionPane idle lists add and enter without SACRIFICE rows', () => {
  const pane = buildBiddingPostDrawActionPane({
    sacrificeModeActive: false,
    phase: 'bidding',
    revealedMonsterCard: 'goblin',
    legalActions: POST_DRAW_LEGAL,
  })
  assert.deepEqual(pane, [
    { kind: 'engine', action: { type: 'ADD_TO_DUNGEON' } },
    { kind: 'enterSacrificeMode' },
  ])
})

test('buildBiddingPostDrawActionPane in mode lists cancel only', () => {
  const pane = buildBiddingPostDrawActionPane({
    sacrificeModeActive: true,
    phase: 'bidding',
    revealedMonsterCard: 'goblin',
    legalActions: POST_DRAW_LEGAL,
  })
  assert.deepEqual(pane, [{ kind: 'cancelSacrificeMode' }])
})

test('buildBiddingPostDrawActionPane single legal target still uses enterSacrificeMode', () => {
  const legal = [{ type: 'ADD_TO_DUNGEON' }, { type: 'SACRIFICE', equipmentId: 'W_SHIELD' }]
  const pane = buildBiddingPostDrawActionPane({
    sacrificeModeActive: false,
    phase: 'bidding',
    revealedMonsterCard: 'goblin',
    legalActions: legal,
  })
  assert.deepEqual(pane, [
    { kind: 'engine', action: { type: 'ADD_TO_DUNGEON' } },
    { kind: 'enterSacrificeMode' },
  ])
})

test('buildBiddingPostDrawActionPane omits enter when gameplay blocked', () => {
  const pane = buildBiddingPostDrawActionPane({
    sacrificeModeActive: false,
    phase: 'bidding',
    revealedMonsterCard: 'goblin',
    legalActions: POST_DRAW_LEGAL,
    humanGameplayBlocked: true,
  })
  assert.deepEqual(pane, [{ kind: 'engine', action: { type: 'ADD_TO_DUNGEON' } }])
})

test('isSacrificeTargetEquipmentToken is true only for legal center equipment in mode', () => {
  const ids = ['W_SHIELD', 'B_AXE']
  assert.equal(
    isSacrificeTargetEquipmentToken({
      sacrificeModeActive: true,
      equipmentId: 'W_SHIELD',
      removed: false,
      legalSacrificeEquipmentIds: ids,
    }),
    true,
  )
  assert.equal(
    isSacrificeTargetEquipmentToken({
      sacrificeModeActive: true,
      equipmentId: 'W_SHIELD',
      removed: true,
      legalSacrificeEquipmentIds: ids,
    }),
    false,
  )
  assert.equal(
    isSacrificeTargetEquipmentToken({
      sacrificeModeActive: false,
      equipmentId: 'W_SHIELD',
      removed: false,
      legalSacrificeEquipmentIds: ids,
    }),
    false,
  )
})

test('createBiddingSacrificeEquipmentModalView exposes sacrifice action for legal tiles in mode', () => {
  const modal = createBiddingSacrificeEquipmentModalView({
    equipmentId: 'W_SHIELD',
    legalActions: POST_DRAW_LEGAL,
    sacrificeModeActive: true,
  })
  assert.equal(modal.showSacrificeButton, true)
  assert.deepEqual(modal.sacrificeAction, { type: 'SACRIFICE', equipmentId: 'W_SHIELD' })
  assert.equal(modal.showUseButton, false)
})

test('createBiddingSacrificeEquipmentModalView reuses dungeon modal title and details', () => {
  const base = createDungeonEquipmentModalView({ equipmentId: 'W_SHIELD', legalActions: [] })
  const modal = createBiddingSacrificeEquipmentModalView({
    equipmentId: 'W_SHIELD',
    legalActions: POST_DRAW_LEGAL,
    sacrificeModeActive: false,
  })
  assert.equal(modal.title, base.title)
  assert.equal(modal.details, base.details)
})

test('createBiddingSacrificeEquipmentModalView is read-only for non-sacrificable tiles in mode', () => {
  const modal = createBiddingSacrificeEquipmentModalView({
    equipmentId: 'M_POLY',
    legalActions: POST_DRAW_LEGAL,
    sacrificeModeActive: true,
  })
  assert.equal(modal.showSacrificeButton, false)
  assert.equal(modal.sacrificeAction, null)
})

test('shouldUseBiddingSacrificeEquipmentModalView is true only during bidding sacrifice mode', () => {
  assert.equal(
    shouldUseBiddingSacrificeEquipmentModalView({ phase: 'bidding', sacrificeModeActive: true }),
    true,
  )
  assert.equal(
    shouldUseBiddingSacrificeEquipmentModalView({ phase: 'bidding', sacrificeModeActive: false }),
    false,
  )
  assert.equal(
    shouldUseBiddingSacrificeEquipmentModalView({ phase: 'dungeon', sacrificeModeActive: true }),
    false,
  )
})
