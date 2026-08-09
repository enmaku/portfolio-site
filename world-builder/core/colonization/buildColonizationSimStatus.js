import {
  countLivingSettlements,
  getActiveExpeditions,
  livingSettlements,
} from './expeditions/expeditionConstants.js'
import { pickSettlementExtremes } from './pickSettlementExtreme.js'

/**
 * @typedef {Object} SettlementExtreme
 * @property {string} settlementId
 * @property {number} value
 */

/**
 * @typedef {Object} ResourceClaimRow
 * @property {string} key
 * @property {number} claimed
 * @property {number} total
 */

/**
 * @typedef {Object} ColonizationSimStatus
 * @property {number} epoch
 * @property {number} livingSettlementCount
 * @property {number} ruinCount
 * @property {number} activeExpeditionCount
 * @property {number} roadSegmentCount
 * @property {number} activeTradeFlowCount
 * @property {number} offMapTradeVolumeCp Gross off-map trade value this epoch (amount × unit price).
 * @property {number} totalPopulation
 * @property {SettlementExtreme | null} highestPopulation
 * @property {SettlementExtreme | null} lowestPopulation
 * @property {ResourceClaimRow[]} resourceClaims
 */

/**
 * @typedef {Object} FoundingChronicleEntry
 * @property {string} kind
 * @property {number} epoch
 * @property {string} [settlementId]
 * @property {string} [originSettlementId]
 * @property {string} [logisticsNodePrimaryType]
 */

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {{
 *   saltNodes?: ReadonlyArray<{ x: number, y: number }>,
 *   metalNodes?: ReadonlyArray<{ x: number, y: number, kind?: string }>,
 *   gridWidth?: number,
 * } | null | undefined} [worldDocument]
 * @returns {ColonizationSimStatus}
 */
export function buildColonizationSimStatus(slice, worldDocument) {
  const settlements = slice.settlements ?? []
  const living = livingSettlements(settlements)
  const ruinCount = settlements.filter((settlement) => settlement.status === 'ruin').length
  const totalPopulation = living.reduce(
    (sum, settlement) => sum + (Number(settlement.population) || 0),
    0,
  )

  const populationExtremes = pickSettlementExtremes(living, (settlement) =>
    Number(settlement.population) || 0,
  )

  const tradeResult = slice.lastTradeEpochResult ?? null
  const activeFlows = slice.tradeRouteState?.activeFlows ?? tradeResult?.flows ?? []

  return {
    epoch: slice.epoch ?? 0,
    livingSettlementCount: countLivingSettlements(settlements),
    ruinCount,
    activeExpeditionCount: getActiveExpeditions(slice).length,
    roadSegmentCount: Array.isArray(slice.roads) ? slice.roads.length : 0,
    activeTradeFlowCount: Array.isArray(activeFlows) ? activeFlows.length : 0,
    offMapTradeVolumeCp: sumOffMapTradeVolumeCp(tradeResult?.offMapTrades),
    totalPopulation,
    highestPopulation: populationExtremes
      ? {
          settlementId: populationExtremes.high.id,
          value: Number(populationExtremes.high.population) || 0,
        }
      : null,
    lowestPopulation: populationExtremes
      ? {
          settlementId: populationExtremes.low.id,
          value: Number(populationExtremes.low.population) || 0,
        }
      : null,
    resourceClaims: buildResourceClaimRows(slice, worldDocument),
  }
}

/**
 * @param {ReadonlyArray<{ amount?: number, unitPriceCp?: number }> | null | undefined} trades
 * @returns {number}
 */
function sumOffMapTradeVolumeCp(trades) {
  if (!Array.isArray(trades)) return 0
  let total = 0
  for (const trade of trades) {
    const amount = Number(trade?.amount) || 0
    const unitPriceCp = Number(trade?.unitPriceCp) || 0
    total += amount * unitPriceCp
  }
  return total
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {{
 *   saltNodes?: ReadonlyArray<{ x: number, y: number }>,
 *   metalNodes?: ReadonlyArray<{ x: number, y: number, kind?: string }>,
 *   gridWidth?: number,
 * } | null | undefined} worldDocument
 * @returns {ResourceClaimRow[]}
 */
function buildResourceClaimRows(slice, worldDocument) {
  const gridWidth = Number(worldDocument?.gridWidth)
  if (!Number.isFinite(gridWidth) || gridWidth <= 0) {
    return []
  }

  const claimedIndices = new Set()
  const livingIds = new Set(
    livingSettlements(slice.settlements ?? []).map((settlement) => settlement.id),
  )
  const primaryClaim = slice.primaryClaim ?? {}
  for (const settlementId of livingIds) {
    const cells = primaryClaim[settlementId] ?? []
    for (const cell of cells) {
      if (cell && Number.isFinite(cell.x) && Number.isFinite(cell.y)) {
        claimedIndices.add(cell.y * gridWidth + cell.x)
      }
    }
  }

  /**
   * @param {string} key
   * @param {ReadonlyArray<{ x: number, y: number }> | undefined} pins
   * @returns {ResourceClaimRow | null}
   */
  function rowForPins(key, pins) {
    if (!Array.isArray(pins) || pins.length === 0) {
      return null
    }
    let claimed = 0
    for (const pin of pins) {
      if (claimedIndices.has(pin.y * gridWidth + pin.x)) {
        claimed += 1
      }
    }
    return { key, claimed, total: pins.length }
  }

  /** @type {ResourceClaimRow[]} */
  const rows = []
  const saltRow = rowForPins('salt', worldDocument?.saltNodes)
  if (saltRow) {
    rows.push(saltRow)
  }

  const metalNodes = worldDocument?.metalNodes ?? []
  for (const kind of ['copper', 'silver', 'gold', 'diamond']) {
    const kindPins = metalNodes.filter((node) => node.kind === kind)
    const row = rowForPins(kind === 'diamond' ? 'diamonds' : kind, kindPins)
    if (row) {
      rows.push(row)
    }
  }

  return rows
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @returns {FoundingChronicleEntry[]}
 */
export function buildFoundingChronicle(slice) {
  const allowedKinds = new Set([
    'founding',
    'settlement_founded',
    'settlement_abandoned',
    'increment3_latched',
    'faction_emerged',
    'faction_extinct',
    'faction_absorption',
    'vassal_defection',
    'city_state_founding',
    'major_war_start',
    'major_war_end',
    'rebellion_start',
    'rebellion_end',
    'treaty_peace',
  ])
  return (slice.historyLog ?? [])
    .filter((entry) => allowedKinds.has(entry.kind))
    .map((entry) => ({
      kind: entry.kind,
      epoch: entry.epoch,
      settlementId: entry.settlementId,
      originSettlementId: entry.originSettlementId,
      logisticsNodePrimaryType: entry.logisticsNodePrimaryType,
      factionId: entry.factionId,
      cause: entry.cause,
      attackerFactionId: entry.attackerFactionId,
      defenderFactionId: entry.defenderFactionId,
      contestedSettlementId: entry.contestedSettlementId,
      loyalistFactionId: entry.loyalistFactionId,
      winner: entry.winner,
      fought: entry.fought,
      aFactionId: entry.aFactionId,
      bFactionId: entry.bFactionId,
    }))
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationPhase} phase
 * @returns {boolean}
 */
export function shouldShowSimStatusPanel(phase) {
  return phase === 'running'
}

/**
 * @param {import('./createDefaultColonizationSlice.js').ColonizationPhase} phase
 * @param {number} epoch
 * @param {number} validationRowCount
 * @returns {boolean}
 */
export function shouldShowValidationAdvisory(phase, epoch, validationRowCount) {
  if (validationRowCount <= 0) return false
  if (phase === 'terrain') return true
  if (phase === 'setup') return true
  return phase === 'running' && epoch === 0
}
