/** @typedef {'terrain' | 'setup' | 'running'} ColonizationPhase */
/** @typedef {'marginal' | 'typical' | 'bountiful'} YieldModifier */

/**
 * @typedef {Object} ColonistSettings
 * @property {number} threeDayHaulDistance
 * @property {number} startingPopulation
 * @property {number} peoplePerHabitableCell Landscape packing density for the land leg of population ceiling.
 * @property {number} populationDensity Scalar on feeding and land packing (and matching food lb yields).
 * @property {YieldModifier} yieldModifier
 * @property {number} landExpeditionRange Multiplier on three-day haul distance for land expedition range cap.
 * @property {number} inlandSailExpeditionRange Multiplier on three-day haul distance for inland sail expedition range cap.
 * @property {number} openSeaExpeditionRange Multiplier on three-day haul distance for open-sea expedition range cap.
 */

/**
 * @typedef {Object} TradeRouteState
 * @property {import('./tradeGraph/buildCandidateRoutes.js').TradeRouteEdge[]} candidates
 * @property {import('../economy/tradeClearing/clearingState.js').TradeFlow[]} activeFlows
 */

/**
 * @typedef {Object} TradeAccountsSlice
 * @property {import('../economy/ledgers/bilateralObligations.js').BilateralObligation[]} obligations
 * @property {Record<string, number>} balancesBySettlementId
 */

/**
 * @typedef {Object} FoundingLanding
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} ColonizationSlice
 * @property {ColonizationPhase} colonizationPhase
 * @property {number} epoch
 * @property {ColonistSettings} colonistSettings
 * @property {FoundingLanding | null} foundingLanding
 * @property {object[]} historyLog
 * @property {object[]} settlements
 * @property {string | null} realmId
 * @property {Record<string, Array<{ x: number, y: number }>>} primaryClaim
 * @property {Float32Array | null} populationCollapseRaster Derived in-memory overlay raster; never persisted.
 * @property {object[]} notableFigures
 * @property {Uint8Array | null} visitedCells In-memory exploration fog raster; never persisted.
 * @property {object[]} expeditions Active and completed expedition records.
 * @property {boolean} frontierExhausted All logistics nodes founded or exhausted.
 * @property {import('./roads/roadNetwork.js').RoadSegment[]} roads Persisted overland link geometry.
 * @property {import('./logisticsNodes/scoreLogisticsNodes.js').LogisticsNodeSurveyEntry[]} logisticsNodeSurvey Scored founding candidates.
 * @property {TradeAccountsSlice} tradeAccounts Mutual-credit realm ledgers.
 * @property {Record<string, number>} externalTradeAccounts Port off-map credit (≥ 0).
 * @property {Record<string, number>} priorRealizedIncomeCp Last active clear's on-map export+toll income by settlement.
 * @property {TradeRouteState} tradeRouteState Candidate edges and current-epoch flows.
 * @property {import('../economy/economyEpochSnapshot.js').EconomyEpochSnapshot | null} lastTradeEpochResult Inspect payload from last clearing.
 * @property {number | null} increment3LatchedEpoch Epoch when supply-chain independence latched; null until latch.
 * @property {FactionRecord[]} factions Living and extinct faction roster (sticky membership).
 * @property {MembershipCooldownEntry[]} membershipCooldown Anti-churn refractory floors.
 * @property {PendingComponentMint[]} pendingComponentMints Staggered post-latch faction mint queue.
 * @property {Record<string, number>} factionDependenceStreak Asymmetric dependence streak keys `weak->strong`.
 * @property {Record<string, number>} mutualReintegrationStreak Mutual reintegration streak keys `idA|idB`.
 * @property {Record<string, number>} unalignedViabilityStreak Lone-unaligned crystallize viability by settlement id.
 * @property {Record<string, number>} membershipCauseClearStreak Clear-and-rearm counters by subject id.
 * @property {Record<string, number>} vassalIndependenceStreak Local food independence streak by vassal settlement id.
 */

/**
 * @typedef {Object} FactionRecord
 * @property {string} id
 * @property {string} capitalSettlementId
 * @property {string[]} settlementIds
 * @property {'active' | 'extinct'} status
 * @property {number} emergedEpoch
 */

/**
 * @typedef {Object} MembershipCooldownEntry
 * @property {string} subjectId Settlement or faction id under refractory.
 * @property {number} untilEpoch Inclusive epoch until which inverse flips are blocked.
 * @property {string} kind Cooldown cause (e.g. vassal_defection, faction_absorption).
 */

/**
 * @typedef {Object} PendingComponentMint
 * @property {string} componentKey Deterministic logistics-connectivity component key.
 * @property {string[]} settlementIds Living pins waiting to crystallize together.
 * @property {number} dueEpoch Epoch when the cohort mints.
 */

import { resolveExpeditions } from './expeditions/expeditionConstants.js'
import {
  logisticsNodeSurveyPatchesForStorage,
  resolveLogisticsNodeSurvey,
} from './logisticsNodes/scoreLogisticsNodes.js'
import { resolveRoadSegments } from './roads/roadNetwork.js'
import { ensureSettlementMapNumbers } from './settlementMapNumber.js'
import { resolveEconomyEpochSnapshot } from '../economy/economyEpochSnapshot.js'

export const COLONIZATION_PHASE_TERRAIN = /** @type {const} */ ('terrain')
export const COLONIZATION_PHASE_SETUP = /** @type {const} */ ('setup')
export const COLONIZATION_PHASE_RUNNING = /** @type {const} */ ('running')

/** Persisted colonization slice fields (excludes derived collapse raster). */
export const COLONIZATION_SLICE_KEYS = /** @type {const} */ ([
  'colonizationPhase',
  'epoch',
  'colonistSettings',
  'foundingLanding',
  'historyLog',
  'settlements',
  'realmId',
  'primaryClaim',
  'notableFigures',
  'visitedCells',
  'expeditions',
  'frontierExhausted',
  'roads',
  'logisticsNodeSurvey',
  'tradeAccounts',
  'externalTradeAccounts',
  'priorRealizedIncomeCp',
  'tradeRouteState',
  'lastTradeEpochResult',
  'increment3LatchedEpoch',
  'factions',
  'membershipCooldown',
  'pendingComponentMints',
  'factionDependenceStreak',
  'mutualReintegrationStreak',
  'unalignedViabilityStreak',
  'membershipCauseClearStreak',
  'vassalIndependenceStreak',
])

/** Derived overlay fields rebuilt on hydrate; never written to session or terrain caches. */
export const COLONIZATION_DERIVED_WORLD_DOCUMENT_KEYS = /** @type {const} */ ([
  'populationCollapseRaster',
  'visitedCells',
])

/** Present-day fields rebuilt from geography + settlements on hydrate; not stored in session caches. */
export const COLONIZATION_RECOMPUTE_ON_HYDRATE_KEYS = /** @type {const} */ ([
  'primaryClaim',
])

export const DEFAULT_THREE_DAY_HAUL_DISTANCE = 100
/** Upper bound for author scale calibration. */
export const MAX_THREE_DAY_HAUL_DISTANCE = 300
export const DEFAULT_STARTING_POPULATION = 100
export const DEFAULT_PEOPLE_PER_HABITABLE_CELL = 10
export const MIN_PEOPLE_PER_HABITABLE_CELL = 1
export const MAX_PEOPLE_PER_HABITABLE_CELL = 50
export const DEFAULT_POPULATION_DENSITY = 1
export const MIN_POPULATION_DENSITY = 0.5
export const MAX_POPULATION_DENSITY = 2
export const DEFAULT_YIELD_MODIFIER = /** @type {YieldModifier} */ ('typical')
export const DEFAULT_LAND_EXPEDITION_RANGE = 2
export const MIN_LAND_EXPEDITION_RANGE = 1
export const MAX_LAND_EXPEDITION_RANGE = 4
export const DEFAULT_INLAND_SAIL_EXPEDITION_RANGE = 3
export const MIN_INLAND_SAIL_EXPEDITION_RANGE = 2
export const MAX_INLAND_SAIL_EXPEDITION_RANGE = 6
export const DEFAULT_OPEN_SEA_EXPEDITION_RANGE = 8
export const MIN_OPEN_SEA_EXPEDITION_RANGE = 4
export const MAX_OPEN_SEA_EXPEDITION_RANGE = 12

/**
 * @returns {TradeAccountsSlice}
 */
export function createEmptyTradeAccountsSlice() {
  return { obligations: [], balancesBySettlementId: {} }
}

/**
 * @returns {TradeRouteState}
 */
export function createEmptyTradeRouteState() {
  return { candidates: [], activeFlows: [] }
}

/**
 * @returns {ColonistSettings}
 */
export function createDefaultColonistSettings() {
  return {
    threeDayHaulDistance: DEFAULT_THREE_DAY_HAUL_DISTANCE,
    startingPopulation: DEFAULT_STARTING_POPULATION,
    peoplePerHabitableCell: DEFAULT_PEOPLE_PER_HABITABLE_CELL,
    populationDensity: DEFAULT_POPULATION_DENSITY,
    yieldModifier: DEFAULT_YIELD_MODIFIER,
    landExpeditionRange: DEFAULT_LAND_EXPEDITION_RANGE,
    inlandSailExpeditionRange: DEFAULT_INLAND_SAIL_EXPEDITION_RANGE,
    openSeaExpeditionRange: DEFAULT_OPEN_SEA_EXPEDITION_RANGE,
  }
}

/**
 * @returns {ColonizationSlice}
 */
export function createDefaultColonizationSlice() {
  return {
    colonizationPhase: COLONIZATION_PHASE_TERRAIN,
    epoch: 0,
    colonistSettings: createDefaultColonistSettings(),
    foundingLanding: null,
    historyLog: [],
    settlements: [],
    realmId: null,
    primaryClaim: {},
    populationCollapseRaster: null,
    notableFigures: [],
    visitedCells: null,
    expeditions: [],
    frontierExhausted: false,
    roads: [],
    logisticsNodeSurvey: [],
    tradeAccounts: createEmptyTradeAccountsSlice(),
    externalTradeAccounts: {},
    priorRealizedIncomeCp: {},
    tradeRouteState: createEmptyTradeRouteState(),
    lastTradeEpochResult: null,
    increment3LatchedEpoch: null,
    factions: [],
    membershipCooldown: [],
    pendingComponentMints: [],
    factionDependenceStreak: {},
    mutualReintegrationStreak: {},
    unalignedViabilityStreak: {},
    membershipCauseClearStreak: {},
    vassalIndependenceStreak: {},
  }
}

/**
 * @param {unknown} value
 * @returns {ColonizationSlice}
 */
export function resolveColonizationSlice(value) {
  const defaults = createDefaultColonizationSlice()
  if (!value || typeof value !== 'object') {
    return defaults
  }
  const incoming = /** @type {Partial<ColonizationSlice>} */ (value)
  const phase = incoming.colonizationPhase
  const colonizationPhase =
    phase === COLONIZATION_PHASE_SETUP ||
    phase === COLONIZATION_PHASE_RUNNING ||
    phase === COLONIZATION_PHASE_TERRAIN
      ? phase
      : defaults.colonizationPhase

  return {
    colonizationPhase,
    colonistSettings: resolveColonistSettings(incoming.colonistSettings),
    foundingLanding: resolveFoundingLanding(incoming.foundingLanding),
    historyLog: Array.isArray(incoming.historyLog) ? incoming.historyLog.map((row) => ({ ...row })) : [],
    settlements: ensureSettlementMapNumbers(
      Array.isArray(incoming.settlements) ? incoming.settlements : [],
    ),
    realmId: typeof incoming.realmId === 'string' ? incoming.realmId : null,
    epoch: Number.isFinite(incoming.epoch) ? /** @type {number} */ (incoming.epoch) : 0,
    primaryClaim: resolvePrimaryClaim(incoming.primaryClaim),
    populationCollapseRaster: null,
    notableFigures: Array.isArray(incoming.notableFigures)
      ? incoming.notableFigures.map((row) => ({ ...row }))
      : [],
    visitedCells: null,
    expeditions: resolveExpeditions(incoming.expeditions),
    frontierExhausted: incoming.frontierExhausted === true,
    roads: resolveRoadSegments(incoming.roads),
    logisticsNodeSurvey: resolveLogisticsNodeSurvey(incoming.logisticsNodeSurvey),
    tradeAccounts: resolveTradeAccounts(incoming.tradeAccounts),
    externalTradeAccounts: resolveExternalTradeAccounts(incoming.externalTradeAccounts),
    priorRealizedIncomeCp: resolvePriorRealizedIncomeCp(incoming.priorRealizedIncomeCp),
    tradeRouteState: resolveTradeRouteState(incoming.tradeRouteState),
    lastTradeEpochResult: resolveLastTradeEpochResult(incoming.lastTradeEpochResult),
    increment3LatchedEpoch: resolveIncrement3LatchedEpoch(incoming.increment3LatchedEpoch),
    factions: resolveFactions(incoming.factions),
    membershipCooldown: resolveMembershipCooldown(incoming.membershipCooldown),
    pendingComponentMints: resolvePendingComponentMints(incoming.pendingComponentMints),
    factionDependenceStreak: resolveStreakMap(incoming.factionDependenceStreak),
    mutualReintegrationStreak: resolveStreakMap(incoming.mutualReintegrationStreak),
    unalignedViabilityStreak: resolveStreakMap(incoming.unalignedViabilityStreak),
    membershipCauseClearStreak: resolveStreakMap(incoming.membershipCauseClearStreak),
    vassalIndependenceStreak: resolveStreakMap(incoming.vassalIndependenceStreak),
  }
}

/**
 * @param {unknown} value
 * @returns {Record<string, Array<{ x: number, y: number }>>}
 */
function resolvePrimaryClaim(value) {
  if (!value || typeof value !== 'object') {
    return {}
  }
  /** @type {Record<string, Array<{ x: number, y: number }>>} */
  const resolved = {}
  for (const [settlementId, cells] of Object.entries(value)) {
    if (!Array.isArray(cells)) continue
    resolved[settlementId] = cells
      .filter((cell) => cell && Number.isFinite(cell.x) && Number.isFinite(cell.y))
      .map((cell) => ({ x: /** @type {number} */ (cell.x), y: /** @type {number} */ (cell.y) }))
  }
  return resolved
}

/**
 * @param {unknown} value
 * @returns {ColonistSettings}
 */
export function resolveColonistSettings(value) {
  const defaults = createDefaultColonistSettings()
  if (!value || typeof value !== 'object') {
    return defaults
  }
  const incoming = /** @type {Partial<ColonistSettings>} */ (value)
  const yieldModifier =
    incoming.yieldModifier === 'marginal' ||
    incoming.yieldModifier === 'typical' ||
    incoming.yieldModifier === 'bountiful'
      ? incoming.yieldModifier
      : defaults.yieldModifier

  return {
    threeDayHaulDistance: clampPositiveNumber(
      incoming.threeDayHaulDistance,
      defaults.threeDayHaulDistance,
      MAX_THREE_DAY_HAUL_DISTANCE,
    ),
    startingPopulation: positiveNumberOr(
      incoming.startingPopulation,
      defaults.startingPopulation,
    ),
    peoplePerHabitableCell: clampIntegerRange(
      incoming.peoplePerHabitableCell,
      defaults.peoplePerHabitableCell,
      MIN_PEOPLE_PER_HABITABLE_CELL,
      MAX_PEOPLE_PER_HABITABLE_CELL,
    ),
    populationDensity: clampNumberRange(
      incoming.populationDensity,
      defaults.populationDensity,
      MIN_POPULATION_DENSITY,
      MAX_POPULATION_DENSITY,
    ),
    yieldModifier,
    landExpeditionRange: clampIntegerRange(
      incoming.landExpeditionRange,
      defaults.landExpeditionRange,
      MIN_LAND_EXPEDITION_RANGE,
      MAX_LAND_EXPEDITION_RANGE,
    ),
    inlandSailExpeditionRange: clampIntegerRange(
      incoming.inlandSailExpeditionRange ??
        /** @type {{ sailExpeditionRange?: number }} */ (incoming).sailExpeditionRange,
      defaults.inlandSailExpeditionRange,
      MIN_INLAND_SAIL_EXPEDITION_RANGE,
      MAX_INLAND_SAIL_EXPEDITION_RANGE,
    ),
    openSeaExpeditionRange: clampIntegerRange(
      incoming.openSeaExpeditionRange,
      defaults.openSeaExpeditionRange,
      MIN_OPEN_SEA_EXPEDITION_RANGE,
      MAX_OPEN_SEA_EXPEDITION_RANGE,
    ),
  }
}

/**
 * @param {unknown} value
 * @returns {TradeAccountsSlice}
 */
function resolveTradeAccounts(value) {
  const empty = createEmptyTradeAccountsSlice()
  if (!value || typeof value !== 'object') {
    return empty
  }
  const incoming = /** @type {Partial<TradeAccountsSlice>} */ (value)
  const obligations = Array.isArray(incoming.obligations)
    ? incoming.obligations
        .filter(
          (row) =>
            row &&
            typeof row.creditorSettlementId === 'string' &&
            typeof row.debtorSettlementId === 'string' &&
            typeof row.amountCp === 'number' &&
            Number.isFinite(row.amountCp),
        )
        .map((row) => ({
          creditorSettlementId: row.creditorSettlementId,
          debtorSettlementId: row.debtorSettlementId,
          amountCp: Math.round(row.amountCp) || 0,
        }))
        .filter((row) => row.amountCp > 0)
    : []
  /** @type {Record<string, number>} */
  const balancesBySettlementId = {}
  if (incoming.balancesBySettlementId && typeof incoming.balancesBySettlementId === 'object') {
    for (const [id, amount] of Object.entries(incoming.balancesBySettlementId)) {
      if (typeof amount === 'number' && Number.isFinite(amount)) {
        const rounded = Math.round(amount) || 0
        if (rounded !== 0) balancesBySettlementId[id] = rounded
      }
    }
  }
  return { obligations, balancesBySettlementId }
}

/**
 * @param {unknown} value
 * @returns {Record<string, number>}
 */
function resolveExternalTradeAccounts(value) {
  if (!value || typeof value !== 'object') {
    return {}
  }
  /** @type {Record<string, number>} */
  const resolved = {}
  for (const [id, amount] of Object.entries(value)) {
    if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) {
      const rounded = Math.round(amount) || 0
      if (rounded > 0) resolved[id] = rounded
    }
  }
  return resolved
}

/**
 * @param {unknown} value
 * @returns {Record<string, number>}
 */
function resolvePriorRealizedIncomeCp(value) {
  if (!value || typeof value !== 'object') {
    return {}
  }
  /** @type {Record<string, number>} */
  const resolved = {}
  for (const [id, amount] of Object.entries(value)) {
    if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 0) {
      resolved[id] = amount
    }
  }
  return resolved
}

/**
 * @param {unknown} value
 * @returns {TradeRouteState}
 */
function resolveTradeRouteState(value) {
  const empty = createEmptyTradeRouteState()
  if (!value || typeof value !== 'object') {
    return empty
  }
  const incoming = /** @type {Partial<TradeRouteState>} */ (value)
  return {
    candidates: Array.isArray(incoming.candidates)
      ? incoming.candidates.map((edge) => ({ ...edge }))
      : [],
    activeFlows: Array.isArray(incoming.activeFlows)
      ? incoming.activeFlows.map((flow) => ({ ...flow }))
      : [],
  }
}

/**
 * @param {unknown} value
 * @returns {import('../economy/economyEpochSnapshot.js').EconomyEpochSnapshot | null}
 */
function resolveLastTradeEpochResult(value) {
  return resolveEconomyEpochSnapshot(value)
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function resolveIncrement3LatchedEpoch(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * @param {unknown} value
 * @returns {FactionRecord[]}
 */
function resolveFactions(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (row) =>
        row &&
        typeof row.id === 'string' &&
        typeof row.capitalSettlementId === 'string' &&
        Array.isArray(row.settlementIds) &&
        (row.status === 'active' || row.status === 'extinct') &&
        typeof row.emergedEpoch === 'number' &&
        Number.isFinite(row.emergedEpoch),
    )
    .map((row) => ({
      id: row.id,
      capitalSettlementId: row.capitalSettlementId,
      settlementIds: row.settlementIds.filter((id) => typeof id === 'string'),
      status: row.status,
      emergedEpoch: row.emergedEpoch,
    }))
}

/**
 * @param {unknown} value
 * @returns {MembershipCooldownEntry[]}
 */
function resolveMembershipCooldown(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (row) =>
        row &&
        typeof row.subjectId === 'string' &&
        typeof row.untilEpoch === 'number' &&
        Number.isFinite(row.untilEpoch) &&
        typeof row.kind === 'string',
    )
    .map((row) => ({
      subjectId: row.subjectId,
      untilEpoch: row.untilEpoch,
      kind: row.kind,
    }))
}

/**
 * @param {unknown} value
 * @returns {PendingComponentMint[]}
 */
function resolvePendingComponentMints(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (row) =>
        row &&
        typeof row.componentKey === 'string' &&
        Array.isArray(row.settlementIds) &&
        typeof row.dueEpoch === 'number' &&
        Number.isFinite(row.dueEpoch),
    )
    .map((row) => ({
      componentKey: row.componentKey,
      settlementIds: row.settlementIds.filter((id) => typeof id === 'string'),
      dueEpoch: row.dueEpoch,
    }))
}

/**
 * @param {unknown} value
 * @returns {Record<string, number>}
 */
function resolveStreakMap(value) {
  if (!value || typeof value !== 'object') return {}
  /** @type {Record<string, number>} */
  const resolved = {}
  for (const [key, streak] of Object.entries(value)) {
    if (typeof streak === 'number' && Number.isFinite(streak) && streak > 0) {
      resolved[key] = Math.floor(streak)
    }
  }
  return resolved
}

/**
 * @param {unknown} value
 * @returns {FoundingLanding | null}
 */
function resolveFoundingLanding(value) {
  if (!value || typeof value !== 'object') {
    return null
  }
  const incoming = /** @type {{ x?: unknown, y?: unknown }} */ (value)
  if (!Number.isFinite(incoming.x) || !Number.isFinite(incoming.y)) {
    return null
  }
  return { x: /** @type {number} */ (incoming.x), y: /** @type {number} */ (incoming.y) }
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function positiveNumberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} max
 * @returns {number}
 */
function clampPositiveNumber(value, fallback, max) {
  const resolved = positiveNumberOr(value, fallback)
  return Math.min(resolved, max)
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampIntegerRange(value, fallback, min, max) {
  const resolved =
    typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback
  return Math.min(max, Math.max(min, resolved))
}

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampNumberRange(value, fallback, min, max) {
  const resolved = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, resolved))
}

/**
 * @param {ColonizationPhase} phase
 * @returns {number}
 */
function colonizationPhaseRank(phase) {
  if (phase === COLONIZATION_PHASE_RUNNING) {
    return 2
  }
  if (phase === COLONIZATION_PHASE_SETUP) {
    return 1
  }
  return 0
}

/**
 * Pick the furthest-along colonization session among candidates (running beats setup).
 *
 * @param {...(ColonizationSlice | null | undefined)} candidates
 * @returns {ColonizationSlice}
 */
export function mergeColonizationSessions(...candidates) {
  let best = createDefaultColonizationSlice()
  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }
    const resolved = resolveColonizationSlice(candidate)
    const resolvedRank = colonizationPhaseRank(resolved.colonizationPhase)
    const bestRank = colonizationPhaseRank(best.colonizationPhase)
    if (resolvedRank > bestRank || (resolvedRank === bestRank && resolved.epoch > best.epoch)) {
      best = resolved
    }
  }
  return best
}

/**
 * @param {ColonizationSlice} slice
 * @returns {ColonizationSlice}
 */
export function cloneColonizationSlice(slice) {
  const resolved = resolveColonizationSlice(slice)
  const raster = slice?.populationCollapseRaster
  if (raster instanceof Float32Array) {
    resolved.populationCollapseRaster = new Float32Array(raster)
  }
  const visited = slice?.visitedCells
  if (visited instanceof Uint8Array) {
    resolved.visitedCells = new Uint8Array(visited)
  }
  return resolved
}

/**
 * Persistable colonization session: history + sim state only. Overlay rasters, present-day
 * claim maps, and full logistics surveys are rebuilt on hydrate.
 *
 * @param {ColonizationSlice} slice
 * @returns {Omit<ColonizationSlice, 'populationCollapseRaster' | 'visitedCells' | 'primaryClaim'>}
 */
export function serializeColonizationSessionForStorage(slice) {
  const resolved = resolveColonizationSlice(slice)
  const {
    populationCollapseRaster,
    visitedCells,
    primaryClaim,
    logisticsNodeSurvey,
    ...persistedCore
  } = resolved
  void populationCollapseRaster
  void visitedCells
  void primaryClaim

  const persistable = {
    ...persistedCore,
    logisticsNodeSurvey: logisticsNodeSurveyPatchesForStorage(logisticsNodeSurvey),
  }

  return /** @type {Omit<ColonizationSlice, 'populationCollapseRaster' | 'visitedCells' | 'primaryClaim'>} */ (
    JSON.parse(JSON.stringify(persistable))
  )
}

/**
 * @param {object | null | undefined} source
 * @returns {Partial<ColonizationSlice>}
 */
export function pickColonizationSliceFields(source) {
  if (!source || typeof source !== 'object') {
    return {}
  }
  /** @type {Partial<ColonizationSlice>} */
  const picked = {}
  const record = /** @type {Record<string, unknown>} */ (source)
  for (const key of COLONIZATION_SLICE_KEYS) {
    if (key in record) {
      picked[key] = /** @type {ColonizationSlice[typeof key]} */ (record[key])
    }
  }
  return picked
}

/**
 * Geography-only shallow copy (colonization fields removed).
 * @template {object} T
 * @param {T} doc
 * @returns {T}
 */
export function omitColonizationSliceFields(doc) {
  const next = { ...doc }
  for (const key of COLONIZATION_SLICE_KEYS) {
    delete next[key]
  }
  return next
}
