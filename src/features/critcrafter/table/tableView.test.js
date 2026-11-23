import test from 'node:test'
import assert from 'node:assert/strict'
import { tableSheet } from './tableFixture.js'
import { initialState, toggleWeapon, toggleGrip, toggleShield, setShieldRaised, cycleSlot, cycleFocus, cycleConsumable, toggleArmor } from './tableState.js'
import { handsLabel, weaponControl, armorControl, shieldControl, consumableUsage, slotUsage, focusUsage } from './tableView.js'

const sheet = () => tableSheet()

test('hands label counts hands in use out of two', () => {
  const sh = sheet()
  let s = initialState(sh)
  assert.equal(handsLabel(sh, s), 'Hands 0/2')
  s = toggleWeapon(sh, s, 'sword').state
  s = toggleShield(sh, s, 'tower').state
  assert.equal(handsLabel(sh, s), 'Hands 2/2')
})

test('weapon control: held flag, current grip, versatile swap offered only to versatile weapons', () => {
  const sh = sheet()
  let s = toggleWeapon(sh, initialState(sh), 'sword').state
  assert.deepEqual(weaponControl(sh, s, 'sword'), { held: true, hands: 1, versatile: true })
  s = toggleGrip(sh, s, 'sword').state
  assert.deepEqual(weaponControl(sh, s, 'sword'), { held: true, hands: 2, versatile: true })
  assert.deepEqual(weaponControl(sh, s, 'dagger'), { held: false, hands: 1, versatile: false })
  assert.deepEqual(weaponControl(sh, s, 'greatsword'), { held: false, hands: 2, versatile: false })
})

test('armor control reflects the one worn armor', () => {
  const sh = sheet()
  const s = toggleArmor(sh, initialState(sh), 'plate').state
  assert.deepEqual(armorControl(s, 'plate'), { worn: true })
  assert.deepEqual(armorControl(s, 'leather'), { worn: false })
})

test('shield control: raise is only available while the shield is equipped', () => {
  const sh = sheet()
  let s = initialState(sh)
  assert.deepEqual(shieldControl(s, 'tower'), { equipped: false, raised: false, canRaise: false })
  s = toggleShield(sh, s, 'tower').state
  assert.deepEqual(shieldControl(s, 'tower'), { equipped: true, raised: false, canRaise: true })
  s = setShieldRaised(sh, s, true).state
  assert.deepEqual(shieldControl(s, 'tower'), { equipped: true, raised: true, canRaise: true })
  assert.deepEqual(shieldControl(s, 'buckler'), { equipped: false, raised: false, canRaise: false })
})

test('usage views report used and max for consumables, slots and focus', () => {
  const sh = sheet()
  let s = initialState(sh)
  s = cycleConsumable(sh, s, 'potion')
  assert.deepEqual(consumableUsage(sh, s, 'potion'), { used: 1, max: 3 })
  assert.deepEqual(consumableUsage(sh, s, 'arrows'), { used: 0, max: 20 })
  s = cycleSlot(sh, s, 'slots:wiz:2')
  assert.deepEqual(slotUsage(sh, s, 'wiz', 2), { key: 'slots:wiz:2', used: 1, max: 2 })
  assert.equal(slotUsage(sh, s, 'wiz', 9), null)
  assert.equal(slotUsage(sh, s, 'wiz', 0), null)
  s = cycleFocus(sh, s)
  assert.deepEqual(focusUsage(sh, s), { used: 1, max: 2 })
})
