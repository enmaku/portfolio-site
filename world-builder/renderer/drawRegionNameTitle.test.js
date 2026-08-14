import assert from 'node:assert/strict'
import test from 'node:test'
import { drawRegionNameTitle } from './drawRegionNameTitle.js'

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
    this.rects = []
  }
  roundRect(x, y, width, height) {
    this.rects.push({ x, y, width, height })
    return this
  }
  fill() {
    return this
  }
  stroke() {
    return this
  }
  destroy() {}
}

class FakeText {
  constructor(options = {}) {
    this.text = options.text ?? ''
    this.width = this.text.length * 10
    this.height = 20
    this.x = 0
    this.y = 0
    this.anchor = { set: () => {} }
  }
  destroy() {}
}

test('drawRegionNameTitle hides the overlay when no region name is set', () => {
  const overlay = new FakeContainer()
  drawRegionNameTitle(overlay, FakeGraphics, FakeText, {
    visible: true,
    regionName: '   ',
    screenWidth: 800,
  })
  assert.equal(overlay.visible, false)
  assert.equal(overlay.children.length, 0)
})

test('drawRegionNameTitle hides the overlay when the names overlay is off', () => {
  const overlay = new FakeContainer()
  drawRegionNameTitle(overlay, FakeGraphics, FakeText, {
    visible: false,
    regionName: 'Valen Reach',
    screenWidth: 800,
  })
  assert.equal(overlay.visible, false)
  assert.equal(overlay.children.length, 0)
})

test('drawRegionNameTitle centers the title panel horizontally', () => {
  const overlay = new FakeContainer()
  drawRegionNameTitle(overlay, FakeGraphics, FakeText, {
    visible: true,
    regionName: 'Valen',
    screenWidth: 800,
  })
  const [panel, label] = overlay.children
  const rect = panel.rects[0]
  assert.equal(overlay.visible, true)
  assert.equal(rect.x + rect.width / 2, 400)
  assert.equal(label.x, 400)
})

test('drawRegionNameTitle clears prior children before redrawing', () => {
  const overlay = new FakeContainer()
  const options = { visible: true, regionName: 'Valen', screenWidth: 800 }
  drawRegionNameTitle(overlay, FakeGraphics, FakeText, options)
  drawRegionNameTitle(overlay, FakeGraphics, FakeText, options)
  assert.equal(overlay.children.length, 2)
})
