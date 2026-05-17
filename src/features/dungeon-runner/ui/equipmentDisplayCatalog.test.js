import assert from 'node:assert/strict'
import test from 'node:test'
import { equipmentShortName, sacrificeActionLabel } from './equipmentDisplayCatalog.js'

test('equipment short names avoid raw ids for standard gear', () => {
  assert.equal(equipmentShortName('W_SHIELD'), 'Shield')
  assert.equal(equipmentShortName('B_AXE'), 'Fire Axe')
  assert.equal(equipmentShortName('M_POLY'), 'Polymorph')
})

test('sacrifice label uses short name', () => {
  assert.equal(sacrificeActionLabel('W_SHIELD'), 'Sacrifice Shield')
})
