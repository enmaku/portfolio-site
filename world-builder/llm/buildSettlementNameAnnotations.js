import { buildCampaignKitModel } from '../core/campaignKit/buildCampaignKitModel.js'
import { combinedSettlementWealthCp } from '../core/economy/ledgers/combinedSettlementWealthCp.js'
import { balancesFromEconomyInspectSource } from '../core/economy/computeSettlementWealthSignals.js'
import { portTollIncomeCpForSettlement } from '../core/economy/ledgers/portTollIncomeCpForSettlement.js'
import { resolveRouteSegmentMode } from '../core/colonization/roads/roadNetwork.js'
import { POLITICS_HISTORY_KINDS } from '../core/colonization/politics/historyKinds.js'

const CHRONICLE_CAP = 48
const TRADE_FLOW_CAP = 24
const ROUTE_CAP = 80

/** @type {ReadonlySet<string>} */
const CHRONICLE_EXTRA_KINDS = Object.freeze(
  new Set(['founding', 'settlement_founded', 'settlement_abandoned', 'settlement_merged']),
)

/** @type {readonly string[]} */
const CHRONICLE_FIELD_KEYS = Object.freeze([
  'kind',
  'epoch',
  'cause',
  'settlementId',
  'originSettlementId',
  'capitalSettlementId',
  'factionId',
  'priorFactionId',
  'parentFactionId',
  'absorbedFactionId',
  'survivorFactionId',
  'attackerFactionId',
  'defenderFactionId',
  'loyalistFactionId',
  'contestedSettlementId',
  'landBranch',
  'maritimeBranch',
])

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function stripEmptyJson(value) {
  if (value == null) return undefined
  if (Array.isArray(value)) {
    const next = value.map(stripEmptyJson).filter((row) => row !== undefined)
    return next.length > 0 ? next : undefined
  }
  if (typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {}
    for (const [key, raw] of Object.entries(value)) {
      const next = stripEmptyJson(raw)
      if (next === undefined) continue
      out[key] = next
    }
    return Object.keys(out).length > 0 ? out : undefined
  }
  if (typeof value === 'string' && value.trim() === '') return undefined
  return value
}

/**
 * @param {object} entry
 * @returns {object}
 */
function compactChronicleEntry(entry) {
  /** @type {Record<string, unknown>} */
  const row = {}
  for (const key of CHRONICLE_FIELD_KEYS) {
    if (entry[key] == null || entry[key] === '') continue
    row[key] = entry[key]
  }
  return row
}

/**
 * Global political/founding chronicle (not per-settlement).
 *
 * @param {import('../core/colonization/createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @returns {object[]}
 */
function buildChronicle(slice) {
  /** @type {object[]} */
  const scored = []
  for (const entry of slice.historyLog ?? []) {
    if (!entry || typeof entry !== 'object') continue
    const kind = typeof entry.kind === 'string' ? entry.kind : ''
    if (!kind) continue
    const isPolitics = POLITICS_HISTORY_KINDS.has(kind)
    const isExtra = CHRONICLE_EXTRA_KINDS.has(kind)
    if (!isPolitics && !isExtra) continue
    const epoch = Number.isFinite(entry.epoch) ? /** @type {number} */ (entry.epoch) : 0
    scored.push({
      priority: isPolitics ? 2 : 1,
      epoch,
      row: compactChronicleEntry(entry),
    })
  }
  scored.sort((a, b) => b.priority - a.priority || b.epoch - a.epoch)
  return scored.slice(0, CHRONICLE_CAP).map((row) => row.row)
}

/**
 * @param {import('../core/colonization/createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {Map<string, number>} mapNumberById
 * @returns {object[]}
 */
function annotatedRoutes(slice, mapNumberById) {
  /** @type {object[]} */
  const routes = []
  for (const segment of slice.roads ?? []) {
    if (!segment || typeof segment !== 'object') continue
    const settlementIds = Array.isArray(segment.settlementIds)
      ? segment.settlementIds.filter((id) => typeof id === 'string' && id)
      : []
    const cellCount = Array.isArray(segment.cells) ? segment.cells.length : 0
    if (settlementIds.length < 2 && cellCount === 0) continue
    routes.push({
      mode: resolveRouteSegmentMode(segment.mode),
      mapNumbers: settlementIds
        .map((id) => mapNumberById.get(id))
        .filter((n) => typeof n === 'number'),
      cellCount,
    })
    if (routes.length >= ROUTE_CAP) break
  }
  return routes
}

/**
 * @param {import('../core/colonization/createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {Map<string, number>} mapNumberById
 * @returns {object[]}
 */
function annotatedTradeFlows(slice, mapNumberById) {
  const flows = slice.tradeRouteState?.activeFlows ?? []
  /** @type {Array<{ amount: number, row: object }>} */
  const ranked = []
  for (const flow of flows) {
    if (!flow || typeof flow !== 'object') continue
    const amount = Number(flow.amount)
    if (!(amount > 0)) continue
    const from = mapNumberById.get(flow.fromSettlementId)
    const to = mapNumberById.get(flow.toSettlementId)
    if (typeof from !== 'number' || typeof to !== 'number') continue
    ranked.push({
      amount,
      row: {
        from: from,
        to: to,
        commodity: flow.commodityId,
        amount: Math.round(amount),
        mode: flow.mode ?? null,
      },
    })
  }
  ranked.sort((a, b) => b.amount - a.amount)
  return ranked.slice(0, TRADE_FLOW_CAP).map((row) => row.row)
}

/**
 * @param {Array<{ id: string, value: number }>} rows
 * @returns {Map<string, number>}
 */
function rankDescending(rows) {
  const sorted = [...rows].sort((a, b) => b.value - a.value || a.id.localeCompare(b.id))
  /** @type {Map<string, number>} */
  const ranks = new Map()
  sorted.forEach((row, index) => {
    ranks.set(row.id, index + 1)
  })
  return ranks
}

/**
 * Lean annotations for Gemini naming + region writeup.
 *
 * @param {import('../core/colonization/createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../core/types.js').WorldDocument} worldDocument
 */
export function buildSettlementNameAnnotations(slice, worldDocument) {
  const kit = buildCampaignKitModel(slice, worldDocument)
  const living = kit.settlements.filter((row) => row.status !== 'ruin')
  const mapNumberById = new Map(
    kit.settlements.map((row) => [row.settlementId, row.mapNumber]),
  )

  const balancesBySettlementId = balancesFromEconomyInspectSource({
    settlements: slice.settlements,
    tradeAccounts: slice.tradeAccounts,
    lastTradeEpochResult: slice.lastTradeEpochResult,
    externalTradeAccounts: slice.externalTradeAccounts,
  })
  const tradeResult = slice.lastTradeEpochResult ?? null

  /** @type {Array<{ id: string, value: number }>} */
  const popRows = []
  /** @type {Array<{ id: string, value: number }>} */
  const wealthRows = []
  /** @type {Array<{ id: string, value: number }>} */
  const tollRows = []

  for (const dossier of living) {
    const id = dossier.settlementId
    popRows.push({ id, value: dossier.population ?? 0 })
    wealthRows.push({
      id,
      value: combinedSettlementWealthCp({
        settlementId: id,
        balancesBySettlementId,
        externalTradeAccounts: slice.externalTradeAccounts,
      }),
    })
    const tolls = portTollIncomeCpForSettlement(tradeResult, id)
    if (tolls != null) tollRows.push({ id, value: tolls })
  }

  const popRank = rankDescending(popRows)
  const wealthRank = rankDescending(wealthRows)
  const tollRank = rankDescending(tollRows)
  const livingCount = living.length
  const ruinCount = kit.settlements.length - livingCount

  const settlements = kit.settlements.map((dossier) => {
    const id = dossier.settlementId
    const isRuin = dossier.status === 'ruin'
    const faction = (kit.politics?.factions ?? []).find((f) => f.id === dossier.factionId)
    const capitalMapNumber = faction
      ? mapNumberById.get(faction.capitalSettlementId) ?? null
      : null
    return stripEmptyJson({
      id,
      n: dossier.mapNumber,
      x: dossier.coordinates?.x ?? null,
      y: dossier.coordinates?.y ?? null,
      status: isRuin ? 'ruin' : undefined,
      tier: isRuin ? undefined : dossier.tier,
      pop: isRuin ? undefined : dossier.population,
      popRank: isRuin ? undefined : (popRank.get(id) ?? null),
      wealthRank: isRuin ? undefined : (wealthRank.get(id) ?? null),
      tollRank: isRuin ? undefined : (tollRank.get(id) ?? null),
      maritime: isRuin ? undefined : dossier.maritimeRole,
      founded: dossier.foundedEpoch,
      factionId: isRuin ? undefined : dossier.factionId,
      band: isRuin ? undefined : dossier.membershipBand,
      tradePartner: !isRuin && dossier.isTradePartner === true ? true : undefined,
      capitalN: isRuin ? undefined : capitalMapNumber,
    })
  })

  const factions = (kit.politics?.factions ?? [])
    .filter((faction) => faction.status === 'active')
    .map((faction) =>
      stripEmptyJson({
        id: faction.id,
        capitalN: mapNumberById.get(faction.capitalSettlementId) ?? null,
        members: (faction.settlementIds ?? []).length,
        emerged: faction.emergedEpoch,
      }),
    )

  const rivalries = (kit.politics?.rivalryEdges ?? []).map((edge) =>
    stripEmptyJson({
      a: edge.aFactionId,
      b: edge.bFactionId,
      cause: edge.cause,
      since: edge.createdEpoch,
    }),
  )

  const annotations = stripEmptyJson({
    epoch: kit.header.epoch,
    grid: { w: Number(worldDocument.gridWidth) || 0, h: Number(worldDocument.gridHeight) || 0 },
    mapAxes: 'north=top/y0; x→east; y→south',
    livingCount,
    ruinCount: ruinCount > 0 ? ruinCount : undefined,
    factions,
    rivalries,
    chronicle: buildChronicle(slice),
    routes: annotatedRoutes(slice, mapNumberById),
    tradeFlows: annotatedTradeFlows(slice, mapNumberById),
    settlements,
  })

  return annotations && typeof annotations === 'object'
    ? /** @type {object} */ (annotations)
    : { settlements: [] }
}
