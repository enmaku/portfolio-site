/**
 * Annotation / instruction ablations for settlement-name prompt experiments.
 */

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isEmpty(value) {
  if (value == null) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  if (typeof value === 'string') return value.trim() === ''
  return false
}

/**
 * Deep-ish strip of null/empty fields (objects and arrays).
 * @param {unknown} value
 * @returns {unknown}
 */
export function stripNullEmpty(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => stripNullEmpty(item))
      .filter((item) => !isEmpty(item) || typeof item === 'number' || typeof item === 'boolean')
  }
  if (value && typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {}
    for (const [key, child] of Object.entries(value)) {
      const next = stripNullEmpty(child)
      if (isEmpty(next) && typeof next !== 'number' && typeof next !== 'boolean') continue
      out[key] = next
    }
    return out
  }
  return value
}

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   includeAntiRepetition?: boolean,
 *   transform: (annotations: object) => object,
 * }} AblationVariant
 */

/** @type {readonly AblationVariant[]} */
export const SETTLEMENT_NAME_ABLATION_VARIANTS = Object.freeze([
  {
    id: 'baseline',
    label: 'Full current payload',
    transform: (annotations) => structuredClone(annotations),
  },
  {
    id: 'no_history',
    label: 'Drop history + kitHistoryNotes',
    transform: (annotations) => {
      const next = structuredClone(annotations)
      next.settlements = (next.settlements ?? []).map((row) => {
        const copy = { ...row }
        delete copy.history
        delete copy.kitHistoryNotes
        return copy
      })
      return next
    },
  },
  {
    id: 'no_economy',
    label: 'Drop wealth/tax/tolls/trade economy fields',
    transform: (annotations) => {
      const next = structuredClone(annotations)
      next.settlements = (next.settlements ?? []).map((row) => {
        const copy = { ...row }
        delete copy.wealth
        delete copy.factionTax
        delete copy.portTolls
        delete copy.supplies
        delete copy.wants
        delete copy.imports
        delete copy.exports
        return copy
      })
      return next
    },
  },
  {
    id: 'no_politics',
    label: 'Drop factions roster, rivalries, membership fields',
    transform: (annotations) => {
      const next = structuredClone(annotations)
      next.factions = []
      next.rivalryEdges = []
      next.settlements = (next.settlements ?? []).map((row) => {
        const copy = { ...row }
        delete copy.factionId
        delete copy.membershipBand
        delete copy.isTradePartner
        delete copy.factionCapitalMapNumber
        return copy
      })
      return next
    },
  },
  {
    id: 'geo_only',
    label: 'Biome/maritime/tier/pop + ids only',
    transform: (annotations) => {
      const next = structuredClone(annotations)
      next.factions = (next.factions ?? []).map((f) => ({ id: f.id }))
      next.rivalryEdges = []
      next.settlements = (next.settlements ?? []).map((row) => ({
        settlementId: row.settlementId,
        mapNumber: row.mapNumber,
        status: row.status,
        tier: row.tier,
        population: row.population,
        biome: row.biome,
        maritimeRole: row.maritimeRole,
        foundedEpoch: row.foundedEpoch,
      }))
      return next
    },
  },
  {
    id: 'ids_flavor_only',
    label: 'Ids + mapNumbers + faction ids only',
    transform: (annotations) => {
      const next = structuredClone(annotations)
      next.factions = (next.factions ?? []).map((f) => ({ id: f.id }))
      next.rivalryEdges = []
      next.settlements = (next.settlements ?? []).map((row) => ({
        settlementId: row.settlementId,
        mapNumber: row.mapNumber,
      }))
      return next
    },
  },
  {
    id: 'no_antirepeat',
    label: 'Full data, no anti-repetition instructions',
    includeAntiRepetition: false,
    transform: (annotations) => structuredClone(annotations),
  },
  {
    id: 'history_kit_only',
    label: 'Keep kitHistoryNotes, drop raw history',
    transform: (annotations) => {
      const next = structuredClone(annotations)
      next.settlements = (next.settlements ?? []).map((row) => {
        const copy = { ...row }
        delete copy.history
        return copy
      })
      return next
    },
  },
  {
    id: 'imports_exports_only',
    label: 'Economy: import/export label lists only',
    transform: (annotations) => {
      const next = structuredClone(annotations)
      next.settlements = (next.settlements ?? []).map((row) => {
        const copy = { ...row }
        delete copy.wealth
        delete copy.factionTax
        delete copy.portTolls
        delete copy.supplies
        delete copy.wants
        return copy
      })
      return next
    },
  },
  {
    id: 'politics_membership_only',
    label: 'Keep factionId/membershipBand; drop rivalries + roster detail',
    transform: (annotations) => {
      const next = structuredClone(annotations)
      next.factions = (next.factions ?? []).map((f) => ({ id: f.id }))
      next.rivalryEdges = []
      next.settlements = (next.settlements ?? []).map((row) => {
        const copy = { ...row }
        delete copy.isTradePartner
        delete copy.factionCapitalMapNumber
        return copy
      })
      return next
    },
  },
  {
    id: 'truncate_history_3',
    label: 'Cap history arrays to 3 newest per settlement',
    transform: (annotations) => {
      const next = structuredClone(annotations)
      next.settlements = (next.settlements ?? []).map((row) => {
        const history = Array.isArray(row.history) ? row.history : []
        const kitHistoryNotes = Array.isArray(row.kitHistoryNotes) ? row.kitHistoryNotes : []
        return {
          ...row,
          history: history.slice(-3),
          kitHistoryNotes: kitHistoryNotes.slice(-3),
        }
      })
      return next
    },
  },
  {
    id: 'dedupe_strip_nulls',
    label: 'Full data with null/empty fields stripped',
    transform: (annotations) => /** @type {object} */ (stripNullEmpty(structuredClone(annotations))),
  },
])

/**
 * Compact cue sheet for the judge (not the full ablation prompt).
 * @param {object} annotations
 * @returns {object}
 */
export function buildJudgeCueSheet(annotations) {
  return {
    epoch: annotations.epoch ?? null,
    factions: (annotations.factions ?? []).map((f) => ({
      id: f.id,
      capitalSettlementId: f.capitalSettlementId ?? null,
      status: f.status ?? null,
    })),
    settlements: (annotations.settlements ?? []).map((row) => ({
      settlementId: row.settlementId,
      mapNumber: row.mapNumber,
      biome: row.biome ?? null,
      factionId: row.factionId ?? null,
      membershipBand: row.membershipBand ?? null,
      maritimeRole: row.maritimeRole ?? null,
      tier: row.tier ?? null,
      historyKinds: (row.history ?? []).map((h) => h.kind).filter(Boolean),
    })),
  }
}
