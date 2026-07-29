import assert from 'node:assert/strict'
import test from 'node:test'
import { drawRecentConquestMarkers } from './drawMapNodeOverlays.js'
import {
  RECENT_CONQUEST_ICON_ARM,
  RECENT_CONQUEST_ICON_COLOR,
  SETTLEMENT_ID_LABEL_GAP_X,
  SETTLEMENT_PIN_RADIUS_CAPITAL,
} from './settlementNodeMarkers.js'

function fakeGraphics() {
  /** @type {Array<{ color: number | null, path: Array<{ x: number, y: number }> }>} */
  const strokes = []
  /** @type {Array<{ x: number, y: number }>} */
  let path = []
  return {
    strokes,
    clear() {
      strokes.length = 0
      path = []
    },
    moveTo(x, y) {
      path = [{ x, y }]
    },
    lineTo(x, y) {
      path.push({ x, y })
    },
    stroke({ color } = {}) {
      strokes.push({ color: typeof color === 'number' ? color : null, path: [...path] })
      path = []
    },
  }
}

test('drawRecentConquestMarkers strokes crossed swords only for last-epoch conquests when faction overlay is on', () => {
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
    /** @type {any} */ (worldDocument),
    { factionTerritory: true, settlements: true },
  )

  const yellow = overlay.strokes.filter((stroke) => stroke.color === RECENT_CONQUEST_ICON_COLOR)
  assert.equal(yellow.length, 1)
  const expectedCx = 2 + 0.5 + SETTLEMENT_PIN_RADIUS_CAPITAL + SETTLEMENT_ID_LABEL_GAP_X + 4
  const expectedCy = 3 + 0.5
  // Fake Graphics keeps only the last subpath; second diagonal ends at (+arm, -arm).
  const end = yellow[0].path.at(-1)
  assert.ok(end)
  assert.ok(
    Math.hypot(end.x - (expectedCx + RECENT_CONQUEST_ICON_ARM), end.y - (expectedCy - RECENT_CONQUEST_ICON_ARM)) <
      0.01,
  )
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
    /** @type {any} */ (worldDocument),
    { factionTerritory: true, settlements: true },
  )
  assert.ok(overlay.strokes.length > 0)

  drawRecentConquestMarkers(
    /** @type {any} */ (overlay),
    /** @type {any} */ (worldDocument),
    { factionTerritory: false, settlements: true },
  )
  assert.equal(overlay.strokes.length, 0)
})
