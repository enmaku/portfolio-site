import assert from 'node:assert/strict'
import test from 'node:test'
import { drawRecentConquestMarkers } from './drawMapNodeOverlays.js'
import {
  RECENT_CONQUEST_ICON_COLOR,
  RECENT_CONQUEST_ICON_LIGATURE,
  SETTLEMENT_ID_LABEL_GAP_X,
  SETTLEMENT_PIN_RADIUS_CAPITAL,
} from './settlementNodeMarkers.js'

class FakeText {
  /**
   * @param {{ text?: string, style?: { fill?: number } }} [options]
   */
  constructor(options = {}) {
    this.text = options.text ?? ''
    this.style = options.style ?? {}
    this.x = 0
    this.y = 0
    this.anchor = { set() {} }
  }
  destroy() {}
}

function fakeOverlay() {
  /** @type {FakeText[]} */
  const children = []
  return {
    children,
    addChild(child) {
      children.push(child)
    },
    removeChildren() {
      const removed = [...children]
      children.length = 0
      return removed
    },
  }
}

test('drawRecentConquestMarkers shows swords only for last-epoch conquests when faction overlay is on', () => {
  const overlay = fakeOverlay()
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
    /** @type {any} */ (FakeText),
    /** @type {any} */ (worldDocument),
    { factionTerritory: true, settlements: true },
  )

  assert.equal(overlay.children.length, 1)
  assert.equal(overlay.children[0].text, RECENT_CONQUEST_ICON_LIGATURE)
  assert.equal(overlay.children[0].style.fill, RECENT_CONQUEST_ICON_COLOR)
  // fresh is the faction capital → capital pin radius
  assert.equal(
    overlay.children[0].x,
    2 + 0.5 + SETTLEMENT_PIN_RADIUS_CAPITAL + SETTLEMENT_ID_LABEL_GAP_X,
  )
  assert.equal(overlay.children[0].y, 3 + 0.5)
})

test('drawRecentConquestMarkers clears when faction territory overlay is off', () => {
  const overlay = fakeOverlay()
  const worldDocument = {
    epoch: 4,
    settlements: [{ id: 'fresh', x: 1, y: 1, status: 'living' }],
    recentConquestBySettlementId: { fresh: { conqueredEpoch: 4 } },
  }

  drawRecentConquestMarkers(
    /** @type {any} */ (overlay),
    /** @type {any} */ (FakeText),
    /** @type {any} */ (worldDocument),
    { factionTerritory: true, settlements: true },
  )
  assert.equal(overlay.children.length, 1)

  drawRecentConquestMarkers(
    /** @type {any} */ (overlay),
    /** @type {any} */ (FakeText),
    /** @type {any} */ (worldDocument),
    { factionTerritory: false, settlements: true },
  )
  assert.equal(overlay.children.length, 0)
})
