import { mineralNodeOverlayColor } from './worldBuilderMapViewportModel.js'

/** Drawn size of metal/salt deposit icons in world/grid units. */
export const STRATEGIC_RESOURCE_NODE_ICON_SIZE = 18

/** MDI viewBox width/height (mdiGold, mdiDiamondStone, mdiShaker). */
export const STRATEGIC_RESOURCE_ICON_VIEWBOX = 24

/** Thin black outline so icons stay readable on the metals raster. */
export const STRATEGIC_RESOURCE_ICON_OUTLINE_COLOR = 0x000000

/** Outline width in world/grid units (÷scale inside the draw transform). */
export const STRATEGIC_RESOURCE_ICON_OUTLINE_WIDTH = 1.2

/**
 * MDI `mdiGold` path `d` (viewBox 0 0 24 24) — copper/silver/gold stamps.
 * Apache-2.0 — https://github.com/Templarian/MaterialDesign
 */
export const MINERAL_INGOT_PATH_D =
  'M1 22L2.5 17H9.5L11 22H1M13 22L14.5 17H21.5L23 22H13M6 15L7.5 10H14.5L16 15H6M23 6.05L19.14 7.14L18.05 11L16.96 7.14L13.1 6.05L16.96 4.96L18.05 1.1L19.14 4.96L23 6.05Z'

/**
 * MDI `mdiDiamondStone` path `d` (viewBox 0 0 24 24).
 * Apache-2.0 — https://github.com/Templarian/MaterialDesign
 */
export const MINERAL_DIAMOND_PATH_D =
  'M16,9H19L14,16M10,9H14L12,17M5,9H8L10,16M15,4H17L19,7H16M11,4H13L14,7H10M7,4H9L8,7H5M6,2L2,8L12,22L22,8L18,2H6Z'

/**
 * MDI `mdiShaker` path `d` (viewBox 0 0 24 24).
 * Apache-2.0 — https://github.com/Templarian/MaterialDesign
 */
export const SALT_SHAKER_PATH_D =
  'M7 16C7 16.55 6.55 17 6 17S5 16.55 5 16C5 15.45 5.45 15 6 15S7 15.45 7 16M9 16C8.45 16 8 16.45 8 17S8.45 18 9 18 10 17.55 10 17 9.55 16 9 16M4 18C3.45 18 3 18.45 3 19S3.45 20 4 20 5 19.55 5 19 4.55 18 4 18M7 19C6.45 19 6 19.45 6 20S6.45 21 7 21 8 20.55 8 20 7.55 19 7 19M15.33 2.72L9.8 9.65L13.34 13.19L20.28 7.67C21.18 6.91 21.25 5.54 20.41 4.7L18.3 2.59C17.46 1.75 16.09 1.82 15.33 2.72M8.39 12.5L10.5 14.6C10.9 15 11.54 15 11.93 14.6L12.63 13.9L9.1 10.36L8.39 11.07C8 11.46 8 12.09 8.39 12.5Z'

/** Salt pin fill — matches realm-economy / tooltip `saltIcon` (#E8ECF0). */
export const SALT_NODE_OVERLAY_COLOR = 0xe8ecf0

/**
 * @param {import('../core/types.js').MineralKind | undefined} kind
 * @returns {string}
 */
export function mineralDepositIconPathD(kind) {
  return kind === 'diamond' ? MINERAL_DIAMOND_PATH_D : MINERAL_INGOT_PATH_D
}

/**
 * Draw a centered MDI stamp at `(cx, cy)` (stroke then fill).
 *
 * @param {import('pixi.js').Graphics} graphics
 * @param {number} cx
 * @param {number} cy
 * @param {string} pathD
 * @param {number} fillColor
 * @param {typeof import('pixi.js').GraphicsPath} GraphicsPathCtor
 */
export function drawStrategicResourceIcon(
  graphics,
  cx,
  cy,
  pathD,
  fillColor,
  GraphicsPathCtor,
) {
  const size = STRATEGIC_RESOURCE_NODE_ICON_SIZE
  const scale = size / STRATEGIC_RESOURCE_ICON_VIEWBOX
  const path = new GraphicsPathCtor(pathD)

  graphics.save()
  graphics.setTransform(scale, 0, 0, scale, cx - 12 * scale, cy - 12 * scale)
  graphics.path(path)
  graphics.stroke({
    width: STRATEGIC_RESOURCE_ICON_OUTLINE_WIDTH / scale,
    color: STRATEGIC_RESOURCE_ICON_OUTLINE_COLOR,
    alpha: 1,
  })
  graphics.path(path)
  graphics.fill({ color: fillColor, alpha: 0.95 })
  graphics.restore()
}

/**
 * @param {import('pixi.js').Graphics} graphics
 * @param {number} cx
 * @param {number} cy
 * @param {import('../core/types.js').MineralKind | undefined} kind
 * @param {typeof import('pixi.js').GraphicsPath} GraphicsPathCtor
 */
export function drawMineralDepositIcon(graphics, cx, cy, kind, GraphicsPathCtor) {
  drawStrategicResourceIcon(
    graphics,
    cx,
    cy,
    mineralDepositIconPathD(kind),
    mineralNodeOverlayColor(kind),
    GraphicsPathCtor,
  )
}

/**
 * @param {import('pixi.js').Graphics} graphics
 * @param {number} cx
 * @param {number} cy
 * @param {typeof import('pixi.js').GraphicsPath} GraphicsPathCtor
 */
export function drawSaltDepositIcon(graphics, cx, cy, GraphicsPathCtor) {
  drawStrategicResourceIcon(
    graphics,
    cx,
    cy,
    SALT_SHAKER_PATH_D,
    SALT_NODE_OVERLAY_COLOR,
    GraphicsPathCtor,
  )
}
