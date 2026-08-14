import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FACTION_TERRITORY_UNALIGNED_RGB,
  factionTerritoryRgb,
} from './buildFactionTerritoryOverlayRgba.js'
import { factionNamesLegendRgb, drawFactionNamesLegend } from './drawFactionNamesLegend.js'

class FakeContainer {
  constructor() {
    this.children = []
    this.visible = true
  }
  addChild(child) {
    this.children.push(child)
    return child
  }
  removeChildren() {
    const removed = this.children
    this.children = []
    return removed
  }
}

class FakeGraphics {
  constructor() {
    /** @type {Record<string, Function>} */
    this.handlers = {}
  }
  roundRect() {
    return this
  }
  rect() {
    return this
  }
  fill() {
    return this
  }
  stroke() {
    return this
  }
  on(event, handler) {
    this.handlers[event] = handler
  }
  emit(event, payload = {}) {
    this.handlers[event]?.(payload)
  }
  destroy() {}
}

class FakeText {
  constructor(options = {}) {
    this.text = options.text ?? ''
    this.width = 40
    this.x = 0
    this.y = 0
    this.anchor = { set: () => {} }
    /** @type {Record<string, Function>} */
    this.handlers = {}
  }
  on(event, handler) {
    this.handlers[event] = handler
  }
  emit(event, payload = {}) {
    this.handlers[event]?.(payload)
  }
  destroy() {}
}

test('factionNamesLegendRgb uses ColorBrewer when faction controls two living pins', () => {
  const worldDocument = {
    factions: [
      {
        id: 'fa',
        status: 'active',
        capitalSettlementId: 'a',
        settlementIds: ['a', 'b'],
        territoryPaletteIndex: 3,
      },
    ],
    settlements: [
      { id: 'a', factionId: 'fa', status: 'living', population: 100 },
      { id: 'b', factionId: 'fa', status: 'living', population: 80 },
    ],
    softPowerPaintBySettlementId: {},
  }
  assert.deepEqual(
    factionNamesLegendRgb('fa', worldDocument),
    factionTerritoryRgb('fa', worldDocument.factions),
  )
})

test('factionNamesLegendRgb uses unaligned gray for singleton-control factions', () => {
  const worldDocument = {
    factions: [
      {
        id: 'solo',
        status: 'active',
        capitalSettlementId: 's',
        settlementIds: ['s'],
        territoryPaletteIndex: 11,
      },
    ],
    settlements: [{ id: 's', factionId: 'solo', status: 'living', population: 50 }],
    softPowerPaintBySettlementId: {},
  }
  assert.deepEqual(factionNamesLegendRgb('solo', worldDocument), [
    ...FACTION_TERRITORY_UNALIGNED_RGB,
  ])
})

test('drawFactionNamesLegend pointertap reports the faction id for unnamed rows', () => {
  const worldDocument = {
    factions: [
      {
        id: 'solo',
        status: 'active',
        capitalSettlementId: 's',
        settlementIds: ['s'],
        territoryPaletteIndex: 11,
      },
    ],
    settlements: [{ id: 's', factionId: 'solo', status: 'living', population: 50 }],
    softPowerPaintBySettlementId: {},
  }
  /** @type {object[]} */
  const edits = []
  const overlay = new FakeContainer()
  drawFactionNamesLegend(overlay, FakeGraphics, FakeText, {
    visible: true,
    worldDocument,
    namesByFactionId: {},
    screenWidth: 800,
    screenHeight: 600,
    onEdit: (payload) => edits.push(payload),
  })
  const label = overlay.children.find((child) => child instanceof FakeText)
  assert.ok(label)
  label.emit('pointertap', { stopPropagation() {} })
  assert.deepEqual(edits, [{ kind: 'faction', id: 'solo' }])
})
