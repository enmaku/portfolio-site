/**
 * Full-landmass PNG capture for campaign kit export.
 * Temporarily sizes the renderer to grid resolution, fits the world 1:1, reads pixels,
 * then restores host-driven resize and the author's pan/zoom.
 */

/**
 * @param {HTMLCanvasElement | { toBlob?: Function, convertToBlob?: Function }} canvas
 * @returns {Promise<Blob>}
 */
function canvasToPngBlob(canvas) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: 'image/png' })
  }
  if (typeof canvas.toBlob === 'function') {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
          return
        }
        reject(new Error('canvas.toBlob returned null'))
      }, 'image/png')
    })
  }
  return Promise.reject(new Error('Canvas cannot export a PNG blob'))
}

/**
 * @param {{
 *   app: {
 *     resizeTo: unknown,
 *     canvas: HTMLCanvasElement,
 *     resize?: () => void,
 *     renderer: { resize: (width: number, height: number) => void },
 *   },
 *   viewport: {
 *     scale: { x: number, y: number },
 *     center: { x: number, y: number },
 *     resize: (screenWidth: number, screenHeight: number, worldWidth: number, worldHeight: number) => void,
 *     fitWorld: (center?: boolean) => void,
 *     moveCenter: (x: number, y: number) => void,
 *   },
 *   hostEl: { clientWidth: number, clientHeight: number },
 *   worldWidth: number,
 *   worldHeight: number,
 *   renderFrame: () => void,
 *   suspendHostResize: () => void,
 *   resumeHostResize: () => void,
 * }} deps
 * @returns {Promise<Blob>}
 */
export async function captureWorldMapPng(deps) {
  const {
    app,
    viewport,
    hostEl,
    worldWidth,
    worldHeight,
    renderFrame,
    suspendHostResize,
    resumeHostResize,
  } = deps

  const previousResizeTo = app.resizeTo
  const previousScaleX = viewport.scale.x
  const previousScaleY = viewport.scale.y
  const previousCenterX = viewport.center.x
  const previousCenterY = viewport.center.y

  suspendHostResize()
  try {
    app.resizeTo = null
    app.renderer.resize(worldWidth, worldHeight)
    viewport.resize(worldWidth, worldHeight, worldWidth, worldHeight)
    viewport.fitWorld(false)
    viewport.moveCenter(worldWidth / 2, worldHeight / 2)
    renderFrame()
    return await canvasToPngBlob(app.canvas)
  } finally {
    app.resizeTo = previousResizeTo
    if (typeof app.resize === 'function') {
      app.resize()
    } else {
      app.renderer.resize(
        Math.max(1, hostEl.clientWidth),
        Math.max(1, hostEl.clientHeight),
      )
    }
    viewport.resize(
      Math.max(1, hostEl.clientWidth),
      Math.max(1, hostEl.clientHeight),
      worldWidth,
      worldHeight,
    )
    viewport.scale.x = previousScaleX
    viewport.scale.y = previousScaleY
    viewport.moveCenter(previousCenterX, previousCenterY)
    renderFrame()
    resumeHostResize()
  }
}
