import assert from 'node:assert/strict'
import test from 'node:test'
import { drawRecentConquestMarkers } from './drawMapNodeOverlays.js'
import {
  RECENT_ALLIANCE_ICON_COLOR,
  RECENT_ALLIANCE_ICON_OUTLINE_COLOR,
  RECENT_CONQUEST_ICON_COLOR,
  RECENT_CONQUEST_ICON_OUTLINE_COLOR,
  RECENT_CONQUEST_SWORDS_PATH_D,
  SETTLEMENT_ID_LABEL_GAP_X,
  SETTLEMENT_PIN_RADIUS_CAPITAL,
  TRADE_PARTNER_ICON_COLOR,
  TRADE_PARTNER_ICON_OUTLINE_COLOR,
  TRADE_PARTNER_SACK_PATH_D,
} from './settlementNodeMarkers.js'

class FakeGraphicsPath {
  /**
   * @param {string} d
   */
  constructor(d) {
    this.d = d
  }
}

function fakeGraphics() {
  /** @type {Array<{ color: number | null, kind: 'fill' | 'stroke' }>} */
  const paints = []
  /** @type {FakeGraphicsPath[]} */
  const paths = []
  /** @type {number[][]} */
  const transforms = []
  return {
    paints,
    paths,
    transforms,
    clear() {
      paints.length = 0
      paths.length = 0
      transforms.length = 0
    },
    save() {},
    restore() {},
    setTransform(...args) {
      transforms.push(args.map(Number))
    },
    path(path) {
      paths.push(path)
    },
    stroke({ color } = {}) {
      paints.push({ color: typeof color === 'number' ? color : null, kind: 'stroke' })
    },
    fill({ color } = {}) {
      paints.push({ color: typeof color === 'number' ? color : null, kind: 'fill' })
    },
  }
}

test('drawRecentConquestMarkers draws swords SVG path only for last-epoch conquests when faction overlay is on', () => {
  const overlay = fakeGraphics()
  const worldDocument = {
    epoch: 12,
    settlements: [
      { id: 'fresh', x: 2, y: 3, status: 'living', factionId: 'fa' },
      { id: 'stale', x: 5, y: 3, status: 'living', factionId: 'fa' },
      { id: 'ruin', x: 8, y: 3, status: 'ruin', factionId: 'fa' },
    ],
    factions: [{ id: 'fa', capitalSettlementId: 'fresh', status: 'active' }],
    recentConquestBySettlementId: {
      fresh: { conqueredEpoch: 12 },
      stale: { conqueredEpoch: 10 },
      ruin: { conqueredEpoch: 12 },
    },
  }

  drawRecentConquestMarkers(
    /** @type {any} */ (overlay),
    /** @type {any} */ (FakeGraphicsPath),
    /** @type {any} */ (worldDocument),
    { factionTerritory: true, settlements: true },
  )

  assert.ok(overlay.paths.every((path) => path.d === RECENT_CONQUEST_SWORDS_PATH_D))
  assert.ok(overlay.paths.length >= 2)
  const fills = overlay.paints.filter((paint) => paint.kind === 'fill')
  const strokes = overlay.paints.filter((paint) => paint.kind === 'stroke')
  assert.equal(fills.length, 1)
  assert.equal(fills[0].color, RECENT_CONQUEST_ICON_COLOR)
  assert.equal(strokes.length, 1)
  assert.equal(strokes[0].color, RECENT_CONQUEST_ICON_OUTLINE_COLOR)
  assert.equal(overlay.transforms.length, 1)
  // fresh is the faction capital → left edge at pin + capital radius + gap
  const expectedLeft = 2 + 0.5 + SETTLEMENT_PIN_RADIUS_CAPITAL + SETTLEMENT_ID_LABEL_GAP_X
  const [, , , , tx] = overlay.transforms[0]
  assert.ok(Number.isFinite(tx))
  assert.ok(tx < expectedLeft + 12)
  assert.ok(tx > expectedLeft - 12)
})

test('drawRecentConquestMarkers clears when faction territory overlay is off', () => {
  const overlay = fakeGraphics()
  const worldDocument = {
    epoch: 4,
    settlements: [{ id: 'fresh', x: 1, y: 1, status: 'living' }],
    factions: [],
    recentConquestBySettlementId: { fresh: { conqueredEpoch: 4 } },
  }

  drawRecentConquestMarkers(
    /** @type {any} */ (overlay),
    /** @type {any} */ (FakeGraphicsPath),
    /** @type {any} */ (worldDocument),
    { factionTerritory: true, settlements: true },
  )
  assert.ok(overlay.paints.length > 0)

  drawRecentConquestMarkers(
    /** @type {any} */ (overlay),
    /** @type {any} */ (FakeGraphicsPath),
    /** @type {any} */ (worldDocument),
    { factionTerritory: false, settlements: true },
  )
  assert.equal(overlay.paints.length, 0)
})

test('drawRecentConquestMarkers keeps sack for living trade partners across epochs', () => {
  const overlay = fakeGraphics()
  const worldDocument = {
    epoch: 40,
    settlements: [
      {
        id: 'tp',
        x: 2,
        y: 3,
        status: 'living',
        factionId: 'fa',
        isTradePartner: true,
        population: 50,
      },
      {
        id: 'member',
        x: 5,
        y: 3,
        status: 'living',
        factionId: 'fa',
        isTradePartner: false,
        population: 80,
      },
    ],
    factions: [
      {
        id: 'fa',
        capitalSettlementId: 'member',
        settlementIds: ['member', 'tp'],
        status: 'active',
      },
    ],
    recentConquestBySettlementId: {},
  }

  drawRecentConquestMarkers(
    /** @type {any} */ (overlay),
    /** @type {any} */ (FakeGraphicsPath),
    /** @type {any} */ (worldDocument),
    { factionTerritory: true, settlements: true },
  )

  assert.ok(overlay.paths.every((path) => path.d === TRADE_PARTNER_SACK_PATH_D))
  assert.ok(overlay.paths.length >= 2)
  const fills = overlay.paints.filter((paint) => paint.kind === 'fill')
  const strokes = overlay.paints.filter((paint) => paint.kind === 'stroke')
  assert.equal(fills.length, 1)
  assert.equal(fills[0].color, TRADE_PARTNER_ICON_COLOR)
  assert.equal(strokes.length, 1)
  assert.equal(strokes[0].color, TRADE_PARTNER_ICON_OUTLINE_COLOR)
})

test('drawRecentConquestMarkers draws handshake for alliance-epoch pins and culls after TTL', () => {
  const overlay = fakeGraphics()
  const worldDocument = {
    epoch: 20,
    settlements: [
      { id: 'fresh', x: 2, y: 3, status: 'living', factionId: 'fa', vassalLiegeSettlementId: 'cap' },
      { id: 'stale', x: 5, y: 3, status: 'living', factionId: 'fa' },
      { id: 'ruin', x: 8, y: 3, status: 'ruin', factionId: 'fa' },
    ],
    factions: [
      {
        id: 'fa',
        capitalSettlementId: 'cap',
        settlementIds: ['cap', 'fresh', 'stale'],
        status: 'active',
      },
    ],
    recentAllianceBySettlementId: {
      fresh: { allianceEpoch: 20, factionId: 'fa', kind: 'join_existing' },
      stale: { allianceEpoch: 18, factionId: 'fa', kind: 'join_existing' },
      ruin: { allianceEpoch: 20, factionId: 'fa', kind: 'peer_mint' },
    },
  }

  drawRecentConquestMarkers(
    /** @type {any} */ (overlay),
    /** @type {any} */ (FakeGraphicsPath),
    /** @type {any} */ (worldDocument),
    { factionTerritory: true, settlements: true },
  )

  const fills = overlay.paints.filter((paint) => paint.kind === 'fill')
  const strokes = overlay.paints.filter((paint) => paint.kind === 'stroke')
  assert.equal(fills.length, 1)
  assert.equal(fills[0].color, RECENT_ALLIANCE_ICON_COLOR)
  assert.equal(strokes.length, 1)
  assert.equal(strokes[0].color, RECENT_ALLIANCE_ICON_OUTLINE_COLOR)
  const fillIndex = overlay.paints.findIndex((paint) => paint.kind === 'fill')
  const strokeIndex = overlay.paints.findIndex((paint) => paint.kind === 'stroke')
  assert.ok(strokeIndex < fillIndex, 'alliance outline paints under fill like swords')
  assert.ok(overlay.paths.length >= 2)

  worldDocument.epoch = 21
  drawRecentConquestMarkers(
    /** @type {any} */ (overlay),
    /** @type {any} */ (FakeGraphicsPath),
    /** @type {any} */ (worldDocument),
    { factionTerritory: true, settlements: true },
  )
  assert.equal(
    overlay.paints.filter((paint) => paint.kind === 'fill').length,
    0,
    'handshake culled once epoch advances past alliance TTL',
  )
})
