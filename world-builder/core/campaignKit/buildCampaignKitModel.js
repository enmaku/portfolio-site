/**
 * Pure present-day campaign kit document model (text/tables). Map images are captured separately.
 */

import { BIOMES_CATALOG } from '../biomeCatalog.js'
import { buildColonizationSimStatus } from '../colonization/buildColonizationSimStatus.js'
import { isValidSettlementMapNumber } from '../colonization/settlementMapNumber.js'
import { computeClaimProduction } from '../economy/founding/computeClaimProduction.js'
import { buildSettlementTradeTooltip } from '../economy/settlementTradeTooltip.js'
import {
  campaignKitCommodityLabel,
  campaignKitInteger,
  formatCampaignKitCommodityAmount,
  formatCampaignKitCommodityPriceCp,
  formatCampaignKitHistoryKind,
  formatCampaignKitMoneyCp,
  presentCampaignKitProduction,
} from './campaignKitFormat.js'
import { CAMPAIGN_KIT_MAP_PAGE_KEYS } from './campaignKitOverlayPresets.js'

/**
 * @typedef {import('../colonization/createDefaultColonizationSlice.js').ColonizationSlice} ColonizationSlice
 * @typedef {import('../types.js').WorldDocument} WorldDocument
 * @typedef {import('../economy/commodityCatalog.js').CommodityId} CommodityId
 */

/**
 * @typedef {Object} CampaignKitCommodityRow
 * @property {CommodityId} commodityId
 * @property {string} label
 * @property {string} localPrice
 * @property {'above' | 'below' | 'equal'} priceVsReference
 * @property {'import' | 'export' | 'both' | 'neither'} role
 */

/**
 * @typedef {Object} CampaignKitOffMapTradeRow
 * @property {CommodityId} commodityId
 * @property {string} label
 * @property {'import' | 'export'} direction
 * @property {number} amount
 * @property {string} amountDisplay
 * @property {string} unitPrice
 * @property {string} volume
 */

/**
 * @typedef {Object} CampaignKitProductionRow
 * @property {CommodityId} commodityId
 * @property {string} label
 * @property {number} amount
 * @property {string} unit
 * @property {string} display
 */

/**
 * @typedef {Object} CampaignKitHistoryNote
 * @property {string} kind machine kind
 * @property {string} label author-facing kind
 * @property {number} epoch
 */

/**
 * @typedef {Object} CampaignKitSettlementDossier
 * @property {number} mapNumber
 * @property {string} settlementId
 * @property {'living' | 'ruin'} status
 * @property {string | null} tier
 * @property {number} population
 * @property {{ x: number, y: number }} coordinates
 * @property {string | null} biomeLabel
 * @property {string | null} maritimeRole
 * @property {number | null} foundedEpoch
 * @property {number | null} originMapNumber
 * @property {CampaignKitHistoryNote[]} historyNotes
 * @property {CampaignKitProductionRow[] | null} production
 * @property {string | null} balance
 * @property {CampaignKitCommodityRow[] | null} commodities
 * @property {CampaignKitOffMapTradeRow[] | null} offMapTrades
 */

/**
 * @typedef {Object} CampaignKitModel
 * @property {{
 *   epoch: number,
 *   livingSettlementCount: number,
 *   ruinCount: number,
 *   totalPopulation: number,
 *   geographySeed: unknown,
 *   foundingLanding: { x: number, y: number } | null,
 *   colonistSettings: Record<string, number | string>,
 * }} header
 * @property {typeof CAMPAIGN_KIT_MAP_PAGE_KEYS} mapPageKeys
 * @property {CampaignKitSettlementDossier[]} settlements
 */

/**
 * @param {WorldDocument | null | undefined} worldDocument
 * @param {{ x?: number, y?: number }} settlement
 * @returns {string | null}
 */
function biomeLabelAtPin(worldDocument, settlement) {
  if (
    !worldDocument?.biomes ||
    typeof worldDocument.gridWidth !== 'number' ||
    typeof settlement.x !== 'number' ||
    typeof settlement.y !== 'number'
  ) {
    return null
  }
  const index = settlement.y * worldDocument.gridWidth + settlement.x
  const biomeId = worldDocument.biomes[index]
  if (typeof biomeId !== 'number') {
    return null
  }
  const entry = BIOMES_CATALOG.find((row) => row.id === biomeId)
  return entry?.label ?? null
}

/**
 * @param {ColonizationSlice} slice
 * @returns {Map<string, number>}
 */
function mapNumberBySettlementId(slice) {
  /** @type {Map<string, number>} */
  const map = new Map()
  for (const settlement of slice.settlements ?? []) {
    if (
      typeof settlement.id === 'string' &&
      isValidSettlementMapNumber(settlement.mapNumber)
    ) {
      map.set(settlement.id, settlement.mapNumber)
    }
  }
  return map
}

/**
 * @param {ColonizationSlice} slice
 * @param {string} settlementId
 * @param {number} mapNumber
 * @returns {CampaignKitHistoryNote[]}
 */
function historyNotesForSettlement(slice, settlementId, mapNumber) {
  /** @type {CampaignKitHistoryNote[]} */
  const notes = []
  for (const entry of slice.historyLog ?? []) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const kind = typeof entry.kind === 'string' ? entry.kind : ''
    const epoch = campaignKitInteger(entry.epoch)
    if (kind === 'founding' && mapNumber === 1) {
      notes.push({ kind, label: formatCampaignKitHistoryKind(kind), epoch })
      continue
    }
    if (
      (kind === 'settlement_founded' || kind === 'settlement_abandoned') &&
      entry.settlementId === settlementId
    ) {
      notes.push({ kind, label: formatCampaignKitHistoryKind(kind), epoch })
    }
  }
  return notes
}

/**
 * @param {ColonizationSlice} slice
 * @param {WorldDocument} worldDocument
 * @param {{ id: string }} settlement
 * @returns {CampaignKitProductionRow[] | null}
 */
function productionForSettlement(slice, worldDocument, settlement) {
  const claimedCells = slice.primaryClaim?.[settlement.id]
  if (!Array.isArray(claimedCells) || claimedCells.length === 0) {
    return null
  }
  const raw = computeClaimProduction({
    settlementId: settlement.id,
    claimedCells,
    worldDocument,
    yieldModifier: slice.colonistSettings?.yieldModifier ?? 'typical',
    populationDensity: slice.colonistSettings?.populationDensity,
  })
  const rows = presentCampaignKitProduction(raw)
  return rows.length > 0 ? rows : null
}

/**
 * @param {ColonizationSlice} slice
 * @param {string} settlementId
 * @returns {CampaignKitOffMapTradeRow[]}
 */
function offMapTradesForSettlement(slice, settlementId) {
  const trades = slice.lastTradeEpochResult?.offMapTrades ?? []
  /** @type {CampaignKitOffMapTradeRow[]} */
  const rows = []
  for (const trade of trades) {
    if (!trade || trade.settlementId !== settlementId) {
      continue
    }
    if (trade.direction !== 'import' && trade.direction !== 'export') {
      continue
    }
    const commodityId = /** @type {CommodityId} */ (trade.commodityId)
    const amount = campaignKitInteger(trade.amount)
    const unitPriceCp = Number(trade.unitPriceCp)
    if (amount <= 0 || !Number.isFinite(unitPriceCp)) {
      continue
    }
    const amountFormatted = formatCampaignKitCommodityAmount(amount, commodityId)
    rows.push({
      commodityId,
      label: campaignKitCommodityLabel(commodityId),
      direction: trade.direction,
      amount,
      amountDisplay: amountFormatted.display,
      unitPrice: formatCampaignKitCommodityPriceCp(unitPriceCp, commodityId),
      volume: formatCampaignKitMoneyCp(amount * unitPriceCp),
    })
  }
  return rows
}

/**
 * @param {ColonizationSlice} slice
 * @param {WorldDocument} worldDocument
 * @param {object} settlement
 * @param {Map<string, number>} mapNumbers
 * @returns {CampaignKitSettlementDossier}
 */
function buildSettlementDossier(slice, worldDocument, settlement, mapNumbers) {
  const mapNumber = isValidSettlementMapNumber(settlement.mapNumber)
    ? /** @type {number} */ (settlement.mapNumber)
    : 0
  const settlementId = typeof settlement.id === 'string' ? settlement.id : ''
  const status = settlement.status === 'ruin' ? 'ruin' : 'living'
  const originMapNumber =
    typeof settlement.originSettlementId === 'string'
      ? (mapNumbers.get(settlement.originSettlementId) ?? null)
      : null

  /** @type {CampaignKitSettlementDossier} */
  const dossier = {
    mapNumber,
    settlementId,
    status,
    tier: typeof settlement.tier === 'string' ? settlement.tier : null,
    population:
      typeof settlement.population === 'number' && Number.isFinite(settlement.population)
        ? Math.max(0, Math.floor(settlement.population))
        : 0,
    coordinates: {
      x: typeof settlement.x === 'number' ? settlement.x : 0,
      y: typeof settlement.y === 'number' ? settlement.y : 0,
    },
    biomeLabel: biomeLabelAtPin(worldDocument, settlement),
    maritimeRole: typeof settlement.maritimeRole === 'string' ? settlement.maritimeRole : null,
    foundedEpoch: Number.isFinite(settlement.foundedEpoch)
      ? campaignKitInteger(settlement.foundedEpoch)
      : null,
    originMapNumber,
    historyNotes: historyNotesForSettlement(slice, settlementId, mapNumber),
    production: null,
    balance: null,
    commodities: null,
    offMapTrades: null,
  }

  if (status === 'ruin') {
    return dossier
  }

  dossier.production = productionForSettlement(slice, worldDocument, settlement)

  const tooltip = buildSettlementTradeTooltip(
    {
      settlements: slice.settlements,
      lastTradeEpochResult: slice.lastTradeEpochResult,
      externalTradeAccounts: slice.externalTradeAccounts,
      saltNodes: worldDocument.saltNodes,
      metalNodes: worldDocument.metalNodes,
    },
    settlementId,
  )
  if (tooltip) {
    dossier.balance = formatCampaignKitMoneyCp(tooltip.balanceCp)
    dossier.commodities = tooltip.commodities.map((row) => ({
      commodityId: row.commodityId,
      label: campaignKitCommodityLabel(row.commodityId),
      localPrice: formatCampaignKitCommodityPriceCp(row.localPriceCp, row.commodityId),
      priceVsReference: row.priceVsReference,
      role: row.role,
    }))
  }

  const offMap = offMapTradesForSettlement(slice, settlementId)
  dossier.offMapTrades = settlement.maritimeRole === 'port' || offMap.length > 0 ? offMap : null

  return dossier
}

/**
 * @param {ColonizationSlice} slice
 * @param {WorldDocument} worldDocument
 * @returns {CampaignKitModel}
 */
export function buildCampaignKitModel(slice, worldDocument) {
  const simStatus = buildColonizationSimStatus(slice, worldDocument)
  const settings = slice.colonistSettings ?? {}
  const mapNumbers = mapNumberBySettlementId(slice)

  const settlements = [...(slice.settlements ?? [])]
    .map((settlement) => buildSettlementDossier(slice, worldDocument, settlement, mapNumbers))
    .filter((dossier) => dossier.mapNumber >= 1)
    .sort((a, b) => a.mapNumber - b.mapNumber || a.settlementId.localeCompare(b.settlementId))

  return {
    header: {
      epoch: campaignKitInteger(simStatus.epoch),
      livingSettlementCount: campaignKitInteger(simStatus.livingSettlementCount),
      ruinCount: campaignKitInteger(simStatus.ruinCount),
      totalPopulation: campaignKitInteger(simStatus.totalPopulation),
      geographySeed: worldDocument.geographySeed ?? null,
      foundingLanding: slice.foundingLanding
        ? {
            x: campaignKitInteger(slice.foundingLanding.x),
            y: campaignKitInteger(slice.foundingLanding.y),
          }
        : null,
      colonistSettings: {
        threeDayHaulDistance: campaignKitInteger(settings.threeDayHaulDistance),
        startingPopulation: campaignKitInteger(settings.startingPopulation),
        peoplePerHabitableCell: campaignKitInteger(settings.peoplePerHabitableCell),
        populationDensity: settings.populationDensity,
        yieldModifier: settings.yieldModifier,
        landExpeditionRange: settings.landExpeditionRange,
        inlandSailExpeditionRange: settings.inlandSailExpeditionRange,
        openSeaExpeditionRange: settings.openSeaExpeditionRange,
        offMapShippingCost: settings.offMapShippingCost,
      },
    },
    mapPageKeys: CAMPAIGN_KIT_MAP_PAGE_KEYS,
    settlements,
  }
}
