import test from 'node:test'
import assert from 'node:assert/strict'
import { tableSheet } from './tableFixture.js'
import {
  initialState,
  resolveState,
  toStored,
  liveAc,
  handsUsed,
  toggleArmor,
  toggleWeapon,
  toggleGrip,
  toggleShield,
  setShieldRaised,
  applyHp,
  cycleSlot,
  cycleFocus,
  cycleConsumable,
  rest,
  shieldView,
} from './tableState.js'

const sheet = () => tableSheet()
const held = (s) => [...s.held]

test('fresh state: full HP, nothing used, unarmored AC', () => {
  const sh = sheet()
  const s = initialState(sh)
  assert.equal(s.hp, 40)
  assert.equal(s.tempHp, 0)
  assert.equal(liveAc(sh, s).value, 15)
  assert.deepEqual(held(s), [])
  assert.equal(s.armor, null)
  assert.equal(s.shield, null)
})

test('export flags seed the initial equipment', () => {
  const sh = sheet()
  sh.gear.armor[1].wornInExport = true
  sh.gear.weapons[0].worn = true
  sh.gear.shields[0].wornInExport = true
  const s = initialState(sh)
  assert.equal(s.armor, 'plate')
  assert.deepEqual(held(s), ['sword'])
  assert.equal(s.shield, 'tower')
})

// --- live AC -------------------------------------------------------------------------------

test('live AC: worn armor acTotal replaces unarmored AC', () => {
  const sh = sheet()
  const { state } = toggleArmor(sh, initialState(sh), 'plate')
  assert.equal(liveAc(sh, state).value, 21)
})

test('live AC: raised shield adds its bonus, lowered does not', () => {
  const sh = sheet()
  let s = toggleShield(sh, initialState(sh), 'tower').state
  assert.equal(liveAc(sh, s).value, 15)
  s = setShieldRaised(sh, s, true).state
  assert.equal(liveAc(sh, s).value, 17)
  s = setShieldRaised(sh, s, false).state
  assert.equal(liveAc(sh, s).value, 15)
})

test('live AC breakdown shows current state only and sums to the value', () => {
  const sh = sheet()
  let s = toggleArmor(sh, initialState(sh), 'leather').state
  s = toggleShield(sh, s, 'tower').state
  s = setShieldRaised(sh, s, true).state
  const ac = liveAc(sh, s)
  assert.equal(ac.value, 19)
  assert.deepEqual(
    ac.breakdown.map((b) => [b.label, b.amount]),
    [['Leather', 17], ['Shield raised', 2]],
  )
  assert.equal(ac.breakdown.reduce((n, b) => n + b.amount, 0), ac.value)
})

test('one body armor at a time: wearing another swaps, toggling the worn one removes it', () => {
  const sh = sheet()
  let s = toggleArmor(sh, initialState(sh), 'leather').state
  s = toggleArmor(sh, s, 'plate').state
  assert.equal(s.armor, 'plate')
  s = toggleArmor(sh, s, 'plate').state
  assert.equal(s.armor, null)
  assert.equal(liveAc(sh, s).value, 15)
})

// --- hands ---------------------------------------------------------------------------------

test('weapons: two one-handers fit, a third drops the earliest', () => {
  const sh = sheet()
  sh.gear.weapons.push({ ...sh.gear.weapons[1], key: 'dagger2', name: 'dagger2' })
  let s = toggleWeapon(sh, initialState(sh), 'sword').state
  s = toggleWeapon(sh, s, 'dagger').state
  assert.deepEqual(held(s), ['sword', 'dagger'])
  const r = toggleWeapon(sh, s, 'dagger2')
  assert.deepEqual(held(r.state), ['dagger', 'dagger2'])
  assert.equal(handsUsed(sh, r.state), 2)
  assert.equal(r.notes.length, 1)
})

test('equipping a two-hander drops every other weapon', () => {
  const sh = sheet()
  let s = toggleWeapon(sh, initialState(sh), 'sword').state
  s = toggleWeapon(sh, s, 'dagger').state
  s = toggleWeapon(sh, s, 'greatsword').state
  assert.deepEqual(held(s), ['greatsword'])
})

test('toggling a held weapon puts it away', () => {
  const sh = sheet()
  let s = toggleWeapon(sh, initialState(sh), 'sword').state
  s = toggleWeapon(sh, s, 'sword').state
  assert.deepEqual(held(s), [])
})

test('versatile grip: toggle widens, dropping other weapons; toggling back narrows', () => {
  const sh = sheet()
  let s = toggleWeapon(sh, initialState(sh), 'sword').state
  s = toggleWeapon(sh, s, 'dagger').state
  assert.equal(handsUsed(sh, s), 2)
  s = toggleGrip(sh, s, 'sword').state
  assert.deepEqual(held(s), ['sword'])
  assert.equal(handsUsed(sh, s), 2)
  s = toggleGrip(sh, s, 'sword').state
  assert.equal(handsUsed(sh, s), 1)
})

test('grip toggle on a non-versatile weapon does nothing', () => {
  const sh = sheet()
  const s = toggleWeapon(sh, initialState(sh), 'dagger').state
  const r = toggleGrip(sh, s, 'dagger')
  assert.deepEqual(r.state, s)
})

test('equipping a shield puts weapons away, earliest first, until it fits', () => {
  const sh = sheet()
  let s = toggleWeapon(sh, initialState(sh), 'sword').state
  s = toggleWeapon(sh, s, 'dagger').state
  const r = toggleShield(sh, s, 'tower')
  assert.equal(r.state.shield, 'tower')
  assert.deepEqual(held(r.state), ['dagger'])
  assert.equal(handsUsed(sh, r.state), 2)
})

test('equipping a weapon with a shield on drops other weapons, then the shield', () => {
  const sh = sheet()
  let s = toggleShield(sh, initialState(sh), 'tower').state
  s = setShieldRaised(sh, s, true).state
  s = toggleWeapon(sh, s, 'sword').state
  assert.equal(s.shield, 'tower')
  assert.deepEqual(held(s), ['sword'])
  s = toggleWeapon(sh, s, 'greatsword').state
  assert.deepEqual(held(s), ['greatsword'])
  assert.equal(s.shield, null)
  assert.equal(s.shieldRaised, false)
})

test('widening a grip with a shield on drops the shield', () => {
  const sh = sheet()
  let s = toggleShield(sh, initialState(sh), 'tower').state
  s = toggleWeapon(sh, s, 'sword').state
  s = toggleGrip(sh, s, 'sword').state
  assert.equal(s.shield, null)
  assert.deepEqual(held(s), ['sword'])
})

test('buckler takes a hand only while raised; a two-hander lowers it but keeps it equipped', () => {
  const sh = sheet()
  let s = toggleShield(sh, initialState(sh), 'buckler').state
  s = toggleWeapon(sh, s, 'greatsword').state
  assert.equal(handsUsed(sh, s), 2)
  assert.equal(s.shield, 'buckler')
  const r = setShieldRaised(sh, s, true)
  assert.equal(r.state.shieldRaised, true)
  assert.deepEqual(held(r.state), [])
  assert.equal(handsUsed(sh, r.state), 1)
})

test('equipping a two-hander lowers a raised buckler', () => {
  const sh = sheet()
  let s = toggleShield(sh, initialState(sh), 'buckler').state
  s = setShieldRaised(sh, s, true).state
  s = toggleWeapon(sh, s, 'sword').state
  assert.equal(s.shieldRaised, true)
  assert.equal(handsUsed(sh, s), 2)
  s = toggleGrip(sh, s, 'sword').state
  assert.equal(s.shield, 'buckler')
  assert.equal(s.shieldRaised, false)
  assert.deepEqual(held(s), ['sword'])
})

test('raising a tower shield puts weapons away until it fits', () => {
  const sh = sheet()
  let s = toggleWeapon(sh, initialState(sh), 'greatsword').state
  s = toggleShield(sh, s, 'tower').state
  assert.deepEqual(held(s), [])
  s = toggleWeapon(sh, s, 'sword').state
  s = setShieldRaised(sh, s, true).state
  assert.deepEqual(held(s), ['sword'])
})

test('one shield at a time; unequipping lowers it; cannot raise without a shield', () => {
  const sh = sheet()
  let s = toggleShield(sh, initialState(sh), 'tower').state
  s = setShieldRaised(sh, s, true).state
  s = toggleShield(sh, s, 'buckler').state
  assert.equal(s.shield, 'buckler')
  assert.equal(s.shieldRaised, false)
  s = toggleShield(sh, s, 'buckler').state
  assert.equal(s.shield, null)
  assert.equal(setShieldRaised(sh, s, true).state.shieldRaised, false)
})

// --- HP ------------------------------------------------------------------------------------

test('damage: temp HP absorbs first, remainder hits HP, HP floors at 0', () => {
  const sh = sheet()
  let s = applyHp(sh, initialState(sh), 'temp', 5).state
  s = applyHp(sh, s, 'damage', 8).state
  assert.equal(s.tempHp, 0)
  assert.equal(s.hp, 37)
  s = applyHp(sh, s, 'damage', 500).state
  assert.equal(s.hp, 0)
})

test('heal caps at max HP and leaves temp HP alone', () => {
  const sh = sheet()
  let s = applyHp(sh, initialState(sh), 'temp', 4).state
  s = applyHp(sh, s, 'damage', 10).state
  assert.deepEqual([s.hp, s.tempHp], [34, 0])
  s = applyHp(sh, s, 'temp', 4).state
  s = applyHp(sh, s, 'heal', 100).state
  assert.deepEqual([s.hp, s.tempHp], [40, 4])
})

test('temp HP does not stack: the higher value wins', () => {
  const sh = sheet()
  let s = applyHp(sh, initialState(sh), 'temp', 5).state
  s = applyHp(sh, s, 'temp', 3).state
  assert.equal(s.tempHp, 5)
  s = applyHp(sh, s, 'temp', 9).state
  assert.equal(s.tempHp, 9)
})

test('invalid or non-positive amounts change nothing', () => {
  const sh = sheet()
  const s0 = initialState(sh)
  for (const amount of [0, -3, NaN, 'x', null]) {
    assert.deepEqual(applyHp(sh, s0, 'damage', amount).state, s0)
  }
})

test('shield HP: damage floors at 0, repair caps at max; only while raised', () => {
  const sh = sheet()
  let s = toggleShield(sh, initialState(sh), 'tower').state
  assert.deepEqual(applyHp(sh, s, 'shieldDamage', 5).state, s)
  s = setShieldRaised(sh, s, true).state
  s = applyHp(sh, s, 'shieldDamage', 12).state
  assert.equal(shieldView(sh, s).hp, 8)
  s = applyHp(sh, s, 'shieldDamage', 99).state
  assert.equal(shieldView(sh, s).hp, 0)
  s = applyHp(sh, s, 'shieldRepair', 7).state
  assert.equal(shieldView(sh, s).hp, 7)
  s = applyHp(sh, s, 'shieldRepair', 99).state
  assert.equal(shieldView(sh, s).hp, 20)
})

test('shield HP is kept per shield', () => {
  const sh = sheet()
  let s = toggleShield(sh, initialState(sh), 'tower').state
  s = setShieldRaised(sh, s, true).state
  s = applyHp(sh, s, 'shieldDamage', 3).state
  s = toggleShield(sh, s, 'buckler').state
  assert.equal(shieldView(sh, s).hp, 8)
  s = toggleShield(sh, s, 'tower').state
  assert.equal(shieldView(sh, s).hp, 17)
})

test('shield view: BROKEN at or below BT, hardness and BT passed through', () => {
  const sh = sheet()
  let s = toggleShield(sh, initialState(sh), 'tower').state
  s = setShieldRaised(sh, s, true).state
  assert.equal(shieldView(sh, s).broken, false)
  s = applyHp(sh, s, 'shieldDamage', 10).state
  const v = shieldView(sh, s)
  assert.deepEqual([v.hp, v.max, v.bt, v.hardness, v.broken, v.raised], [10, 20, 10, 5, true, true])
  assert.equal(shieldView(sh, initialState(sh)), null)
})

// --- usage ---------------------------------------------------------------------------------

test('slot boxes cycle 0..n then back to 0', () => {
  const sh = sheet()
  let s = initialState(sh)
  const seen = []
  for (let i = 0; i < 4; i++) {
    s = cycleSlot(sh, s, 'slots:wiz:2')
    seen.push(s.slots['slots:wiz:2'] ?? 0)
  }
  assert.deepEqual(seen, [1, 2, 0, 1])
})

test('slot cycling ignores keys the sheet does not have', () => {
  const sh = sheet()
  const s = initialState(sh)
  assert.deepEqual(cycleSlot(sh, s, 'slots:ghost:1'), s)
  assert.deepEqual(cycleSlot(sh, s, 'slots:wiz:9'), s)
})

test('focus and consumable boxes cycle to their maxima then reset', () => {
  const sh = sheet()
  let s = cycleFocus(sh, initialState(sh))
  s = cycleFocus(sh, s)
  assert.equal(s.focusUsed, 2)
  s = cycleFocus(sh, s)
  assert.equal(s.focusUsed, 0)
  for (let i = 0; i < 3; i++) s = cycleConsumable(sh, s, 'potion')
  assert.equal(s.consumed.potion, 3)
  s = cycleConsumable(sh, s, 'potion')
  assert.equal(s.consumed.potion ?? 0, 0)
  assert.deepEqual(cycleConsumable(sh, s, 'nope'), s)
})

// --- rests ---------------------------------------------------------------------------------

function worn() {
  const sh = sheet()
  let s = initialState(sh)
  s = applyHp(sh, s, 'damage', 30).state
  s = applyHp(sh, s, 'temp', 6).state
  s = cycleSlot(sh, cycleSlot(sh, s, 'slots:wiz:1'), 'slots:wiz:2')
  s = cycleFocus(sh, cycleFocus(sh, s))
  s = cycleConsumable(sh, s, 'potion')
  s = toggleShield(sh, s, 'tower').state
  s = setShieldRaised(sh, s, true).state
  s = applyHp(sh, s, 'shieldDamage', 4).state
  return { sh, s }
}

test('refocus restores one focus point only', () => {
  const { sh, s } = worn()
  const r = rest(sh, s, 'refocus')
  assert.equal(r.focusUsed, 1)
  assert.equal(r.hp, s.hp)
  assert.equal(r.tempHp, 6)
  assert.deepEqual(r.slots, s.slots)
})

test('refocus never goes below zero', () => {
  const sh = sheet()
  assert.equal(rest(sh, initialState(sh), 'refocus').focusUsed, 0)
})

test('8 h rest: regain Con mod + 1 HP, refill slots and focus, clear temp HP', () => {
  const { sh, s } = worn()
  assert.equal(s.hp, 10)
  const r = rest(sh, s, '8h')
  assert.equal(r.hp, 13)
  assert.deepEqual(r.slots, {})
  assert.equal(r.focusUsed, 0)
  assert.equal(r.tempHp, 0)
})

test('24 h rest regains twice as much; HP never exceeds max', () => {
  const { sh, s } = worn()
  assert.equal(rest(sh, s, '24h').hp, 16)
  const nearly = applyHp(sh, initialState(sh), 'damage', 2).state
  assert.equal(rest(sh, nearly, '24h').hp, 40)
})

test('extended rest restores full HP', () => {
  const { sh, s } = worn()
  assert.equal(rest(sh, s, 'extended').hp, 40)
})

test('rests heal at least 1 HP even with a very negative Con', () => {
  const { sh, s } = worn()
  sh.stats.abilities.find((a) => a.id === 'con').mod = -3
  assert.equal(rest(sh, s, '8h').hp, 11)
})

test('rests never repair shields and never reset consumables', () => {
  const { sh, s } = worn()
  for (const kind of ['refocus', '8h', '24h', 'extended']) {
    const r = rest(sh, s, kind)
    assert.equal(shieldView(sh, r).hp, 16, kind)
    assert.equal(r.consumed.potion, 1, kind)
  }
})

// --- load: clamping, stale keys, deltas ------------------------------------------------------

test('resolveState clamps stored values to the new sheet maxima', () => {
  const sh = sheet()
  const r = resolveState(sh, {
    hp: 999,
    tempHp: -4,
    focusUsed: 9,
    slots: { 'slots:wiz:1': 9, 'slots:wiz:2': 1 },
    consumed: { potion: 7, arrows: 2 },
    shield: 'tower',
    shieldRaised: true,
    shieldHp: { tower: 99 },
  })
  assert.equal(r.hp, 40)
  assert.equal(r.tempHp, 0)
  assert.equal(r.focusUsed, 2)
  assert.deepEqual(r.slots, { 'slots:wiz:1': 3, 'slots:wiz:2': 1 })
  assert.deepEqual(r.consumed, { potion: 3, arrows: 2 })
  assert.equal(shieldView(sh, r).hp, 20)
})

test('resolveState ignores unknown keys and drops zeroed entries', () => {
  const sh = sheet()
  const r = resolveState(sh, {
    slots: { 'slots:ghost:1': 2, 'slots:wiz:7': 1, 'slots:wiz:1': 0 },
    consumed: { ghost: 2, potion: 0 },
    held: ['sword', 'ghost'],
    armor: 'ghost',
    shield: 'ghost',
    grips: { ghost: 2, dagger: 2 },
    shieldHp: { ghost: 1 },
    mystery: 1,
  })
  assert.deepEqual(r.slots, {})
  assert.deepEqual(r.consumed, {})
  assert.deepEqual(held(r), ['sword'])
  assert.equal(r.armor, null)
  assert.equal(r.shield, null)
  assert.equal(r.grips.dagger, undefined)
  assert.equal('mystery' in r, false)
})

test('resolveState survives garbage and re-enforces the hands limit', () => {
  const sh = sheet()
  assert.deepEqual(resolveState(sh, null), initialState(sh))
  assert.deepEqual(resolveState(sh, 'oops'), initialState(sh))
  const r = resolveState(sh, { held: ['sword', 'dagger', 'greatsword'], hp: 'x', slots: 4 })
  assert.equal(handsUsed(sh, r) <= 2, true)
  assert.equal(r.hp, 40)
})

test('toStored keeps deltas only, and round-trips through resolveState', () => {
  const sh = sheet()
  assert.deepEqual(toStored(sh, initialState(sh)), {})
  const { sh: sh2, s } = worn()
  const stored = toStored(sh2, s)
  assert.equal('grips' in stored, false)
  assert.equal(stored.hp, 10)
  assert.deepEqual(resolveState(sh2, JSON.parse(JSON.stringify(stored))), s)
})
