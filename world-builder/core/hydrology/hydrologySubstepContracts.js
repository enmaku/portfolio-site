/** @typedef {import('./hydrologySubsteps.js').HydrologySubstepContext} HydrologySubstepContext */
/** @typedef {import('./hydrologySubsteps.js').HydrologySubstepId} HydrologySubstepId */

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
    outputKeys: ['settledElevation', 'incisedRiverNetworkMask', 'incisedCorridorMask'],
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
      'coastNavigability',
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

/**
 * @param {HydrologySubstepId} substepId
 * @param {HydrologySubstepContext} ctx
 * @returns {Record<string, unknown>}
 */
export function pickHydrologySubstepInput(substepId, ctx) {
  const prerequisite = HYDROLOGY_SUBSTEP_PREREQUISITES[substepId]
  if (prerequisite && ctx.lastCompletedSubstep !== prerequisite) {
    throw new Error(`${prerequisite} required before ${substepId}`)
  }

  const { state, width, height } = ctx
  const baselineDrainage = baselineDrainageFromContext(ctx)

  switch (substepId) {
    case 'hydrologyFill': {
      if (!state.erodedElevation) {
        throw new Error('erosion erodedElevation required before hydrologyFill')
      }
      const rainfall = rainfallSourceFromContext(ctx)
      if (!rainfall) {
        throw new Error('baseline rainfall required before hydrologyFill')
      }
      return {
        geographySeed: state.geographySeed,
        options: state.options,
        width,
        height,
        erodedElevation: state.erodedElevation,
        rainfall,
      }
    }
    case 'hydrologyClimate': {
      if (!state.erodedElevation) {
        throw new Error('erosion erodedElevation required before hydrologyClimate')
      }
      if (!baselineDrainage) {
        throw new Error('baseline drainage required before hydrologyClimate')
      }
      return {
        geographySeed: state.geographySeed,
        prevailingWindDegrees: state.prevailingWindDegrees,
        options: state.options,
        width,
        height,
        erodedElevation: state.erodedElevation,
        baselineDrainage,
      }
    }
    case 'hydrologySeasonal': {
      if (
        !ctx.filledElevation ||
        !ctx.lakeMask ||
        !ctx.lakes ||
        !ctx.lakeMeta ||
        !ctx.lakeIdByCell ||
        !ctx.catchmentCellsByLake ||
        !ctx.temperature ||
        !ctx.rainfall ||
        !ctx.snowCapMask ||
        !ctx.ocean
      ) {
        throw new Error('hydrologyFill and hydrologyClimate outputs required before hydrologySeasonal')
      }
      if (!state.erodedElevation) {
        throw new Error('erosion erodedElevation required before hydrologySeasonal')
      }
      if (!baselineDrainage) {
        throw new Error('baseline drainage required before hydrologySeasonal')
      }
      return {
        geographySeed: state.geographySeed,
        prevailingWindDegrees: state.prevailingWindDegrees,
        options: state.options,
        width,
        height,
        erodedElevation: state.erodedElevation,
        filledElevation: ctx.filledElevation,
        lakeMask: ctx.lakeMask,
        lakes: ctx.lakes,
        lakeMeta: ctx.lakeMeta,
        lakeIdByCell: ctx.lakeIdByCell,
        catchmentCellsByLake: ctx.catchmentCellsByLake,
        temperature: ctx.temperature,
        rainfall: ctx.rainfall,
        snowCapMask: ctx.snowCapMask,
        meltContribution: ctx.meltContribution,
        ocean: ctx.ocean,
        baselineDrainage,
      }
    }
    case 'hydrologyRoute': {
      if (
        !ctx.filledElevation ||
        !ctx.lakeMask ||
        !ctx.spillOutlet ||
        !ctx.temperature ||
        !ctx.rainfall ||
        !ctx.effectiveRunoff
      ) {
        throw new Error('fill, climate, and seasonal outputs required before hydrologyRoute')
      }
      if (!baselineDrainage) {
        throw new Error('baseline drainage required before hydrologyRoute')
      }
      return {
        options: state.options,
        width,
        height,
        geographySeed: state.geographySeed,
        filledElevation: ctx.filledElevation,
        lakeMask: ctx.lakeMask,
        spillOutlet: ctx.spillOutlet,
        temperature: ctx.temperature,
        rainfall: ctx.rainfall,
        effectiveRunoff: ctx.effectiveRunoff,
        meltContribution: ctx.meltContribution,
        baselineDrainage,
      }
    }
    case 'hydrologyIncise': {
      if (
        !ctx.filledElevation ||
        !ctx.lakeMask ||
        !ctx.lakeOcean ||
        !ctx.flowDirection ||
        !ctx.flowAccumulation ||
        !ctx.riverNetworkMask ||
        !ctx.effectiveRunoff
      ) {
        throw new Error('hydrologyRoute outputs required before hydrologyIncise')
      }
      return {
        options: state.options,
        width,
        height,
        geographySeed: state.geographySeed,
        filledElevation: ctx.filledElevation,
        lakeMask: ctx.lakeMask,
        lakeOcean: ctx.lakeOcean,
        flowDirection: ctx.flowDirection,
        flowAccumulation: ctx.flowAccumulation,
        riverNetworkMask: ctx.riverNetworkMask,
        effectiveRunoff: ctx.effectiveRunoff,
      }
    }
    case 'hydrologyExtract': {
      if (
        !ctx.settledElevation ||
        !ctx.lakeMask ||
        !ctx.lakeOcean ||
        !ctx.incisedCorridorMask ||
        !ctx.rainfall ||
        !ctx.effectiveRunoff
      ) {
        throw new Error('hydrologyIncise outputs required before hydrologyExtract')
      }
      if (!baselineDrainage) {
        throw new Error('baseline drainage required before hydrologyExtract')
      }
      return {
        options: state.options,
        width,
        height,
        settledElevation: ctx.settledElevation,
        lakeMask: ctx.lakeMask,
        lakeOcean: ctx.lakeOcean,
        incisedCorridorMask: ctx.incisedCorridorMask,
        rainfall: ctx.rainfall,
        effectiveRunoff: ctx.effectiveRunoff,
        meltContribution: ctx.meltContribution,
        baselineDrainage,
      }
    }
    case 'hydrologyRefine': {
      if (
        !ctx.settledElevation ||
        !ctx.effectiveRunoff ||
        !ctx.settledRiverNetworkMask ||
        !ctx.settledFlowDirection ||
        !ctx.settledFlowAccumulation ||
        !ctx.settledOcean ||
        !ctx.lakeMask
      ) {
        throw new Error('hydrologyExtract outputs required before hydrologyRefine')
      }
      return {
        options: state.options,
        width,
        height,
        geographySeed: state.geographySeed,
        settledElevation: ctx.settledElevation,
        effectiveRunoff: ctx.effectiveRunoff,
        settledRiverNetworkMask: ctx.settledRiverNetworkMask,
        settledFlowDirection: ctx.settledFlowDirection,
        settledFlowAccumulation: ctx.settledFlowAccumulation,
        settledOcean: ctx.settledOcean,
        lakeMask: ctx.lakeMask,
      }
    }
    case 'hydrologySettle': {
      if (
        !ctx.settledElevation ||
        !ctx.lakeMask ||
        !ctx.lakes ||
        !ctx.lakeMeta ||
        !ctx.settledFlowAccumulation ||
        !ctx.settledFlowDirection ||
        !ctx.settledOcean ||
        !ctx.settledRiverNetworkMask
      ) {
        throw new Error('hydrologyExtract outputs required before hydrologySettle')
      }
      if (!baselineDrainage) {
        throw new Error('baseline drainage required before hydrologySettle')
      }
      return {
        options: state.options,
        width,
        height,
        settledElevation: ctx.settledElevation,
        lakeMask: ctx.lakeMask,
        lakes: ctx.lakes,
        lakeMeta: ctx.lakeMeta,
        settledFlowAccumulation: ctx.settledFlowAccumulation,
        settledFlowDirection: ctx.settledFlowDirection,
        settledOcean: ctx.settledOcean,
        settledRiverNetworkMask: ctx.settledRiverNetworkMask,
        presentationRiverNetworkMask: ctx.presentationRiverNetworkMask,
        effectiveRunoff: ctx.effectiveRunoff,
        rainfall: ctx.rainfall,
        lakeIdByCell: ctx.lakeIdByCell,
        baselineDrainage,
      }
    }
    case 'hydrologyPaint': {
      if (
        !ctx.settledElevation ||
        !ctx.settledFlowDirection ||
        !ctx.settledRiverNetworkMask ||
        !ctx.channelWidth ||
        !ctx.settledRiverGraph
      ) {
        throw new Error('hydrologySettle outputs required before hydrologyPaint')
      }
      return {
        width,
        height,
        settledElevation: ctx.settledElevation,
        settledFlowDirection: ctx.settledFlowDirection,
        settledRiverNetworkMask: ctx.settledRiverNetworkMask,
        presentationRiverNetworkMask: ctx.presentationRiverNetworkMask,
        channelWidth: ctx.channelWidth,
        settledRiverGraph: ctx.settledRiverGraph,
        settledFlowAccumulation: ctx.settledFlowAccumulation,
        settledOcean: ctx.settledOcean,
        lakeMask: ctx.lakeMask,
      }
    }
    default:
      throw new Error(`Unknown hydrology substep: ${substepId}`)
  }
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
