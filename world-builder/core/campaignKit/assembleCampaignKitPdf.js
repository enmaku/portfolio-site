/**
 * Assemble a campaign kit PDF from the structured model and two full-map PNG captures.
 */

import { jsPDF } from 'jspdf'
import { campaignKitResourceMapLegend } from './campaignKitFormat.js'
import { CAMPAIGN_KIT_MAP_PAGE_KEYS } from './campaignKitOverlayPresets.js'

/**
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64')
  return `data:${blob.type || 'image/png'};base64,${base64}`
}

/**
 * @param {import('./buildCampaignKitModel.js').CampaignKitModel['header']} header
 * @param {jsPDF} doc
 * @param {number} margin
 * @param {number} pageWidth
 */
function writeHeaderPage(doc, header, margin, pageWidth) {
  let y = margin
  const line = (text) => {
    doc.text(String(text), margin, y)
    y += 6
  }

  doc.setFontSize(16)
  line('Campaign kit')
  doc.setFontSize(10)
  line(`Epoch: ${header.epoch}`)
  line(`Living settlements: ${header.livingSettlementCount}`)
  line(`Ruins: ${header.ruinCount}`)
  line(`Total population: ${header.totalPopulation}`)
  line(`Geography seed: ${header.geographySeed ?? 'n/a'}`)
  if (header.foundingLanding) {
    line(`Founding landing: (${header.foundingLanding.x}, ${header.foundingLanding.y})`)
  }
  line('Colonist settings:')
  for (const [key, value] of Object.entries(header.colonistSettings)) {
    if (value == null) {
      continue
    }
    const display =
      typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : value
    line(`  ${key}: ${display}`)
  }
  void pageWidth
}

/**
 * @param {typeof CAMPAIGN_KIT_MAP_PAGE_KEYS[number]} key
 * @returns {string}
 */
function mapCaptionForKey(key) {
  if (key === 'settlementsRoutes') {
    return 'Map: settlements, settlement IDs, routes'
  }
  return 'Map: arable, timber, metals, salt'
}

/**
 * @param {jsPDF} doc
 * @param {number} margin
 * @param {number} pageWidth
 * @param {number} startY
 * @returns {number} y after legend
 */
function writeResourceMapLegend(doc, margin, pageWidth, startY) {
  let y = startY
  doc.setFontSize(10)
  doc.text('Legend:', margin, y)
  y += 5
  doc.setFontSize(8)
  for (const row of campaignKitResourceMapLegend()) {
    const text = `${row.swatch} — ${row.label}`
    const wrapped = doc.splitTextToSize(text, pageWidth - margin * 2)
    doc.text(wrapped, margin, y)
    y += wrapped.length * 4
  }
  return y + 2
}

/**
 * @param {jsPDF} doc
 * @param {string} dataUrl
 * @param {string} caption
 * @param {number} margin
 * @param {number} pageWidth
 * @param {number} pageHeight
 * @param {{ includeLegend?: boolean }} [options]
 */
function writeMapPage(doc, dataUrl, caption, margin, pageWidth, pageHeight, options = {}) {
  doc.addPage()
  doc.setFontSize(11)
  doc.text(caption, margin, margin)
  let contentTop = margin + 6
  if (options.includeLegend) {
    contentTop = writeResourceMapLegend(doc, margin, pageWidth, contentTop)
  }
  const maxWidth = pageWidth - margin * 2
  const maxHeight = pageHeight - contentTop - margin
  const size = Math.min(maxWidth, maxHeight)
  doc.addImage(dataUrl, 'PNG', margin, contentTop, size, size)
}

/**
 * @param {jsPDF} doc
 * @param {{ y: number }} cursor
 * @param {number} margin
 * @param {number} pageHeight
 * @param {number} needed
 */
function ensureSpace(doc, cursor, margin, pageHeight, needed) {
  if (cursor.y + needed <= pageHeight - margin) {
    return
  }
  doc.addPage()
  cursor.y = margin
}

/**
 * @param {jsPDF} doc
 * @param {import('./buildCampaignKitModel.js').CampaignKitSettlementDossier} settlement
 * @param {number} margin
 * @param {number} pageWidth
 * @param {number} pageHeight
 * @param {{ y: number }} cursor
 */
function writeSettlementDossier(doc, settlement, margin, pageWidth, pageHeight, cursor) {
  ensureSpace(doc, cursor, margin, pageHeight, 28)
  doc.setFontSize(13)
  doc.text(`Settlement ${settlement.mapNumber}`, margin, cursor.y)
  cursor.y += 7
  doc.setFontSize(9)

  /** @param {string} text */
  const line = (text) => {
    ensureSpace(doc, cursor, margin, pageHeight, 6)
    const wrapped = doc.splitTextToSize(text, pageWidth - margin * 2)
    doc.text(wrapped, margin, cursor.y)
    cursor.y += wrapped.length * 4.5
  }

  line(`Status: ${settlement.status}`)
  if (settlement.tier) {
    line(`Tier: ${settlement.tier}`)
  }
  line(`Population: ${settlement.population}`)
  line(`Coordinates: (${settlement.coordinates.x}, ${settlement.coordinates.y})`)
  if (settlement.biomeLabel) {
    line(`Biome: ${settlement.biomeLabel}`)
  }
  if (settlement.maritimeRole) {
    line(`Maritime role: ${settlement.maritimeRole}`)
  }
  if (settlement.foundedEpoch != null) {
    line(`Founded epoch: ${settlement.foundedEpoch}`)
  }
  if (settlement.originMapNumber != null) {
    line(`Origin settlement map number: ${settlement.originMapNumber}`)
  }
  for (const note of settlement.historyNotes) {
    line(`History: ${note.label} @ epoch ${note.epoch}`)
  }

  if (settlement.status === 'ruin') {
    cursor.y += 4
    return
  }

  if (settlement.balance) {
    line(`Balance: ${settlement.balance}`)
  }

  if (settlement.production?.length) {
    line('Claim production:')
    for (const row of settlement.production) {
      line(`  ${row.label}: ${row.display}`)
    }
  }

  if (settlement.commodities?.length) {
    line('Commodities (local price / trade role):')
    for (const row of settlement.commodities) {
      line(`  ${row.label}: ${row.localPrice} (${row.role}, vs ref: ${row.priceVsReference})`)
    }
  }

  if (settlement.offMapTrades) {
    line('Off-map trade:')
    if (settlement.offMapTrades.length === 0) {
      line('  (none this epoch)')
    } else {
      for (const row of settlement.offMapTrades) {
        line(
          `  ${row.direction} ${row.label}: ${row.amountDisplay}, unit ${row.unitPrice}, volume ${row.volume}`,
        )
      }
    }
  }

  cursor.y += 6
}

/**
 * @param {{
 *   model: import('./buildCampaignKitModel.js').CampaignKitModel,
 *   settlementsMapPng: Blob,
 *   resourcesMapPng: Blob,
 * }} params
 * @returns {Promise<Blob>}
 */
export async function assembleCampaignKitPdf({ model, settlementsMapPng, resourcesMapPng }) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })
  const margin = 14
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  writeHeaderPage(doc, model.header, margin, pageWidth)

  const [settlementsUrl, resourcesUrl] = await Promise.all([
    blobToDataUrl(settlementsMapPng),
    blobToDataUrl(resourcesMapPng),
  ])

  writeMapPage(
    doc,
    settlementsUrl,
    mapCaptionForKey('settlementsRoutes'),
    margin,
    pageWidth,
    pageHeight,
  )
  writeMapPage(doc, resourcesUrl, mapCaptionForKey('resources'), margin, pageWidth, pageHeight, {
    includeLegend: true,
  })

  doc.addPage()
  const cursor = { y: margin }
  doc.setFontSize(14)
  doc.text('Settlements', margin, cursor.y)
  cursor.y += 10

  for (const settlement of model.settlements) {
    writeSettlementDossier(doc, settlement, margin, pageWidth, pageHeight, cursor)
  }

  void CAMPAIGN_KIT_MAP_PAGE_KEYS
  return doc.output('blob')
}

/**
 * Trigger a browser file download for a blob.
 *
 * @param {Blob} blob
 * @param {string} filename
 * @param {{ createElement?: typeof document.createElement, body?: { appendChild: Function, removeChild: Function } }} [dom]
 */
export function downloadBlob(blob, filename, dom = globalThis.document) {
  if (!dom?.createElement) {
    throw new Error('document is required to download a campaign kit PDF')
  }
  const url = URL.createObjectURL(blob)
  const anchor = dom.createElement('a')
  anchor.href = url
  anchor.download = filename
  const body = dom.body
  if (body?.appendChild) {
    body.appendChild(anchor)
  }
  anchor.click()
  if (body?.removeChild) {
    body.removeChild(anchor)
  }
  URL.revokeObjectURL(url)
}
