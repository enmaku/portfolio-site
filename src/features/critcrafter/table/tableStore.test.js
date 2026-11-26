import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { tableSheet } from './tableFixture.js'
import { createTableStorage, TABLE_KEY_PREFIX } from './tableStorage.js'
import { useCritcrafterTableStore } from '../../../stores/critcrafterTable.js'

function fakeStorage() {
  const data = new Map()
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  }
}

const brokenStorage = {
  getItem() {
    throw new Error('blocked')
  },
  setItem() {
    throw new Error('blocked')
  },
  removeItem() {
    throw new Error('blocked')
  },
}

beforeEach(() => setActivePinia(createPinia()))

function openFresh(id = '111', storage = createTableStorage(fakeStorage())) {
  const store = useCritcrafterTableStore()
  store.open(id, tableSheet(), storage)
  return { store, storage }
}

test('open: pristine character shows sheet values', () => {
  const { store } = openFresh()
  assert.equal(store.hp, 40)
  assert.equal(store.ac.value, 15)
  assert.equal(store.shield, null)
})

test('mutations persist deltas by id and survive a reload', () => {
  const raw = fakeStorage()
  const storage = createTableStorage(raw)
  const { store } = openFresh('111', storage)
  store.applyHp('damage', 12)
  store.toggleArmor('plate')
  store.cycleSlot('slots:wiz:1')
  assert.deepEqual(JSON.parse(raw.data.get(`${TABLE_KEY_PREFIX}111`)), {
    hp: 28,
    slots: { 'slots:wiz:1': 1 },
    armor: 'plate',
  })

  setActivePinia(createPinia())
  const again = useCritcrafterTableStore()
  again.open('111', tableSheet(), createTableStorage(raw))
  assert.equal(again.hp, 28)
  assert.equal(again.ac.value, 21)
  assert.equal(again.table.slots['slots:wiz:1'], 1)
})

test('characters are keyed apart', () => {
  const raw = fakeStorage()
  const storage = createTableStorage(raw)
  const { store } = openFresh('111', storage)
  store.applyHp('damage', 5)
  store.open('222', tableSheet(), storage)
  assert.equal(store.hp, 40)
  store.open('111', tableSheet(), storage)
  assert.equal(store.hp, 35)
})

test('reload with a smaller sheet clamps stored values silently', () => {
  const raw = fakeStorage()
  raw.data.set(`${TABLE_KEY_PREFIX}111`, JSON.stringify({ hp: 90, focusUsed: 7, slots: { 'slots:wiz:1': 9, 'slots:old:1': 2 } }))
  const { store } = openFresh('111', createTableStorage(raw))
  assert.equal(store.hp, 40)
  assert.equal(store.table.focusUsed, 2)
  assert.deepEqual(store.table.slots, { 'slots:wiz:1': 3 })
})

test('corrupt stored JSON is treated as nothing stored', () => {
  const raw = fakeStorage()
  raw.data.set(`${TABLE_KEY_PREFIX}111`, '{not json')
  const { store } = openFresh('111', createTableStorage(raw))
  assert.equal(store.hp, 40)
})

test('storage unavailable: state works in memory for the session', () => {
  const storage = createTableStorage(brokenStorage)
  const { store } = openFresh('111', storage)
  store.applyHp('damage', 9)
  assert.equal(store.hp, 31)
  store.open('111', tableSheet(), storage)
  assert.equal(store.hp, 31)
})

test('no storage at all behaves like unavailable', () => {
  const { store } = openFresh('111', createTableStorage(null))
  store.applyHp('damage', 1)
  assert.equal(store.hp, 39)
})

test('mutators return notes for the toast and a no-op leaves storage untouched', () => {
  const raw = fakeStorage()
  const { store } = openFresh('111', createTableStorage(raw))
  store.toggleWeapon('sword')
  store.toggleWeapon('dagger')
  const notes = store.toggleShield('tower')
  assert.deepEqual(notes, ['Put away sword'])
  const before = raw.data.get(`${TABLE_KEY_PREFIX}111`)
  store.applyHp('damage', 0)
  assert.equal(raw.data.get(`${TABLE_KEY_PREFIX}111`), before)
})

test('rest goes through the store and persists', () => {
  const { store } = openFresh()
  store.applyHp('damage', 20)
  store.rest('8h')
  assert.equal(store.hp, 23)
})

test('shield row and live AC follow raise/lower', () => {
  const { store } = openFresh()
  store.toggleShield('tower')
  assert.equal(store.shield.raised, false)
  store.setShieldRaised(true)
  assert.equal(store.ac.value, 17)
  store.applyHp('shieldDamage', 12)
  assert.equal(store.shield.hp, 8)
  assert.equal(store.shield.broken, true)
})
