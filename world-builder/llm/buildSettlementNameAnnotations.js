import { buildCampaignKitModel } from '../core/campaignKit/buildCampaignKitModel.js'
import { buildSettlementEconomyInspect } from '../core/economy/settlementEconomyInspect.js'

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
 * Per-settlement packets for Gemini place-name / region-writeup prompts.
 *
 * @param {import('../core/colonization/createDefaultColonizationSlice.js').ColonizationSlice} slice
 * @param {import('../core/types.js').WorldDocument} worldDocument
 * @returns {{
 *   epoch: number,
 *   factions: object[],
 *   rivalryEdges: object[],
 *   settlements: object[],
 * }}
 */
export function buildSettlementNameAnnotations(slice, worldDocument) {
  const kit = buildCampaignKitModel(slice, worldDocument)
  const factionById = new Map((kit.politics?.factions ?? []).map((f) => [f.id, f]))

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

    return {
      settlementId: dossier.settlementId,
      mapNumber: dossier.mapNumber,
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
      history: annotatedHistoryForSettlement(slice, dossier.settlementId),
      kitHistoryNotes: dossier.historyNotes,
    }
  })

  return {
    epoch: kit.header.epoch,
    factions: kit.politics?.factions ?? [],
    rivalryEdges: kit.politics?.rivalryEdges ?? [],
    settlements,
  }
}
