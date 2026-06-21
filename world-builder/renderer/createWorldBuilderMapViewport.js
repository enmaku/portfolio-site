import { biomeIndicesToRgba } from './biomeIndicesToRgba.js'

/**
 * @param {HTMLElement} hostEl
 * @param {import('../core/types.js').WorldDocument} worldDocument
 */
export async function createWorldBuilderMapViewport(hostEl, worldDocument) {
  const { Application, Sprite, Texture } = await import('pixi.js')
  const { Viewport } = await import('pixi-viewport')

  const app = new Application()
  await app.init({
    background: '#0d1117',
    resizeTo: hostEl,
    antialias: false,
  })
  hostEl.replaceChildren(app.canvas)

  const { gridWidth, gridHeight } = worldDocument
  let terrainCanvas = buildTerrainCanvas(worldDocument)
  let terrainTexture = Texture.from(terrainCanvas)
  const terrain = new Sprite(terrainTexture)

  const viewport = new Viewport({
    screenWidth: hostEl.clientWidth || gridWidth,
    screenHeight: hostEl.clientHeight || gridHeight,
    worldWidth: gridWidth,
    worldHeight: gridHeight,
    events: app.renderer.events,
  })

  app.stage.addChild(viewport)
  viewport.addChild(terrain)
  viewport
    .drag()
    .pinch()
    .wheel({ smooth: 3 })
    .decelerate()
    .clampZoom({ minScale: 0.5, maxScale: 24 })

  viewport.moveCenter(gridWidth / 2, gridHeight / 2)

  return {
    /** @param {import('../core/types.js').WorldDocument} nextDocument */
    updateWorldDocument(nextDocument) {
      terrainTexture.destroy(true)
      terrainCanvas = buildTerrainCanvas(nextDocument)
      terrainTexture = Texture.from(terrainCanvas)
      terrain.texture = terrainTexture
      viewport.moveCenter(nextDocument.gridWidth / 2, nextDocument.gridHeight / 2)
    },
    destroy() {
      terrainTexture.destroy(true)
      viewport.destroy({ children: true })
      app.destroy(true, { children: true, texture: true })
    },
  }
}

/**
 * @param {import('../core/types.js').WorldDocument} worldDocument
 */
function buildTerrainCanvas(worldDocument) {
  const { gridWidth, gridHeight } = worldDocument
  const rgba = biomeIndicesToRgba(worldDocument)
  const canvas = document.createElement('canvas')
  canvas.width = gridWidth
  canvas.height = gridHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context for terrain texture')
  }
  ctx.putImageData(new ImageData(rgba, gridWidth, gridHeight), 0, 0)
  return canvas
}
