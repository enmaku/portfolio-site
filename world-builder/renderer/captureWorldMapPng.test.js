import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { captureWorldMapPng } from './captureWorldMapPng.js'

describe('captureWorldMapPng', () => {
  it('resizes to world pixels, exports png, then restores transform and host size', async () => {
    const resizeCalls = []
    const viewportResizes = []
    let suspended = false
    let resumed = false
    let renderCount = 0

    const app = {
      resizeTo: 'host',
      canvas: {
        toBlob(callback, type) {
          callback(new Blob(['png-bytes'], { type: type || 'image/png' }))
        },
      },
      resize() {
        resizeCalls.push('app.resize')
      },
      renderer: {
        resize(width, height) {
          resizeCalls.push({ width, height })
        },
      },
    }

    const viewport = {
      scale: { x: 2.5, y: 2.5 },
      center: { x: 12, y: 34 },
      resize(screenWidth, screenHeight, worldWidth, worldHeight) {
        viewportResizes.push({ screenWidth, screenHeight, worldWidth, worldHeight })
      },
      fitWorld() {
        this.scale = { x: 1, y: 1 }
      },
      moveCenter(x, y) {
        this.center = { x, y }
      },
    }

    const hostEl = { clientWidth: 400, clientHeight: 300 }

    const blob = await captureWorldMapPng({
      app,
      viewport,
      hostEl,
      worldWidth: 64,
      worldHeight: 48,
      renderFrame() {
        renderCount += 1
      },
      suspendHostResize() {
        suspended = true
      },
      resumeHostResize() {
        resumed = true
      },
    })

    assert.equal(blob.type, 'image/png')
    assert.equal(suspended, true)
    assert.equal(resumed, true)
    assert.equal(app.resizeTo, 'host')
    assert.deepEqual(viewport.scale, { x: 2.5, y: 2.5 })
    assert.deepEqual(viewport.center, { x: 12, y: 34 })
    assert.ok(resizeCalls.some((call) => call.width === 64 && call.height === 48))
    assert.ok(viewportResizes.some((call) => call.screenWidth === 64 && call.screenHeight === 48))
    assert.ok(
      viewportResizes.some(
        (call) => call.screenWidth === 400 && call.screenHeight === 300 && call.worldWidth === 64,
      ),
    )
    assert.ok(renderCount >= 2)
    assert.ok(resizeCalls.includes('app.resize'))
  })
})
