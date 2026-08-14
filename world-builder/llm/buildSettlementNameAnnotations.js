import { buildCampaignKitModel } from '../core/campaignKit/buildCampaignKitModel.js'
import { buildSettlementEconomyInspect } from '../core/economy/settlementEconomyInspect.js'
import { resolveRouteSegmentMode } from '../core/colonization/roads/roadNetwork.js'

/**
 * @param {import('../core/colonization/createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {string} settlementId
 * @returns {object[]}
 */
function annotatedHistoryForSettlement(slice, settlementId) {
  /** @type {object[]} */
  const notes = []
  for (const entry of slice.historyLog ?? []) {
    if (!entry || typeof entry !== 'object') continue
    const related =
      entry.settlementId === settlementId ||
      entry.originSettlementId === settlementId ||
      entry.capitalSettlementId === settlementId ||
      (Array.isArray(entry.settlementIds) && entry.settlementIds.includes(settlementId)) ||
      (Array.isArray(entry.memberSettlementIds) &&
        entry.memberSettlementIds.includes(settlementId))
    if (!related && entry.kind !== 'founding') continue
    if (entry.kind === 'founding' && settlementId !== slice.settlements?.[0]?.id) continue
    notes.push({
      kind: entry.kind ?? null,
      epoch: entry.epoch ?? null,
      factionId: entry.factionId ?? null,
      cause: entry.cause ?? null,
      label: entry.label ?? null,
    })
  }
  return notes
}

/**
 * @param {import('../core/colonization/createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @returns {object[]}
 */
function annotatedRoutes(slice) {
  /** @type {object[]} */
  const routes = []
  for (const segment of slice.roads ?? []) {
    if (!segment || typeof segment !== 'object') continue
    const settlementIds = Array.isArray(segment.settlementIds)
      ? segment.settlementIds.filter((id) => typeof id === 'string' && id)
      : []
    const cellCount = Array.isArray(segment.cells) ? segment.cells.length : 0
    if (settlementIds.length === 0 && cellCount === 0) continue
    routes.push({
      mode: resolveRouteSegmentMode(segment.mode),
      settlementIds,
      cellCount,
    })
  }
  return routes
}

/**
 * @param {string} settlementId
 * @param {object[]} routes
 * @returns {object[]}
 */
function routeLinksForSettlement(settlementId, routes) {
  /** @type {object[]} */
  const links = []
  for (const route of routes) {
    if (!route.settlementIds.includes(settlementId)) continue
    for (const otherId of route.settlementIds) {
      if (otherId === settlementId) continue
      links.push({
        toSettlementId: otherId,
        mode: route.mode,
        cellCount: route.cellCount,
      })
    }
  }
  return links
}

/**
 * Per-settlement packets for Gemini place-name / region-writeup prompts.
 *
 * Grid axes match the on-screen map: **x increases east, y increases south**
 * (y = 0 is the northern edge). Same convention as wind (bearing 0° = north → −y).
 *
 * @param {import('../core/colonization/createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {{
 *   epoch: number,
 *   gridWidth: number,
 *   gridHeight: number,
 *   mapAxes: { xIncreases: string, yIncreases: string, north: string, south: string, east: string, west: string },
 *   factions: object[],
 *   rivalryEdges: object[],
 *   routes: object[],
 *   settlements: object[],
 * }}
 */
export function buildSettlementNameAnnotations(slice, worldDocument) {
  const kit = buildCampaignKitModel(slice, worldDocument)
  const factionById = new Map((kit.politics?.factions ?? []).map((f) => [f.id, f]))
  const gridWidth = Number(worldDocument.gridWidth) || 0
  const gridHeight = Number(worldDocument.gridHeight) || 0
  const routes = annotatedRoutes(slice)

  const settlements = kit.settlements.map((dossier) => {
    const inspect = buildSettlementEconomyInspect(
      {
        settlements: slice.settlements,
        tradeAccounts: slice.tradeAccounts,
        lastTradeEpochResult: slice.lastTradeEpochResult,
        externalTradeAccounts: slice.externalTradeAccounts,
        saltNodes: worldDocument.saltNodes,
        metalNodes: worldDocument.metalNodes,
      },
      dossier.settlementId,
    )

    const faction = dossier.factionId ? factionById.get(dossier.factionId) : null
    const imports = (dossier.commodities ?? [])
      .filter((row) => row.role === 'import' || row.role === 'both')
      .map((row) => row.label ?? row.commodityId)
    const exports = (dossier.commodities ?? [])
      .filter((row) => row.role === 'export' || row.role === 'both')
      .map((row) => row.label ?? row.commodityId)

    const x = dossier.coordinates?.x
    const y = dossier.coordinates?.y

    return {
      settlementId: dossier.settlementId,
      mapNumber: dossier.mapNumber,
      x: typeof x === 'number' ? x : null,
      y: typeof y === 'number' ? y : null,
      status: dossier.status,
      tier: dossier.tier,
      population: dossier.population,
      biome: dossier.biomeLabel,
      maritimeRole: dossier.maritimeRole,
      foundedEpoch: dossier.foundedEpoch,
      factionId: dossier.factionId,
      membershipBand: dossier.membershipBand,
      isTradePartner: dossier.isTradePartner,
      factionCapitalMapNumber: faction
        ? kit.settlements.find((s) => s.settlementId === faction.capitalSettlementId)?.mapNumber ??
          null
        : null,
      wealth: dossier.balance,
      factionTax: dossier.factionTax,
      portTolls: inspect?.portTollsCp != null ? String(inspect.portTollsCp) : null,
      supplies: dossier.supplies,
      wants: dossier.wants,
      imports,
      exports,
      routeLinks: routeLinksForSettlement(dossier.settlementId, routes),
      history: annotatedHistoryForSettlement(slice, dossier.settlementId),
      kitHistoryNotes: dossier.historyNotes,
    }
  })

  const settlementById = new Map(settlements.map((row) => [row.settlementId, row]))
  const factions = (kit.politics?.factions ?? []).map((faction) => {
    const memberPins = (faction.settlementIds ?? [])
      .map((id) => settlementById.get(id))
      .filter((row) => typeof row?.x === 'number' && typeof row?.y === 'number')
    let centroidX = null
    let centroidY = null
    if (memberPins.length > 0) {
      let sumX = 0
      let sumY = 0
      for (const pin of memberPins) {
        sumX += pin.x
        sumY += pin.y
      }
      centroidX = Math.round((sumX / memberPins.length) * 10) / 10
      centroidY = Math.round((sumY / memberPins.length) * 10) / 10
    }
    return {
      ...faction,
      centroidX,
      centroidY,
    }
  })

  return {
    epoch: kit.header.epoch,
    gridWidth,
    gridHeight,
    mapAxes: {
      xIncreases: 'east',
      yIncreases: 'south',
      north: 'toward y = 0 (top of the map image)',
      south: 'toward y = gridHeight - 1 (bottom of the map image)',
      east: 'toward x = gridWidth - 1 (right of the map image)',
      west: 'toward x = 0 (left of the map image)',
    },
    factions,
    rivalryEdges: kit.politics?.rivalryEdges ?? [],
    routes,
    settlements,
  }
}
