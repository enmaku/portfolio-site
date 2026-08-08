import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FACTION_TERRITORY_UNALIGNED_RGB,
  factionTerritoryRgb,
} from './buildFactionTerritoryOverlayRgba.js'
import {
  LOYALTY_OVERLAY_FILL_ALPHA,
  buildLoyaltyOverlayRgba,
  loyaltyShareForSettlement,
  mixLoyaltyRgb,
  resolveSettlementLoyaltyRgb,
} from './buildLoyaltyOverlayRgba.js'

const FACTION_A = 'faction-a'
const FACTION_B = 'faction-b'

/**
 * @returns {object[]}
 */
function twoFactionRoster() {
  return [
    {
      id: FACTION_A,
      capitalSettlementId: 'a',
      settlementIds: ['a', 'b'],
      status: 'active',
      emergedEpoch: 1,
    },
    {
      id: FACTION_B,
      capitalSettlementId: 'c',
      settlementIds: ['c', 'd'],
      status: 'active',
      emergedEpoch: 1,
    },
  ]
}

/**
 * @param {Record<string, unknown>} [overrides]
 */
function landDoc(overrides = {}) {
  return {
    gridWidth: 3,
    gridHeight: 3,
    fields: { elevation: new Float32Array(9).fill(0.6) },
    lakeMask: new Uint8Array(9),
    riverCorridorMask: new Uint8Array(9),
    ...overrides,
  }
}

test('loyaltyShareForSettlement counts sticky banner share of window', () => {
  assert.strictEqual(
    loyaltyShareForSettlement({ factionId: FACTION_A }, Array(10).fill(FACTION_A), 10),
    1,
  )
  assert.strictEqual(
    loyaltyShareForSettlement({ factionId: FACTION_A }, [FACTION_A, '', FACTION_B], 10),
    0.1,
  )
  assert.strictEqual(loyaltyShareForSettlement({ factionId: null }, [], 10), 0)
})

test('mixLoyaltyRgb lerps toward unaligned gray at zero loyalty', () => {
  const factionRgb = factionTerritoryRgb(FACTION_A, twoFactionRoster())
  assert.deepStrictEqual(mixLoyaltyRgb(factionRgb, 0), [...FACTION_TERRITORY_UNALIGNED_RGB])
  assert.deepStrictEqual(mixLoyaltyRgb(factionRgb, 1), factionRgb)
})

test('resolveSettlementLoyaltyRgb is gray when controller differs from sticky membership', () => {
  const rgb = resolveSettlementLoyaltyRgb(
    { id: 'free', factionId: FACTION_A },
    {
      settlements: [
        { id: 'free', factionId: FACTION_A },
        { id: 'c', factionId: FACTION_B },
        { id: 'd', factionId: FACTION_B },
      ],
      factions: twoFactionRoster(),
      softPowerPaintBySettlementId: { free: FACTION_B },
      bannerMembershipHistoryBySettlementId: {
        free: Array(10).fill(FACTION_A),
      },
      windowSize: 10,
    },
  )
  assert.deepStrictEqual(rgb, [...FACTION_TERRITORY_UNALIGNED_RGB])
})

test('buildLoyaltyOverlayRgba paints claim hinterland at full faction color', () => {
  const factions = twoFactionRoster()
  const expectedRgb = mixLoyaltyRgb(factionTerritoryRgb(FACTION_A, factions), 1)

  const rgba = buildLoyaltyOverlayRgba(
    landDoc({
      settlements: [
        { id: 'a', factionId: FACTION_A, status: 'living' },
        { id: 'b', factionId: FACTION_A, status: 'living' },
        { id: 'c', factionId: FACTION_B, status: 'living' },
        { id: 'd', factionId: FACTION_B, status: 'living' },
      ],
      factions,
      primaryClaim: { a: [{ x: 1, y: 1 }, { x: 0, y: 1 }] },
      bannerMembershipHistoryBySettlementId: {
        a: Array(10).fill(FACTION_A),
      },
    }),
  )

  assert.ok(rgba)
  const base = (1 * 3 + 1) * 4
  assert.strictEqual(rgba[base], expectedRgb[0])
  assert.strictEqual(rgba[base + 1], expectedRgb[1])
  assert.strictEqual(rgba[base + 2], expectedRgb[2])
  assert.strictEqual(rgba[base + 3], Math.round(LOYALTY_OVERLAY_FILL_ALPHA * 255))
  const neighbor = (1 * 3 + 0) * 4
  assert.strictEqual(rgba[neighbor], expectedRgb[0])
  assert.strictEqual(rgba[neighbor + 3], Math.round(LOYALTY_OVERLAY_FILL_ALPHA * 255))
})

test('buildLoyaltyOverlayRgba paints fresh tenure near gray', () => {
  const factions = twoFactionRoster()
  const expectedRgb = mixLoyaltyRgb(factionTerritoryRgb(FACTION_A, factions), 0.1)

  const rgba = buildLoyaltyOverlayRgba(
    landDoc({
      settlements: [
        { id: 'a', factionId: FACTION_A, status: 'living' },
        { id: 'b', factionId: FACTION_A, status: 'living' },
        { id: 'c', factionId: FACTION_B, status: 'living' },
        { id: 'd', factionId: FACTION_B, status: 'living' },
      ],
      factions,
      primaryClaim: { a: [{ x: 1, y: 1 }] },
      bannerMembershipHistoryBySettlementId: {
        a: [FACTION_A],
      },
    }),
  )

  assert.ok(rgba)
  const base = (1 * 3 + 1) * 4
  assert.strictEqual(rgba[base], expectedRgb[0])
  assert.strictEqual(rgba[base + 1], expectedRgb[1])
  assert.strictEqual(rgba[base + 2], expectedRgb[2])
})

test('buildLoyaltyOverlayRgba skips water cells', () => {
  const factions = twoFactionRoster()
  const elevation = new Float32Array(9).fill(0.6)
  elevation[4] = 0.1
  const rgba = buildLoyaltyOverlayRgba(
    landDoc({
      fields: { elevation },
      settlements: [
        { id: 'a', factionId: FACTION_A, status: 'living' },
        { id: 'b', factionId: FACTION_A, status: 'living' },
        { id: 'c', factionId: FACTION_B, status: 'living' },
        { id: 'd', factionId: FACTION_B, status: 'living' },
      ],
      factions,
      primaryClaim: { a: [{ x: 1, y: 1 }, { x: 0, y: 1 }] },
      bannerMembershipHistoryBySettlementId: {
        a: Array(10).fill(FACTION_A),
      },
    }),
  )

  assert.ok(rgba)
  assert.strictEqual(rgba[4 * 4 + 3], 0)
  assert.ok(rgba[(1 * 3 + 0) * 4 + 3] > 0)
})

test('buildLoyaltyOverlayRgba returns null without claim cells', () => {
  assert.strictEqual(buildLoyaltyOverlayRgba({ gridWidth: 2, gridHeight: 2 }), null)
})
