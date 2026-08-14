import assert from 'node:assert/strict'
import test from 'node:test'
import { drawSettlementIdLabels } from './drawMapNodeOverlays.js'

class FakeContainer {
  constructor() {
    this.children = []
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

class FakeText {
  constructor(options = {}) {
    this.text = options.text ?? ''
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

function worldDocument() {
  return {
    factions: [],
    settlements: [
      { id: 's1', x: 1, y: 1, mapNumber: 1, status: 'living', population: 100 },
      { id: 's2', x: 4, y: 4, mapNumber: 2, status: 'ruin', population: 0 },
    ],
  }
}

test('drawSettlementIdLabels draws fallback labels when the names overlay is on and the catalog is empty', () => {
  const overlay = new FakeContainer()
  drawSettlementIdLabels(overlay, FakeText, worldDocument(), false, {
    customNamesVisible: true,
    customNamesBySettlementId: {},
  })
  assert.deepEqual(
    overlay.children.map((child) => child.text),
    ['#1', '#2'],
  )
})

test('drawSettlementIdLabels pointertap reports the settlement id for named and fallback labels', () => {
  /** @type {object[]} */
  const edits = []
  const overlay = new FakeContainer()
  drawSettlementIdLabels(overlay, FakeText, worldDocument(), false, {
    customNamesVisible: true,
    customNamesBySettlementId: { s1: 'Valen' },
    onEdit: (payload) => edits.push(payload),
  })
  overlay.children[0].emit('pointertap', { stopPropagation() {} })
  overlay.children[1].emit('pointertap', { stopPropagation() {} })
  assert.deepEqual(edits, [
    { kind: 'settlement', id: 's1' },
    { kind: 'settlement', id: 's2' },
  ])
})
