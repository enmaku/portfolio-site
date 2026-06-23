import { classifyBiomesWithHydrology } from '../classifyBiomesFromFields.js'
import { refreshFieldsAfterErosion } from '../fields/refreshFieldsAfterErosion.js'
import { buildRiverGraph } from './buildRiverGraph.js'
import { buildRiverNetworkMask } from './buildRiverNetworkMask.js'
import {
  connectNearbyRiverCorridors,
  riverAttractionRadiusForGrid,
} from './connectNearbyRiverCorridors.js'
import { computeFlowAccumulation } from './computeFlowAccumulation.js'
import { deriveDrainageFromFlow } from './deriveDrainageFromFlow.js'
import {
  deriveSnowCapMask,
  deriveSnowMeltContribution,
} from './deriveSnowCapMask.js'
import {
  buildChannelWidthField,
  extractRiverNetworkFromIncisedChannels,
  deriveIncisedCorridorMask,
  unionCorridorMasks,
} from './extractRiverNetworkFromIncisedChannels.js'
import { deriveBasinCatchments } from './deriveBasinCatchments.js'
import { computeCellRunoff } from './computeCellRunoff.js'
import { fillLakes } from './fillLakes.js'
import { applyLakeSurfacesFromMeta } from './lakeDisplayCoherence.js'
import {
  refineRiverNetworkFromSketch,
  riverSettlementStepsForGrid,
} from './refineRiverNetwork.js'
import { carveTemporaryRivers } from './seededTemporaryRiverCarve.js'
import { settleLakeEquilibrium } from './settleLakeEquilibrium.js'
import { simulateSeasonalHydrology } from './simulateSeasonalHydrology.js'

/** @typedef {'hydrologyFill' | 'hydrologyClimate' | 'hydrologySeasonal' | 'hydrologyRoute' | 'hydrologyIncise' | 'hydrologyExtract' | 'hydrologyRefine' | 'hydrologySettle'} HydrologySubstepId */

/** @type {ReadonlyArray<{ id: HydrologySubstepId, label: string }>} */
export const HYDROLOGY_SUBSTEPS = [
  { id: 'hydrologyFill', label: 'Fill lakes' },
  { id: 'hydrologyClimate', label: 'Climate refresh' },
  { id: 'hydrologySeasonal', label: 'Seasonal hydrology' },
  { id: 'hydrologyRoute', label: 'Route runoff' },
  { id: 'hydrologyIncise', label: 'Incise channels' },
  { id: 'hydrologyExtract', label: 'Extract river graph' },
  { id: 'hydrologyRefine', label: 'Meander refine' },
  { id: 'hydrologySettle', label: 'Settle drainage' },
]

/**
 * @typedef {Object} HydrologySubstepTiming
 * @property {HydrologySubstepId} substepId
 * @property {string} label
 * @property {number} durationMs
 * @property {boolean=} skipped
 */

/**
 * @typedef {Object} HydrologySubstepHooks
 * @property {(payload: { substepId: HydrologySubstepId, substepIndex: number, substepCount: number, label: string }) => void} [onSubstepStart]
 * @property {(payload: { substepId: HydrologySubstepId, substepIndex: number, substepCount: number, label: string, progress: number }) => void} [onSubstepProgress]
 * @property {(payload: { substepId: HydrologySubstepId, substepIndex: number, substepCount: number, label: string, progress: number, skipped?: boolean }) => void} [onSubstepComplete]
 * @property {() => boolean} [shouldCancel]
 */

/**
 * @typedef {Object} HydrologySubstepContext
 * @property {import('../derivedGeographyPipeline.js').DerivedGeographyPipelineState} state
 * @property {number} width
 * @property {number} height
 * @property {boolean[] | null} ocean
 * @property {Uint8Array | null} lakeMask
 * @property {import('../types.js').LakeRecord[] | null} lakes
 * @property {import('../types.js').LakeMetaRecord[] | null} lakeMeta
 * @property {import('../types.js').HydrologyPipelineStats | null} hydrologyStats
 * @property {Float32Array | null} filledElevation
 * @property {Int32Array | null} spillOutlet
 * @property {Float32Array | null} temperature
 * @property {Float32Array | null} rainfall
 * @property {Uint8Array | null} snowCapMask
 * @property {Float32Array | null} meltContribution
 * @property {Float32Array | null} effectiveRunoff
 * @property {Int32Array | null} lakeIdByCell
 * @property {number[][] | null} catchmentCellsByLake
 * @property {Set<number> | null} overflowLakeIds
 * @property {Int16Array | null} flowDirection
 * @property {Float32Array | null} flowAccumulation
 * @property {boolean[] | null} lakeOcean
 * @property {Uint8Array | null} riverNetworkMask
 * @property {Uint8Array | null} incisedRiverNetworkMask
 * @property {Uint8Array | null} incisedCorridorMask
 * @property {Float32Array | null} channelWidth
 * @property {Float32Array | null} coastNavigability
 * @property {Float32Array | null} settledElevation
 * @property {Uint8Array | null} settledRiverNetworkMask
 * @property {Uint8Array | null} presentationRiverNetworkMask
 * @property {Int16Array | null} settledFlowDirection
 * @property {Float32Array | null} settledFlowAccumulation
 * @property {Uint8Array | null} settledOcean
 * @property {Float32Array | null} settledDrainage
 * @property {import('../types.js').RiverGraph | null} settledRiverGraph
 * @property {HydrologySubstepHooks} hooks
 */

/**
 * @param {import('../derivedGeographyPipeline.js').DerivedGeographyPipelineState} state
 * @returns {HydrologySubstepContext}
 */
function createHydrologyContext(state, hooks = {}) {
  if (!state.erodedElevation) {
    throw new Error('Erosion required before hydrology')
  }

  return {
    state,
    hooks,
    width: state.width,
    height: state.height,
    ocean: null,
    lakeMask: null,
    lakes: null,
    lakeMeta: null,
    hydrologyStats: null,
    filledElevation: null,
    spillOutlet: null,
    temperature: null,
    rainfall: null,
    snowCapMask: null,
    meltContribution: null,
    effectiveRunoff: null,
    lakeIdByCell: null,
    catchmentCellsByLake: null,
    overflowLakeIds: null,
    flowDirection: null,
    flowAccumulation: null,
    lakeOcean: null,
    riverNetworkMask: null,
    incisedRiverNetworkMask: null,
    incisedCorridorMask: null,
    channelWidth: null,
    coastNavigability: null,
    settledElevation: null,
    settledRiverNetworkMask: null,
    presentationRiverNetworkMask: null,
    settledFlowDirection: null,
    settledFlowAccumulation: null,
    settledOcean: null,
    settledDrainage: null,
    settledRiverGraph: null,
  }
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function runHydrologyFillSubstep(ctx) {
  const { state, width, height } = ctx
  const { ocean } = computeFlowAccumulation({
    elevation: state.erodedElevation,
    width,
    height,
    seaLevel: state.options.seaLevel,
    rainfall: state.baselineDoc?.fields.rainfall ?? state.fields?.rainfall,
  })
  const useSeasonal = state.options.enableSeasonalHydrology
  const {
    lakeMask,
    lakes,
    lakeMeta,
    filledElevation,
    spillOutlet,
    lakeIdByCell,
    basinCellsByLake,
    breachCount,
    endorheicCount,
  } = fillLakes({
    elevation: state.erodedElevation,
    width,
    height,
    ocean,
    seaLevel: state.options.seaLevel,
    minLakeAreaScale: state.options.minLakeAreaScale,
    breachThreshold: state.options.breachThreshold,
    useDryFloorInitialLevel: useSeasonal,
  })
  ctx.ocean = ocean
  ctx.lakeMask = lakeMask
  ctx.lakes = lakes
  ctx.lakeMeta = lakeMeta
  ctx.hydrologyStats = {
    breachCount,
    endorheicCount,
    endorheicFraction: lakes.length > 0 ? endorheicCount / lakes.length : 0,
    lakeCount: lakes.length,
  }
  ctx.filledElevation = filledElevation
  ctx.spillOutlet = spillOutlet
  ctx.lakeIdByCell = lakeIdByCell
  ctx.catchmentCellsByLake = basinCellsByLake
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function runHydrologyClimateSubstep(ctx) {
  const { state, width, height } = ctx
  const baselineDrainage = state.baselineDoc?.fields.drainage ?? state.fields?.drainage
  if (!baselineDrainage) {
    throw new Error('Baseline drainage required before hydrology climate refresh')
  }

  const climateFields = refreshFieldsAfterErosion({
    geographySeed: state.geographySeed,
    prevailingWindDegrees: state.prevailingWindDegrees,
    elevation: state.erodedElevation,
    drainage: baselineDrainage,
    width,
    height,
    options: state.options,
  })
  const temperature = climateFields.temperature
  const rainfall = climateFields.rainfall
  const snowCapMask = deriveSnowCapMask({
    elevation: state.erodedElevation,
    temperature,
    width,
    height,
    seaLevel: state.options.seaLevel,
  })
  const meltContribution = state.options.enableSeasonalHydrology
    ? new Float32Array(width * height)
    : deriveSnowMeltContribution({
        elevation: state.erodedElevation,
        temperature,
        snowCapMask,
        width,
        height,
        prevailingWindDegrees: state.prevailingWindDegrees,
      })
  ctx.temperature = temperature
  ctx.rainfall = rainfall
  ctx.snowCapMask = snowCapMask
  ctx.meltContribution = meltContribution
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function runHydrologySeasonalSubstep(ctx) {
  const { state, width, height } = ctx
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
    throw new Error('Fill and climate substeps required before seasonal hydrology')
  }

  const soilDrainage = state.baselineDoc?.fields.drainage ?? state.fields?.drainage

  if (!state.options.enableSeasonalHydrology) {
    ctx.effectiveRunoff = computeCellRunoff({
      rainfall: ctx.rainfall,
      meltContribution: ctx.meltContribution,
      soilDrainage,
      soilDrainageScale: state.options.soilDrainageScale,
      ocean: ctx.ocean,
    })
    ctx.overflowLakeIds = new Set()
    return
  }

  const { catchmentCellsByLake } = deriveBasinCatchments({
    elevation: state.erodedElevation,
    lakeIdByCell: ctx.lakeIdByCell,
    width,
    height,
    seaLevel: state.options.seaLevel,
  })

  const seasonal = simulateSeasonalHydrology({
    elevation: state.erodedElevation,
    filledElevation: ctx.filledElevation,
    rainfall: ctx.rainfall,
    temperature: ctx.temperature,
    snowCapMask: ctx.snowCapMask,
    lakeMask: ctx.lakeMask,
    lakes: ctx.lakes,
    lakeMeta: ctx.lakeMeta,
    catchmentCellsByLake,
    lakeIdByCell: ctx.lakeIdByCell,
    soilDrainage,
    ocean: ctx.ocean,
    width,
    height,
    geographySeed: state.geographySeed,
    options: state.options,
  })

  ctx.filledElevation = seasonal.filledElevation
  ctx.lakeMeta = seasonal.lakeMeta
  ctx.lakes = seasonal.lakes
  ctx.effectiveRunoff = seasonal.effectiveRunoff
  ctx.overflowLakeIds = seasonal.overflowLakeIds
  ctx.catchmentCellsByLake = catchmentCellsByLake
  if (ctx.hydrologyStats) {
    ctx.hydrologyStats = {
      ...ctx.hydrologyStats,
      overflowLakeCount: seasonal.seasonalStats.overflowLakeCount,
      seasonalYearCount: seasonal.seasonalStats.seasonalYearCount,
      meanLakeLevelDelta: seasonal.seasonalStats.meanLakeLevelDelta,
      bankCrumbleCount: seasonal.seasonalStats.bankCrumbleCount,
      endorheicCount: seasonal.lakes.filter((lake) => lake.endorheic).length,
      endorheicFraction:
        seasonal.lakes.length > 0
          ? seasonal.lakes.filter((lake) => lake.endorheic).length / seasonal.lakes.length
          : 0,
    }
  }
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function runHydrologyRouteSubstep(ctx) {
  const { state, width, height } = ctx
  if (
    !ctx.filledElevation ||
    !ctx.lakeMask ||
    !ctx.spillOutlet ||
    !ctx.temperature ||
    !ctx.rainfall ||
    !ctx.effectiveRunoff
  ) {
    throw new Error('Fill, climate, and seasonal substeps required before hydrology routing')
  }

  const soilDrainage = state.baselineDoc?.fields.drainage ?? state.fields?.drainage
  const { flowDirection, flowAccumulation, ocean: lakeOcean } = computeFlowAccumulation({
    elevation: ctx.filledElevation,
    width,
    height,
    seaLevel: state.options.seaLevel,
    rainfall: ctx.rainfall,
    cellRunoff: ctx.effectiveRunoff,
    soilDrainage,
    soilDrainageScale: state.options.soilDrainageScale,
  })
  const baseRiverNetworkMask = buildRiverNetworkMask({
    flowAccumulation,
    flowDirection,
    ocean: lakeOcean,
    lakeMask: ctx.lakeMask,
    width,
    height,
    meltContribution: ctx.meltContribution,
    navigableFlowCutoffScale: state.options.navigableFlowCutoffScale,
    overflowLakeIds: ctx.overflowLakeIds ?? undefined,
    lakeIdByCell: ctx.lakeIdByCell ?? undefined,
  })
  const attractionRadius = riverAttractionRadiusForGrid(
    width,
    state.options.riverAttractionRadiusScale,
  )
  const riverNetworkMask = attractionRadius > 0
    ? connectNearbyRiverCorridors({
        riverNetworkMask: baseRiverNetworkMask,
        elevation: ctx.filledElevation,
        ocean: lakeOcean,
        width,
        height,
        geographySeed: state.geographySeed,
        flowDirection,
        attractionRadius,
      })
    : baseRiverNetworkMask
  ctx.flowDirection = flowDirection
  ctx.flowAccumulation = flowAccumulation
  ctx.lakeOcean = lakeOcean
  ctx.riverNetworkMask = riverNetworkMask
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function runHydrologyInciseSubstep(ctx) {
  const { state, width, height, hooks } = ctx
  if (
    !ctx.filledElevation ||
    !ctx.lakeMask ||
    !ctx.lakeOcean ||
    !ctx.flowDirection ||
    !ctx.flowAccumulation ||
    !ctx.riverNetworkMask ||
    !ctx.effectiveRunoff
  ) {
    throw new Error('Routing substep required before hydrology incising')
  }

  const inciseSubstep = HYDROLOGY_SUBSTEPS.find((substep) => substep.id === 'hydrologyIncise')
  const inciseSubstepIndex = HYDROLOGY_SUBSTEPS.findIndex((substep) => substep.id === 'hydrologyIncise')
  const substepCount = HYDROLOGY_SUBSTEPS.length
  const reportInciseProgress = (progress) => {
    if (!inciseSubstep) return
    hooks.onSubstepProgress?.({
      substepId: 'hydrologyIncise',
      substepIndex: inciseSubstepIndex,
      substepCount,
      label: inciseSubstep.label,
      progress,
    })
  }

  const carved = carveTemporaryRivers({
    elevation: ctx.filledElevation,
    ocean: ctx.lakeOcean,
    flowDirection: ctx.flowDirection,
    flowAccumulation: ctx.flowAccumulation,
    lakeMask: ctx.lakeMask,
    width,
    height,
    geographySeed: state.geographySeed,
    seaLevel: state.options.seaLevel,
    channelSeedMask: ctx.riverNetworkMask,
    incisionDepth: state.options.erosionChannelWear * 1.5,
    inciseIterations: state.options.inciseIterations,
    streamPowerK: state.options.streamPowerK,
    streamPowerM: state.options.streamPowerM,
    streamPowerN: state.options.streamPowerN,
    channelInitiationThreshold: state.options.channelInitiationThreshold,
    onProgress: reportInciseProgress,
  })

  ctx.settledElevation = carved.elevation
  ctx.incisedRiverNetworkMask = ctx.riverNetworkMask
  ctx.incisedCorridorMask = unionCorridorMasks(
    carved.corridorMask,
    deriveIncisedCorridorMask(ctx.filledElevation, carved.elevation, ctx.lakeOcean),
  )
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function runHydrologyExtractSubstep(ctx) {
  const { state, width, height } = ctx
  if (
    !ctx.settledElevation ||
    !ctx.lakeMask ||
    !ctx.lakeOcean ||
    !ctx.incisedCorridorMask ||
    !ctx.rainfall ||
    !ctx.effectiveRunoff
  ) {
    throw new Error('Incising substep required before hydrology corridor extraction')
  }

  const soilDrainage = state.baselineDoc?.fields.drainage ?? state.fields?.drainage
  const extracted = extractRiverNetworkFromIncisedChannels({
    elevation: ctx.settledElevation,
    incisedCorridorMask: ctx.incisedCorridorMask,
    rainfall: ctx.rainfall,
    meltContribution: ctx.meltContribution,
    cellRunoff: ctx.effectiveRunoff,
    soilDrainage,
    soilDrainageScale: state.options.soilDrainageScale,
    seaLevel: state.options.seaLevel,
    width,
    height,
    navigableFlowCutoffScale: state.options.navigableFlowCutoffScale,
    lakeMask: ctx.lakeMask,
  })

  ctx.settledFlowDirection = extracted.flowDirection
  ctx.settledFlowAccumulation = extracted.flowAccumulation
  ctx.settledOcean = extracted.ocean
  ctx.settledRiverNetworkMask = extracted.channelMask
  ctx.channelWidth = extracted.channelWidth
  ctx.coastNavigability = extracted.coastNavigability
  ctx.settledRiverGraph = extracted.riverGraph
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function runHydrologyRefineSubstep(ctx) {
  const { state, width, height } = ctx
  if (
    !ctx.settledElevation ||
    !ctx.effectiveRunoff ||
    !ctx.settledRiverNetworkMask ||
    !ctx.settledFlowDirection ||
    !ctx.settledFlowAccumulation ||
    !ctx.settledOcean ||
    !ctx.lakeMask
  ) {
    throw new Error('Corridor extraction required before hydrology meander refinement')
  }

  const refined = refineRiverNetworkFromSketch({
    sketchMask: ctx.settledRiverNetworkMask,
    elevation: ctx.settledElevation,
    ocean: ctx.settledOcean,
    flowDirection: ctx.settledFlowDirection,
    flowAccumulation: ctx.settledFlowAccumulation,
    lakeMask: ctx.lakeMask,
    width,
    height,
    geographySeed: state.geographySeed,
    meanderStrength: state.options.riverMeanderStrength,
    settlementStepCount: riverSettlementStepsForGrid(width, state.options.riverSettlementSteps),
    mergeStrength: state.options.riverMergeStrength,
    channelWear: state.options.erosionChannelWear,
    seaLevel: state.options.seaLevel,
    navigableFlowCutoffScale: state.options.navigableFlowCutoffScale,
  })
  ctx.settledElevation = refined.elevation
  ctx.presentationRiverNetworkMask = unionCorridorMasks(
    ctx.settledRiverNetworkMask,
    refined.riverNetworkMask,
  )
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function runHydrologySettleSubstep(ctx) {
  const { state, width, height } = ctx
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
    throw new Error('Corridor extraction required before hydrology settlement')
  }

  const lakeSettled = settleLakeEquilibrium({
    elevation: ctx.settledElevation,
    lakeMask: ctx.lakeMask,
    lakes: ctx.lakes,
    lakeMeta: ctx.lakeMeta,
    ocean: ctx.settledOcean,
    width,
    height,
    seaLevel: state.options.seaLevel,
  })
  ctx.settledElevation = lakeSettled.elevation
  ctx.lakes = lakeSettled.lakes
  ctx.lakeMeta = lakeSettled.lakeMeta
  ctx.spillOutlet = lakeSettled.spillOutlet

  const soilDrainage = state.baselineDoc?.fields.drainage ?? state.fields?.drainage
  const {
    flowDirection: settledFlowDirection,
    flowAccumulation: settledFlowAccumulation,
    ocean: settledOcean,
  } = computeFlowAccumulation({
    elevation: ctx.settledElevation,
    width,
    height,
    seaLevel: state.options.seaLevel,
    rainfall: ctx.rainfall,
    cellRunoff: ctx.effectiveRunoff,
    soilDrainage,
    soilDrainageScale: state.options.soilDrainageScale,
  })
  ctx.settledFlowDirection = settledFlowDirection
  ctx.settledFlowAccumulation = settledFlowAccumulation
  ctx.settledOcean = settledOcean

  ctx.settledDrainage = deriveDrainageFromFlow(ctx.settledFlowAccumulation)
  const displayRiverNetworkMask =
    ctx.presentationRiverNetworkMask ?? ctx.settledRiverNetworkMask
  ctx.channelWidth = buildChannelWidthField({
    flowAccumulation: ctx.settledFlowAccumulation,
    channelMask: displayRiverNetworkMask,
    width,
    height,
  })
  ctx.settledRiverGraph = buildRiverGraph({
    elevation: ctx.settledElevation,
    flowAccumulation: ctx.settledFlowAccumulation,
    flowDirection: ctx.settledFlowDirection,
    ocean: ctx.settledOcean,
    lakeMask: ctx.lakeMask,
    width,
    height,
    navigableFlowCutoffScale: state.options.navigableFlowCutoffScale,
    channelMask: displayRiverNetworkMask,
    coastNavigability: ctx.coastNavigability ?? undefined,
    seaLevel: state.options.seaLevel,
  })

  if (ctx.lakeIdByCell && ctx.lakeMeta && ctx.lakeMask) {
    applyLakeSurfacesFromMeta(
      ctx.settledElevation,
      ctx.lakeIdByCell,
      ctx.lakeMeta,
      ctx.lakeMask,
      width,
      height,
    )
  }
}

/** @type {Record<HydrologySubstepId, (ctx: HydrologySubstepContext) => void>} */
const HYDROLOGY_SUBSTEP_RUNNERS = {
  hydrologyFill: runHydrologyFillSubstep,
  hydrologyClimate: runHydrologyClimateSubstep,
  hydrologySeasonal: runHydrologySeasonalSubstep,
  hydrologyRoute: runHydrologyRouteSubstep,
  hydrologyIncise: runHydrologyInciseSubstep,
  hydrologyExtract: runHydrologyExtractSubstep,
  hydrologyRefine: runHydrologyRefineSubstep,
  hydrologySettle: runHydrologySettleSubstep,
}

/**
 * @param {HydrologySubstepContext} ctx
 * @returns {import('../derivedGeographyPipeline.js').DerivedGeographyPipelineState}
 */
function buildPipelineStateFromHydrologyContext(ctx) {
  const { state, width, height } = ctx
  if (
    !ctx.lakeMask ||
    !ctx.lakes ||
    !ctx.lakeMeta ||
    !ctx.hydrologyStats ||
    !ctx.settledElevation ||
    !ctx.settledRiverGraph ||
    !ctx.settledRiverNetworkMask ||
    !ctx.settledDrainage ||
    !ctx.settledFlowDirection
  ) {
    throw new Error('Incomplete hydrology context')
  }

  const previewFields = {
    ...(state.fields ?? state.baselineDoc.fields),
    elevation: ctx.settledElevation,
    drainage: ctx.settledDrainage,
  }

  if (ctx.lakeIdByCell && ctx.lakeMeta && ctx.lakeMask) {
    applyLakeSurfacesFromMeta(
      previewFields.elevation,
      ctx.lakeIdByCell,
      ctx.lakeMeta,
      ctx.lakeMask,
      width,
      height,
    )
  }

  return {
    ...state,
    lakeMask: ctx.lakeMask,
    lakes: ctx.lakes,
    lakeMeta: ctx.lakeMeta,
    lakeIdByCell: ctx.lakeIdByCell,
    hydrologyStats: ctx.hydrologyStats,
    workingElevation: ctx.settledElevation,
    riverGraph: ctx.settledRiverGraph,
    riverNetworkMask: ctx.presentationRiverNetworkMask ?? ctx.settledRiverNetworkMask,
    channelWidth: ctx.channelWidth,
    flowDirection: ctx.settledFlowDirection,
    fields: previewFields,
    biomes: classifyBiomesWithHydrology(previewFields, width, height, {
      lakeMask: ctx.lakeMask,
      riverCorridorMask: ctx.presentationRiverNetworkMask ?? ctx.settledRiverNetworkMask,
      flowDirection: ctx.settledFlowDirection,
    }, state.options.seaLevel),
    lastCompletedStep: 'hydrology',
  }
}

/**
 * @param {HydrologySubstepId} substepId
 * @param {import('../types.js').WorldGenerationOptions} options
 */
function shouldSkipHydrologySubstep(substepId, options) {
  return substepId === 'hydrologyRefine' && !options.enableMeanderRefine
}

/**
 * @param {import('../derivedGeographyPipeline.js').DerivedGeographyPipelineState} state
 * @param {HydrologySubstepHooks} [hooks]
 * @returns {{ state: import('../derivedGeographyPipeline.js').DerivedGeographyPipelineState, timings: HydrologySubstepTiming[] }}
 */
export function runHydrologySubsteps(state, hooks = {}) {
  const ctx = createHydrologyContext(state, hooks)
  const substepCount = HYDROLOGY_SUBSTEPS.length
  /** @type {HydrologySubstepTiming[]} */
  const timings = []

  for (let substepIndex = 0; substepIndex < substepCount; substepIndex += 1) {
    if (hooks.shouldCancel?.()) {
      throw new Error('Hydrology cancelled')
    }

    const substep = HYDROLOGY_SUBSTEPS[substepIndex]
    const skipped = shouldSkipHydrologySubstep(substep.id, ctx.state.options)
    hooks.onSubstepStart?.({
      substepId: substep.id,
      substepIndex,
      substepCount,
      label: substep.label,
    })
    hooks.onSubstepProgress?.({
      substepId: substep.id,
      substepIndex,
      substepCount,
      label: substep.label,
      progress: 0,
    })

    let durationMs = 0
    if (!skipped) {
      const startedAt = performance.now()
      HYDROLOGY_SUBSTEP_RUNNERS[substep.id](ctx)
      durationMs = performance.now() - startedAt
    }

    hooks.onSubstepProgress?.({
      substepId: substep.id,
      substepIndex,
      substepCount,
      label: substep.label,
      progress: 1,
    })
    hooks.onSubstepComplete?.({
      substepId: substep.id,
      substepIndex,
      substepCount,
      label: substep.label,
      progress: 1,
      skipped,
    })
    timings.push({
      substepId: substep.id,
      label: substep.label,
      durationMs,
      skipped,
    })
  }

  return {
    state: buildPipelineStateFromHydrologyContext(ctx),
    timings,
  }
}
