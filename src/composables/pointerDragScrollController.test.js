import assert from 'node:assert/strict'
import test from 'node:test'
import { createPointerDragScrollController } from './pointerDragScrollController.js'

function createScrollEl() {
  return {
    scrollTop: 100,
    scrollLeft: 50,
  }
}

function createCaptureEl() {
  return {
    capturedPointerId: null,
    setPointerCapture(pointerId) {
      this.capturedPointerId = pointerId
    },
  }
}

function createEvent(overrides = {}) {
  return {
    clientX: 0,
    clientY: 0,
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    ...overrides,
  }
}

test('background-origin pan clears stale panMoved on end', () => {
  const scrollEl = createScrollEl()
  const controller = createPointerDragScrollController({
    getScrollEl: () => scrollEl,
    axis: 'y',
    scrollBeforeThreshold: false,
  })

  controller.beginDrag(createEvent({ clientX: 10, clientY: 10 }), {
    captureEl: createCaptureEl(),
    suppressClickOnPan: false,
  })
  controller.onMove(createEvent({ clientX: 10, clientY: 20 }))
  controller.onEnd()

  assert.equal(controller.consumePanClick(), false)
})

test('card-origin pan suppresses the next click once', () => {
  const scrollEl = createScrollEl()
  const controller = createPointerDragScrollController({
    getScrollEl: () => scrollEl,
    axis: 'y',
    scrollBeforeThreshold: false,
  })

  controller.beginDrag(createEvent({ clientX: 10, clientY: 10 }), {
    captureEl: createCaptureEl(),
    suppressClickOnPan: true,
  })
  controller.onMove(createEvent({ clientX: 10, clientY: 20 }))
  controller.onEnd()

  assert.equal(controller.consumePanClick(), true)
  assert.equal(controller.consumePanClick(), false)
})

test('sub-threshold movement does not suppress click', () => {
  const scrollEl = createScrollEl()
  const controller = createPointerDragScrollController({
    getScrollEl: () => scrollEl,
    axis: 'y',
    scrollBeforeThreshold: false,
  })

  controller.beginDrag(createEvent({ clientX: 10, clientY: 10 }), {
    captureEl: createCaptureEl(),
    suppressClickOnPan: true,
  })
  controller.onMove(createEvent({ clientX: 10, clientY: 12 }))
  controller.onEnd()

  assert.equal(controller.consumePanClick(), false)
})

test('both-axis scroll updates before threshold when scrollBeforeThreshold is true', () => {
  const scrollEl = createScrollEl()
  const controller = createPointerDragScrollController({
    getScrollEl: () => scrollEl,
    axis: 'both',
    scrollBeforeThreshold: true,
  })

  controller.beginDrag(createEvent({ clientX: 20, clientY: 30 }), {
    captureEl: createCaptureEl(),
    suppressClickOnPan: true,
  })
  controller.onMove(createEvent({ clientX: 22, clientY: 31 }))

  assert.equal(scrollEl.scrollLeft, 48)
  assert.equal(scrollEl.scrollTop, 99)
  assert.equal(controller.consumePanClick(), false)
})

test('y-axis scroll waits for threshold when scrollBeforeThreshold is false', () => {
  const scrollEl = createScrollEl()
  const controller = createPointerDragScrollController({
    getScrollEl: () => scrollEl,
    axis: 'y',
    scrollBeforeThreshold: false,
  })

  controller.beginDrag(createEvent({ clientX: 10, clientY: 10 }), {
    captureEl: createCaptureEl(),
    suppressClickOnPan: false,
  })
  controller.onMove(createEvent({ clientX: 10, clientY: 12 }))

  assert.equal(scrollEl.scrollTop, 100)

  controller.onMove(createEvent({ clientX: 10, clientY: 20 }))

  assert.equal(scrollEl.scrollTop, 90)
})

test('shouldBegin gate blocks drag start', () => {
  const scrollEl = createScrollEl()
  const controller = createPointerDragScrollController({
    getScrollEl: () => scrollEl,
    shouldBegin: () => false,
  })

  controller.beginDrag(createEvent(), {
    captureEl: createCaptureEl(),
    suppressClickOnPan: true,
  })
  controller.onMove(createEvent({ clientX: 0, clientY: 20 }))

  assert.equal(scrollEl.scrollTop, 100)
  assert.equal(controller.consumePanClick(), false)
})
