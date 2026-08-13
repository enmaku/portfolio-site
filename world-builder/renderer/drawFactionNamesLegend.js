import {
  factionTerritoryPaletteIndex,
  factionTerritoryRgb,
} from './buildFactionTerritoryOverlayRgba.js'
import {
  SETTLEMENT_ID_LABEL_COLOR,
  SETTLEMENT_ID_LABEL_OUTLINE_COLOR,
} from './settlementNodeMarkers.js'

const LEGEND_PAD = 12
const LEGEND_ROW_H = 22
const LEGEND_SWATCH = 14
const LEGEND_FONT_SIZE = 13
const LEGEND_GAP = 8

/**
 * @param {import('pixi.js').Container} overlay
 */
export function clearFactionNamesLegend(overlay) {
  const removed = overlay.removeChildren()
  for (const child of removed) {
    child.destroy({ children: true })
  }
}

/**
 * Screen-space faction legend for the LLM names overlay (right side of the map host).
 *
 * @param {import('pixi.js').Container} overlay
 * @param {typeof import('pixi.js').Graphics} GraphicsCtor
 * @param {typeof import('pixi.js').Text} TextCtor
 * @param {{
 *   visible: boolean,
 *   worldDocument: import('../core/types.js').WorldDocument,
 *   namesByFactionId?: Record<string, string> | null,
 *   screenWidth: number,
 *   screenHeight: number,
 * }} options
 */
export function drawFactionNamesLegend(overlay, GraphicsCtor, TextCtor, options) {
  clearFactionNamesLegend(overlay)

  if (!options.visible) {
    overlay.visible = false
    return
  }

  const factions = (options.worldDocument.factions ?? [])
    .filter((faction) => faction && typeof faction.id === 'string' && faction.status !== 'extinct')
    .slice()
    .sort((a, b) => {
      const ai = factionTerritoryPaletteIndex(a.id, options.worldDocument.factions)
      const bi = factionTerritoryPaletteIndex(b.id, options.worldDocument.factions)
      if (ai !== bi) return ai - bi
      return String(a.id).localeCompare(String(b.id))
    })

  if (factions.length === 0) {
    overlay.visible = false
    return
  }

  overlay.visible = true
  const namesByFactionId = options.namesByFactionId ?? {}
  const panel = new GraphicsCtor()
  const rows = []

  let maxTextWidth = 0
  for (const faction of factions) {
    const paletteIndex = factionTerritoryPaletteIndex(faction.id, options.worldDocument.factions)
    const customName =
      typeof namesByFactionId[faction.id] === 'string' ? namesByFactionId[faction.id].trim() : ''
    const labelText = customName ? `${paletteIndex}  ${customName}` : String(paletteIndex)
    const label = new TextCtor({
      text: labelText,
      style: {
        fontFamily: 'Arial',
        fontSize: LEGEND_FONT_SIZE,
        fill: SETTLEMENT_ID_LABEL_COLOR,
        stroke: {
          color: SETTLEMENT_ID_LABEL_OUTLINE_COLOR,
          width: 3,
        },
      },
    })
    maxTextWidth = Math.max(maxTextWidth, label.width)
    rows.push({ faction, paletteIndex, label })
  }

  const contentWidth = LEGEND_SWATCH + LEGEND_GAP + maxTextWidth
  const contentHeight = rows.length * LEGEND_ROW_H
  const panelWidth = contentWidth + LEGEND_PAD * 2
  const panelHeight = contentHeight + LEGEND_PAD * 2
  const originX = Math.max(LEGEND_PAD, options.screenWidth - panelWidth - LEGEND_PAD)
  const originY = LEGEND_PAD

  panel.roundRect(originX, originY, panelWidth, panelHeight, 6)
  panel.fill({ color: 0x0d1117, alpha: 0.78 })
  panel.stroke({ color: 0x000000, width: 1, alpha: 0.9 })
  overlay.addChild(panel)

  rows.forEach((row, index) => {
    const y = originY + LEGEND_PAD + index * LEGEND_ROW_H + (LEGEND_ROW_H - LEGEND_SWATCH) / 2
    const x = originX + LEGEND_PAD
    const rgb = factionTerritoryRgb(row.faction.id, options.worldDocument.factions)
    const color = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
    const swatch = new GraphicsCtor()
    swatch.rect(x, y, LEGEND_SWATCH, LEGEND_SWATCH)
    swatch.fill({ color })
    swatch.stroke({ color: 0x000000, width: 1, alpha: 0.95 })
    overlay.addChild(swatch)

    row.label.x = x + LEGEND_SWATCH + LEGEND_GAP
    row.label.y = originY + LEGEND_PAD + index * LEGEND_ROW_H + LEGEND_ROW_H / 2
    row.label.anchor.set(0, 0.5)
    overlay.addChild(row.label)
  })
}
