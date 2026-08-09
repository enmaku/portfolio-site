import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_ACTIVE_FACTIONS,
  allocateTerritoryPaletteIndex,
  canMintNewFaction,
  countActiveFactions,
  createActiveFactionRecord,
  syncFactionTerritoryPalettes,
} from './factionCap.js'

test('countActiveFactions ignores extinct roster rows', () => {
  assert.strictEqual(
    countActiveFactions([
      { status: 'active' },
      { status: 'extinct' },
      { status: 'active' },
    ]),
    2,
  )
})

test('canMintNewFaction is false at the active roster cap', () => {
  const factions = Array.from({ length: MAX_ACTIVE_FACTIONS }, (_, i) => ({
    id: `f${i}`,
    status: 'active',
    settlementIds: [`a${i}`, `b${i}`],
    territoryPaletteIndex: i,
  }))
  assert.equal(canMintNewFaction(factions), false)
  assert.equal(allocateTerritoryPaletteIndex(factions), null)
  assert.equal(
    createActiveFactionRecord({
      id: 'x',
      capitalSettlementId: 's',
      settlementIds: ['s'],
      emergedEpoch: 1,
      factions,
    }),
    null,
  )
})

test('allocateTerritoryPaletteIndex still finds free slots when roster is at mint cap', () => {
  const factions = Array.from({ length: MAX_ACTIVE_FACTIONS }, (_, i) => ({
    id: `f${i}`,
    status: 'active',
    settlementIds: i < 6 ? [`a${i}`, `b${i}`] : [`solo${i}`],
    territoryPaletteIndex: i < 6 ? i : undefined,
  }))
  assert.equal(canMintNewFaction(factions), false)
  assert.strictEqual(allocateTerritoryPaletteIndex(factions), 6)
})

test('sync assigns a color to a grown faction even at the active roster mint cap', () => {
  const settlements = []
  const factions = Array.from({ length: MAX_ACTIVE_FACTIONS }, (_, i) => {
    if (i < 6) {
      settlements.push(
        { id: `a${i}`, factionId: `f${i}`, status: 'living', population: 10 },
        { id: `b${i}`, factionId: `f${i}`, status: 'living', population: 10 },
      )
      return {
        id: `f${i}`,
        status: 'active',
        settlementIds: [`a${i}`, `b${i}`],
        territoryPaletteIndex: i,
      }
    }
    if (i === 6) {
      settlements.push(
        { id: 'grown-a', factionId: 'f6', status: 'living', population: 10 },
        { id: 'grown-b', factionId: 'f6', status: 'living', population: 10 },
      )
      return {
        id: 'f6',
        status: 'active',
        settlementIds: ['grown-a', 'grown-b'],
      }
    }
    settlements.push({ id: `solo${i}`, factionId: `f${i}`, status: 'living', population: 10 })
    return {
      id: `f${i}`,
      status: 'active',
      settlementIds: [`solo${i}`],
    }
  })
  const synced = syncFactionTerritoryPalettes({ factions, settlements })
  assert.strictEqual(synced.find((f) => f.id === 'f6')?.territoryPaletteIndex, 6)
})

test('allocateTerritoryPaletteIndex reuses the lowest free slot after extinction', () => {
  const factions = [
    { id: 'a', status: 'active', settlementIds: ['a0', 'a1'], territoryPaletteIndex: 0 },
    { id: 'b', status: 'extinct', settlementIds: [], territoryPaletteIndex: 1 },
    { id: 'c', status: 'active', settlementIds: ['c0', 'c1'], territoryPaletteIndex: 2 },
  ]
  assert.strictEqual(allocateTerritoryPaletteIndex(factions), 1)
  const minted = createActiveFactionRecord({
    id: 'new',
    capitalSettlementId: 's',
    settlementIds: ['s', 't'],
    emergedEpoch: 9,
    factions,
  })
  assert.ok(minted)
  assert.strictEqual(minted.territoryPaletteIndex, 1)
})

test('singleton faction mints without a territory palette slot', () => {
  const minted = createActiveFactionRecord({
    id: 'solo',
    capitalSettlementId: 's',
    settlementIds: ['s'],
    emergedEpoch: 0,
    factions: [],
  })
  assert.ok(minted)
  assert.equal(minted.territoryPaletteIndex, undefined)
})

test('syncFactionTerritoryPalettes releases singleton slots and assigns on growth', () => {
  const settlements = [
    { id: 'a', factionId: 'fa', status: 'living', population: 10 },
    { id: 'b', factionId: 'fb', status: 'living', population: 10 },
    { id: 'c', factionId: 'fb', status: 'living', population: 10 },
  ]
  const synced = syncFactionTerritoryPalettes({
    factions: [
      {
        id: 'fa',
        status: 'active',
        settlementIds: ['a'],
        territoryPaletteIndex: 3,
      },
      {
        id: 'fb',
        status: 'active',
        settlementIds: ['b', 'c'],
      },
    ],
    settlements,
  })
  assert.equal(synced.find((f) => f.id === 'fa')?.territoryPaletteIndex, undefined)
  assert.equal(synced.find((f) => f.id === 'fb')?.territoryPaletteIndex, 0)
})

test('singleton palette slots do not block allocateTerritoryPaletteIndex', () => {
  const factions = [
    { id: 'solo', status: 'active', settlementIds: ['s'], territoryPaletteIndex: 0 },
    { id: 'pair', status: 'active', settlementIds: ['a', 'b'], territoryPaletteIndex: 1 },
  ]
  assert.strictEqual(allocateTerritoryPaletteIndex(factions), 0)
})
