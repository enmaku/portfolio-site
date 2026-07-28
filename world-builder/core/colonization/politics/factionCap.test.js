import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_ACTIVE_FACTIONS,
  allocateTerritoryPaletteIndex,
  canMintNewFaction,
  countActiveFactions,
  createActiveFactionRecord,
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
    status: 'active',
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

test('allocateTerritoryPaletteIndex reuses the lowest free slot after extinction', () => {
  const factions = [
    { status: 'active', territoryPaletteIndex: 0 },
    { status: 'extinct', territoryPaletteIndex: 1 },
    { status: 'active', territoryPaletteIndex: 2 },
  ]
  assert.strictEqual(allocateTerritoryPaletteIndex(factions), 1)
  const minted = createActiveFactionRecord({
    id: 'new',
    capitalSettlementId: 's',
    settlementIds: ['s'],
    emergedEpoch: 9,
    factions,
  })
  assert.ok(minted)
  assert.strictEqual(minted.territoryPaletteIndex, 1)
})
