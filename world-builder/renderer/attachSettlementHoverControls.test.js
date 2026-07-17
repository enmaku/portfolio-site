import assert from 'node:assert/strict'
import test from 'node:test'
import { attachSettlementHoverControls } from './attachSettlementHoverControls.js'
import { SETTLEMENT_NODE_MARKER_RADIUS } from './settlementNodeMarkers.js'

/**
 * @param {{
 *   worldX: number,
 *   worldY: number,
 *   clientX?: number,
 *   clientY?: number,
 * }} coords
 */
function fakePointerEvent(coords) {
  return {
    clientX: coords.clientX ?? 0,
    clientY: coords.clientY ?? 0,
    getLocalPosition() {
      return { x: coords.worldX, y: coords.worldY }
    },
  }
}

function createHarness(worldDocument) {
  /** @type {Record<string, (...args: unknown[]) => void>} */
  const handlers = {}
  const viewport = {
    eventMode: 'static',
    on(event, handler) {
      handlers[event] = handler
    },
  }
  const controls = attachSettlementHoverControls({
    viewport,
    getWorldDocument: () => worldDocument,
  })
  return { controls, handlers }
}

test('pointermove over a living settlement emits its id to onSettlementHover', () => {
  const { controls, handlers } = createHarness({
    settlements: [{ id: 'living-1', x: 10, y: 20, status: 'active' }],
  })
  /** @type {Array<{ settlementId: string, clientX: number, clientY: number } | null>} */
  const emissions = []
  controls.onSettlementHover((payload) => {
    emissions.push(payload)
  })

  handlers.pointermove(
    fakePointerEvent({
      worldX: 10.5,
      worldY: 20.5,
      clientX: 120,
      clientY: 340,
    }),
  )

  assert.deepEqual(emissions.at(-1), {
    settlementId: 'living-1',
    clientX: 120,
    clientY: 340,
  })
  assert.ok(SETTLEMENT_NODE_MARKER_RADIUS > 0)
})

test('pointermove over a ruin does not emit a settlement hover id', () => {
  const { controls, handlers } = createHarness({
    settlements: [{ id: 'ruin-1', x: 10, y: 20, status: 'ruin' }],
  })
  /** @type {Array<{ settlementId: string, clientX: number, clientY: number } | null>} */
  const emissions = []
  controls.onSettlementHover((payload) => {
    emissions.push(payload)
  })

  handlers.pointermove(
    fakePointerEvent({
      worldX: 10.5,
      worldY: 20.5,
      clientX: 120,
      clientY: 340,
    }),
  )

  assert.equal(emissions.at(-1), null)
})
