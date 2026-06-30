/** @typedef {import('./hydrologySubsteps.js').HydrologySubstepContext} HydrologySubstepContext */
/** @typedef {import('./hydrologySubsteps.js').HydrologySubstepId} HydrologySubstepId */

/**
 * River mask fields follow {@link import('./riverMaskLifecycle.js').RIVER_MASK_LIFECYCLE_FIELDS}:
 * sketch → incised → settled → presentation (refine or skipRefine) → painted.
 */

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
    outputKeys: ['flowDirection', 'flowAccumulation', 'lakeOcean', 'riverNetworkMask'],
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
      'riverNetworkMask',
      'effectiveRunoff',
    ],
    outputKeys: ['settledElevation', 'incisedCorridorMask'],
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
      'incisedCorridorMask',
      'rainfall',
      'effectiveRunoff',
      'meltContribution',
      'baselineDrainage',
    ],
    outputKeys: [
      'settledFlowDirection',
      'settledFlowAccumulation',
      'settledOcean',
      'settledRiverNetworkMask',
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
      'settledRiverNetworkMask',
      'settledFlowDirection',
      'settledFlowAccumulation',
      'settledOcean',
      'lakeMask',
    ],
    outputKeys: ['settledElevation', 'presentationRiverNetworkMask'],
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
      'settledRiverNetworkMask',
      'presentationRiverNetworkMask',
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
      'settledRiverNetworkMask',
      'presentationRiverNetworkMask',
      'channelWidth',
      'settledRiverGraph',
      'settledFlowAccumulation',
      'settledOcean',
      'lakeMask',
    ],
    outputKeys: ['riverCorridorMask', 'riverNetwork'],
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
  hydrologySettle: new Set(['presentationRiverNetworkMask', 'lakeIdByCell']),
  hydrologyPaint: new Set(['presentationRiverNetworkMask']),
}

/**
 * @param {HydrologySubstepId} substepId
 * @param {string} key
 * @param {HydrologySubstepContext} ctx
 */
function resolveHydrologySubstepInputKey(substepId, key, ctx) {
  const { state } = ctx
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
    if (ctx[key] === null || ctx[key] === undefined) {
      throw new Error(`${substepId} missing output ${key}`)
    }
  }
}
