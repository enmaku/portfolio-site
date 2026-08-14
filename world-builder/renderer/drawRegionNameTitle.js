import {
  SETTLEMENT_ID_LABEL_COLOR,
  SETTLEMENT_ID_LABEL_OUTLINE_COLOR,
} from './settlementNodeMarkers.js'

const TITLE_FONT_SIZE = 26
const TITLE_PAD_X = 18
const TITLE_PAD_Y = 10
const TITLE_MARGIN_TOP = 12

/**
 * @param {import('pixi.js').Container} overlay
 */
export function clearRegionNameTitle(overlay) {
  const removed = overlay.removeChildren()
  for (const child of removed) {
    child.destroy({ children: true })
  }
}

/**
 * Screen-space region/realm title for the LLM names overlay (top-center of the map host).
 *
 * @param {import('pixi.js').Container} overlay
 * @param {typeof import('pixi.js').Graphics} GraphicsCtor
 * @param {typeof import('pixi.js').Text} TextCtor
 * @param {{ visible: boolean, regionName?: string | null, screenWidth: number }} options
 */
export function drawRegionNameTitle(overlay, GraphicsCtor, TextCtor, options) {
  clearRegionNameTitle(overlay)

  const regionName = typeof options.regionName === 'string' ? options.regionName.trim() : ''
  if (!options.visible || !regionName) {
    overlay.visible = false
    return
  }

  overlay.visible = true

  const label = new TextCtor({
    text: regionName,
    style: {
      fontFamily: 'Georgia, serif',
      fontSize: TITLE_FONT_SIZE,
      fontWeight: 'bold',
      fill: SETTLEMENT_ID_LABEL_COLOR,
      stroke: {
        color: SETTLEMENT_ID_LABEL_OUTLINE_COLOR,
        width: 4,
      },
    },
  })

  const panelWidth = label.width + TITLE_PAD_X * 2
  const panelHeight = label.height + TITLE_PAD_Y * 2
  const originX = Math.max(0, (options.screenWidth - panelWidth) / 2)

  const panel = new GraphicsCtor()
  panel.roundRect(originX, TITLE_MARGIN_TOP, panelWidth, panelHeight, 6)
  panel.fill({ color: 0x0d1117, alpha: 0.78 })
  panel.stroke({ color: 0x000000, width: 1, alpha: 0.9 })
  overlay.addChild(panel)

  label.anchor.set(0.5, 0.5)
  label.x = originX + panelWidth / 2
  label.y = TITLE_MARGIN_TOP + panelHeight / 2
  overlay.addChild(label)
}
