import assert from 'node:assert/strict'
import test from 'node:test'
import { attachLandingPlacementControls } from './attachLandingPlacementControls.js'

test('landing overlay updates request a synchronous render commit', () => {
  let renderCount = 0
  const viewport = {
    eventMode: 'static',
    scale: { x: 2, y: 2 },
    addChild() {},
    on() {},
  }
  const hostEl = { style: {} }

  class Graphics {
    clear() {}
    circle() {}
    moveTo() {}
    lineTo() {}
    stroke() {}
    fill() {}
    setFillStyle() {}
    rect() {}
  }

  const controls = attachLandingPlacementControls({
    Graphics,
    viewport,
    hostEl,
    getWorldDocument: () => ({
      gridWidth: 4,
      gridHeight: 4,
      fields: { elevation: new Float32Array(16) },
      lakeMask: new Uint8Array(16),
      generationReport: { largestSailComponentCellCount: 4 },
    }),
    requestRender: () => {
      renderCount += 1
    },
  })

  controls.setLandingPlacementMode(true)
  assert.equal(renderCount, 0)

  controls.setFoundingLandingMarker({ x: 1, y: 2 })
  assert.equal(renderCount, 1)

  controls.setHaulShedPreviewCells([{ x: 1, y: 2 }])
  assert.equal(renderCount, 2)

  controls.setFoundingLandingMarker(null)
  assert.equal(renderCount, 3)

  controls.setHaulShedPreviewCells([])
  assert.equal(renderCount, 4)
})
