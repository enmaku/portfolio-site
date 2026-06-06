const DEFAULT_THRESHOLD_PX = 4

/**
 * @param {number} deltaX
 * @param {number} deltaY
 * @param {number} thresholdPx
 * @returns {boolean}
 */
function isPastDragThreshold(deltaX, deltaY, thresholdPx) {
  return Math.abs(deltaX) > thresholdPx || Math.abs(deltaY) > thresholdPx
}

/**
 * @param {{
 *   getScrollEl: () => { scrollTop: number, scrollLeft: number } | null
 *   axis?: 'y' | 'both'
 *   thresholdPx?: number
 *   scrollBeforeThreshold?: boolean
 *   shouldBegin?: (event: { pointerType?: string, button?: number }) => boolean
 *   onActiveChange?: (active: boolean) => void
 * }} options
 */
export function createPointerDragScrollController(options) {
  const axis = options.axis ?? 'y'
  const thresholdPx = options.thresholdPx ?? DEFAULT_THRESHOLD_PX
  const scrollBeforeThreshold = options.scrollBeforeThreshold ?? false
  const shouldBegin = options.shouldBegin ?? (() => true)
  const onActiveChange = options.onActiveChange ?? (() => {})

  let active = false
  let panMoved = false
  let suppressClickOnPan = false
  let startX = 0
  let startY = 0
  let startScrollTop = 0
  let startScrollLeft = 0

  function setActive(nextActive) {
    if (active === nextActive) return
    active = nextActive
    onActiveChange(nextActive)
  }

  /**
   * @param {{ clientX: number, clientY: number, pointerId: number }} event
   * @param {{ captureEl: { setPointerCapture?: (id: number) => void } | null, suppressClickOnPan?: boolean }} dragOptions
   */
  function beginDrag(event, dragOptions) {
    if (!shouldBegin(event)) return

    const scrollEl = options.getScrollEl()
    const captureEl = dragOptions.captureEl
    if (!scrollEl || !captureEl) return

    setActive(true)
    panMoved = false
    suppressClickOnPan = dragOptions.suppressClickOnPan === true
    startX = event.clientX
    startY = event.clientY
    startScrollTop = scrollEl.scrollTop
    startScrollLeft = scrollEl.scrollLeft

    if (typeof captureEl.setPointerCapture === 'function') {
      captureEl.setPointerCapture(event.pointerId)
    }
  }

  /** @param {{ clientX: number, clientY: number }} event */
  function onMove(event) {
    if (!active) return

    const scrollEl = options.getScrollEl()
    if (!scrollEl) return

    const deltaX = event.clientX - startX
    const deltaY = event.clientY - startY
    const pastThreshold = isPastDragThreshold(deltaX, deltaY, thresholdPx)

    if (pastThreshold) {
      panMoved = true
    }

    if (!scrollBeforeThreshold && !pastThreshold) return

    if (axis === 'both') {
      scrollEl.scrollLeft = startScrollLeft - deltaX
      scrollEl.scrollTop = startScrollTop - deltaY
      return
    }

    scrollEl.scrollTop = startScrollTop - deltaY
  }

  function onEnd() {
    if (!active) return

    setActive(false)

    if (panMoved && !suppressClickOnPan) {
      panMoved = false
    }
  }

  /** @returns {boolean} */
  function consumePanClick() {
    if (!panMoved || !suppressClickOnPan) return false

    panMoved = false
    suppressClickOnPan = false
    return true
  }

  return {
    beginDrag,
    onMove,
    onEnd,
    consumePanClick,
  }
}

/**
 * @param {{ pointerType?: string, button?: number }} event
 * @returns {boolean}
 */
export function filterMousePrimaryButton(event) {
  return event.pointerType === 'mouse' && event.button === 0
}
