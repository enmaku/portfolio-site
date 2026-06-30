/** @typedef {import('./hydrologySubsteps.js').HydrologySubstepContext} HydrologySubstepContext */
/** @typedef {import('./hydrologySubsteps.js').HydrologySubstepId} HydrologySubstepId */

/**
 * River mask inputs and outputs use {@link import('./riverMaskLifecycle.js').riverMaskContractKey}:
 * sketch → incised → settled → presentation (refine or skipRefine) → painted on `ctx.riverMaskPipeline`.
 */

import {
  getRiverMaskStage,
  isRiverMaskContractKey,
  riverMaskContractKey,
  riverMaskStageFromContractKey,
} from './riverMaskLifecycle.js'

/**
 * @typedef {Object} HydrologySubstepContract
 * @property {HydrologySubstepId} id
 * @property {string} label
 * @property {readonly string[]} inputKeys
 * @property {readonly string[]} outputKeys
 */

/** @type {readonly HydrologySubstepId[]} */
export const HYDROLOGY_SUBSTEP_IDS = [
  'hydrologyFill',
  'hydrologyClimate',
  'hydrologySeasonal',
  'hydrologyRoute',
  'hydrologyIncise',
  'hydrologyExtract',
  'hydrologyRefine',
  'hydrologySettle',
  'hydrologyPaint',
]

/** @type {Record<HydrologySubstepId, HydrologySubstepContract>} */
export const HYDROLOGY_SUBSTEP_CONTRACTS = {
  hydrologyFill: {
    id: 'hydrologyFill',
    label: 'Fill lakes',
    inputKeys: ['geographySeed', 'options', 'width', 'height', 'erodedElevation', 'rainfall'],
    outputKeys: [
      'ocean',
      'lakeMask',
      'lakes',
      'lakeMeta',
      'hydrologyStats',
      'filledElevation',
      'spillOutlet',
      'lakeIdByCell',
      'catchmentCellsByLake',
    ],
  },
  hydrologyClimate: {
    id: 'hydrologyClimate',
    label: 'Climate refresh',
    inputKeys: [
      'geographySeed',
      'prevailingWindDegrees',
      'options',
      'width',
      'height',
      'erodedElevation',
      'baselineDrainage',
    ],
    outputKeys: ['temperature', 'rainfall', 'snowCapMask', 'meltContribution'],
  },
  hydrologySeasonal: {
    id: 'hydrologySeasonal',
    label: 'Seasonal hydrology',
    inputKeys: [
      'geographySeed',
      'prevailingWindDegrees',
      'options',
      'width',
      'height',
      'erodedElevation',
      'filledElevation',
      'lakeMask',
      'lakes',
      'lakeMeta',
      'lakeIdByCell',
      'catchmentCellsByLake',
      'temperature',
      'rainfall',
      'snowCapMask',
      'meltContribution',
      'ocean',
      'baselineDrainage',
    ],
    outputKeys: ['effectiveRunoff', 'overflowLakeIds', 'filledElevation', 'lakeMeta', 'lakes'],
  },
  hydrologyRoute: {
    id: 'hydrologyRoute',
    label: 'Route runoff',
    inputKeys: [
      'options',
      'width',
      'height',
      'geographySeed',
      'filledElevation',
      'lakeMask',
      'spillOutlet',
      'temperature',
      'rainfall',
      'effectiveRunoff',
      'meltContribution',
      'baselineDrainage',
    ],
    outputKeys: ['flowDirection', 'flowAccumulation', 'lakeOcean', riverMaskContractKey('sketch')],
  },
  hydrologyIncise: {
    id: 'hydrologyIncise',
    label: 'Incise channels',
    inputKeys: [
      'options',
      'width',
      'height',
      'geographySeed',
      'filledElevation',
      'lakeMask',
      'lakeOcean',
      'flowDirection',
      'flowAccumulation',
      riverMaskContractKey('sketch'),
      'effectiveRunoff',
    ],
    outputKeys: ['settledElevation', riverMaskContractKey('incised')],
  },
  hydrologyExtract: {
    id: 'hydrologyExtract',
    label: 'Extract river graph',
    inputKeys: [
      'options',
      'width',
      'height',
      'settledElevation',
      'lakeMask',
      'lakeOcean',
      riverMaskContractKey('incised'),
      'rainfall',
      'effectiveRunoff',
      'meltContribution',
      'baselineDrainage',
    ],
    outputKeys: [
      'settledFlowDirection',
      'settledFlowAccumulation',
      'settledOcean',
      riverMaskContractKey('settled'),
      'channelWidth',
      'settledRiverGraph',
    ],
  },
  hydrologyRefine: {
    id: 'hydrologyRefine',
    label: 'Meander refine',
    inputKeys: [
      'options',
      'width',
      'height',
      'geographySeed',
      'settledElevation',
      'effectiveRunoff',
      riverMaskContractKey('settled'),
      'settledFlowDirection',
      'settledFlowAccumulation',
      'settledOcean',
      'lakeMask',
    ],
    outputKeys: ['settledElevation', riverMaskContractKey('presentation')],
  },
  hydrologySettle: {
    id: 'hydrologySettle',
    label: 'Settle drainage',
    inputKeys: [
      'options',
      'width',
      'height',
      'settledElevation',
      'lakeMask',
      'lakes',
      'lakeMeta',
      'settledFlowAccumulation',
      'settledFlowDirection',
      'settledOcean',
      riverMaskContractKey('settled'),
      riverMaskContractKey('presentation'),
      'effectiveRunoff',
      'rainfall',
      'lakeIdByCell',
      'baselineDrainage',
    ],
    outputKeys: [
      'settledElevation',
      'lakes',
      'lakeMeta',
      'spillOutlet',
      'settledFlowDirection',
      'settledFlowAccumulation',
      'settledOcean',
      'settledDrainage',
      'channelWidth',
      'settledRiverGraph',
    ],
  },
  hydrologyPaint: {
    id: 'hydrologyPaint',
    label: 'Paint river corridors',
    inputKeys: [
      'width',
      'height',
      'settledElevation',
      'settledFlowDirection',
      riverMaskContractKey('settled'),
      riverMaskContractKey('presentation'),
      'channelWidth',
      'settledRiverGraph',
      'settledFlowAccumulation',
      'settledOcean',
      'lakeMask',
    ],
    outputKeys: [riverMaskContractKey('painted'), 'riverNetwork'],
  },
}

/** @type {Record<HydrologySubstepId, HydrologySubstepId | null>} */
const HYDROLOGY_SUBSTEP_PREREQUISITES = {
  hydrologyFill: null,
  hydrologyClimate: 'hydrologyFill',
  hydrologySeasonal: 'hydrologyClimate',
  hydrologyRoute: 'hydrologySeasonal',
  hydrologyIncise: 'hydrologyRoute',
  hydrologyExtract: 'hydrologyIncise',
  hydrologyRefine: 'hydrologyExtract',
  hydrologySettle: 'hydrologyRefine',
  hydrologyPaint: 'hydrologySettle',
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function baselineDrainageFromContext(ctx) {
  return ctx.state.baselineDoc?.fields.drainage ?? ctx.state.fields?.drainage ?? null
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function rainfallSourceFromContext(ctx) {
  return ctx.state.baselineDoc?.fields.rainfall ?? ctx.state.fields?.rainfall ?? null
}

/** @type {Partial<Record<HydrologySubstepId, ReadonlySet<string>>>} */
const OPTIONAL_NULL_HYDROLOGY_INPUT_KEYS = {
  hydrologyRoute: new Set(['meltContribution']),
  hydrologyExtract: new Set(['meltContribution']),
  hydrologySeasonal: new Set(['meltContribution']),
  hydrologySettle: new Set([riverMaskContractKey('presentation'), 'lakeIdByCell']),
  hydrologyPaint: new Set([riverMaskContractKey('presentation')]),
}

/**
 * @param {HydrologySubstepId} substepId
 * @param {string} key
 * @param {HydrologySubstepContext} ctx
 */
function resolveHydrologySubstepInputKey(substepId, key, ctx) {
  const { state } = ctx
  if (isRiverMaskContractKey(key)) {
    return getRiverMaskStage(ctx.riverMaskPipeline, riverMaskStageFromContractKey(key))
  }

  switch (key) {
    case 'geographySeed':
      return state.geographySeed
    case 'prevailingWindDegrees':
      return state.prevailingWindDegrees
    case 'options':
      return state.options
    case 'width':
      return ctx.width
    case 'height':
      return ctx.height
    case 'erodedElevation':
      return state.erodedElevation
    case 'baselineDrainage':
      return baselineDrainageFromContext(ctx)
    case 'rainfall':
      return substepId === 'hydrologyFill' ? rainfallSourceFromContext(ctx) : ctx.rainfall
    default:
      return ctx[key]
  }
}

/**
 * @param {HydrologySubstepId} substepId
 * @param {string} key
 * @param {HydrologySubstepContext} ctx
 */
function requireHydrologySubstepInputKey(substepId, key, ctx) {
  const value = resolveHydrologySubstepInputKey(substepId, key, ctx)
  if (value === null || value === undefined) {
    throw new Error(`${substepId} missing input ${key}`)
  }
  return value
}

/**
 * @param {HydrologySubstepId} substepId
 * @param {string} key
 */
function isOptionalNullHydrologyInputKey(substepId, key) {
  return OPTIONAL_NULL_HYDROLOGY_INPUT_KEYS[substepId]?.has(key) ?? false
}

/**
 * @param {HydrologySubstepId} substepId
 * @param {string} key
 * @param {HydrologySubstepContext} ctx
 */
function requireHydrologySubstepOutputKey(substepId, key, ctx) {
  if (isRiverMaskContractKey(key)) {
    const value = getRiverMaskStage(ctx.riverMaskPipeline, riverMaskStageFromContractKey(key))
    if (value === null || value === undefined) {
      throw new Error(`${substepId} missing output ${key}`)
    }
    return
  }

  if (ctx[key] === null || ctx[key] === undefined) {
    throw new Error(`${substepId} missing output ${key}`)
  }
}

/**
 * @param {HydrologySubstepId} substepId
 * @param {HydrologySubstepContext} ctx
 * @returns {Record<string, unknown>}
 */
export function pickHydrologySubstepInput(substepId, ctx) {
  const contract = HYDROLOGY_SUBSTEP_CONTRACTS[substepId]
  if (!contract) {
    throw new Error(`Unknown hydrology substep: ${substepId}`)
  }

  const prerequisite = HYDROLOGY_SUBSTEP_PREREQUISITES[substepId]
  if (prerequisite && ctx.lastCompletedSubstep !== prerequisite) {
    throw new Error(`${prerequisite} required before ${substepId}`)
  }

  /** @type {Record<string, unknown>} */
  const input = {}
  for (const key of contract.inputKeys) {
    input[key] = isOptionalNullHydrologyInputKey(substepId, key)
      ? resolveHydrologySubstepInputKey(substepId, key, ctx)
      : requireHydrologySubstepInputKey(substepId, key, ctx)
  }
  return input
}

/**
 * @param {HydrologySubstepId} substepId
 * @param {HydrologySubstepContext} ctx
 */
export function assertHydrologySubstepOutputs(substepId, ctx) {
  const contract = HYDROLOGY_SUBSTEP_CONTRACTS[substepId]
  for (const key of contract.outputKeys) {
    requireHydrologySubstepOutputKey(substepId, key, ctx)
  }
}
