import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DUNGEON_RUN_WIN_VIA,
  isOmnipotenceSetSpeciesUnique,
  shouldOmnipotenceSave,
} from './omnipotencePolicy.js'

test('isOmnipotenceSetSpeciesUnique passes when every species in the initial pile is distinct', () => {
  assert.equal(isOmnipotenceSetSpeciesUnique(['goblin', 'orc', 'dragon']), true)
})

test('isOmnipotenceSetSpeciesUnique fails when the initial pile has duplicate species', () => {
  assert.equal(isOmnipotenceSetSpeciesUnique(['goblin', 'goblin', 'orc']), false)
})

test('shouldOmnipotenceSave requires M_OMNI in play and a species-unique omnipotence set', () => {
  assert.equal(
    shouldOmnipotenceSave({
      inPlayEquipmentIds: ['M_WALL'],
      omnipotenceSet: ['goblin', 'orc', 'dragon'],
    }),
    false,
  )
  assert.equal(
    shouldOmnipotenceSave({
      inPlayEquipmentIds: ['M_OMNI'],
      omnipotenceSet: ['goblin', 'orc', 'dragon'],
    }),
    true,
  )
})

test('DUNGEON_RUN_WIN_VIA exposes omnipotence win metadata key', () => {
  assert.equal(DUNGEON_RUN_WIN_VIA.OMNIPOTENCE, 'omnipotence')
})
