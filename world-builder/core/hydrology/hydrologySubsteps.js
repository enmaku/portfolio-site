import { classifyBiomesWithHydrology } from '../classifyBiomesFromFields.js'
import { refreshClimateScalarsAfterElevationMutation } from '../fields/refreshClimateScalarsAfterElevationMutation.js'
import { refreshFieldsAfterErosion } from '../fields/refreshFieldsAfterErosion.js'
import { LandmassPipelineCancelledError } from '../landmassPipelineTypes.js'
import { buildRiverGraph } from './buildRiverGraph.js'
import { buildRiverNetworkMask } from './buildRiverNetworkMask.js'
import {
  createFlowFieldSession,
  FLOW_RECOMPUTE_REASONS,
  FLOW_RECOMPUTE_STAGES,
} from './flowField.js'
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
  applyRefineStageMeanderPresentation,
  applyRouteStageCorridorAttraction,
} from './riverNetworkLegacyMeanders.js'
import { carveTemporaryRivers } from './seededTemporaryRiverCarve.js'
import { buildPhysicalRiverCorridorMask, smoothRiverCorridorMaskForDisplay } from './riverCorridorDisplay.js'
import {
  assertHydrologySubstepOutputs,
  HYDROLOGY_SUBSTEP_CONTRACTS,
  pickHydrologySubstepInput,
} from './hydrologySubstepContracts.js'
import { assembleRiverNetwork } from './riverNetwork.js'
import {
  applySkipRefineTransition,
  createRiverMaskPipeline,
  getRiverMaskStageFromContext,
  requireRiverMaskStageFromContext,
  resolveDisplayRiverNetworkMaskFromPipeline,
  RIVER_MASK_SKIP_REFINE_TRANSITION,
  setRiverMaskStage,
  snapshotRiverMaskLifecycle,
} from './riverMaskLifecycle.js'
import { settleLakeEquilibrium } from './settleLakeEquilibrium.js'
import { simulateSeasonalHydrology } from './simulateSeasonalHydrology.js'

/** @typedef {'hydrologyFill' | 'hydrologyClimate' | 'hydrologySeasonal' | 'hydrologyRoute' | 'hydrologyIncise' | 'hydrologyExtract' | 'hydrologyRefine' | 'hydrologySettle' | 'hydrologyPaint'} HydrologySubstepId */

/** @type {ReadonlyArray<{ id: HydrologySubstepId, label: string }>} */
export const HYDROLOGY_SUBSTEPS = Object.entries(HYDROLOGY_SUBSTEP_CONTRACTS).map(
  ([id, contract]) => ({
    id: /** @type {HydrologySubstepId} */ (id),
    label: contract.label,
  }),
)

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
 * @property {(payload: { substepId: HydrologySubstepId, substepIndex: number, substepCount: number, label: string, progress: number, skipped?: boolean, transition?: string, maskLifecycle?: ReturnType<typeof snapshotRiverMaskLifecycle> }) => void} [onSubstepComplete]
 * @property {(payload: { substepId: HydrologySubstepId, substepIndex: number, substepCount: number, label: string, input: Record<string, unknown> }) => void} [onSubstepPrepare]
 * @property {() => boolean} [shouldCancel]
 */

/**
 * @typedef {Object} HydrologySubstepContext
 * @property {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} state
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
 * @property {import('./riverMaskLifecycle.js').RiverMaskPipeline} riverMaskPipeline
 * @property {Float32Array | null} channelWidth
 * @property {Float32Array | null} settledElevation
 * @property {Int16Array | null} settledFlowDirection
 * @property {Float32Array | null} settledFlowAccumulation
 * @property {Uint8Array | null} settledOcean
 * @property {Float32Array | null} settledDrainage
 * @property {import('../types.js').RiverGraph | null} settledRiverGraph
 * @property {import('../types.js').RiverNetwork | null} riverNetwork
 * @property {HydrologySubstepId | null} lastCompletedSubstep
 * @property {import('./flowField.js').FlowFieldSession} flowFieldSession
 * @property {HydrologySubstepHooks} hooks
 */

/**
 * @param {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} state
 * @returns {HydrologySubstepContext}
 */
function createHydrologyContext(state, hooks = {}) {
  return {
    state,
    hooks,
    flowFieldSession: createFlowFieldSession(),
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
    riverMaskPipeline: createRiverMaskPipeline(),
    channelWidth: null,
    settledElevation: null,
    settledFlowDirection: null,
    settledFlowAccumulation: null,
    settledOcean: null,
    settledDrainage: null,
    settledRiverGraph: null,
    riverNetwork: null,
    lastCompletedSubstep: null,
  }
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function runHydrologyFillSubstep(ctx) {
  const { state, width, height, flowFieldSession } = ctx
  const ocean = flowFieldSession.deriveOceanMask({
    elevation: state.erodedElevation,
    width,
    height,
    seaLevel: state.options.seaLevel,
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
    prevailingWindDegrees: state.prevailingWindDegrees,
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
  const soilDrainage = state.baselineDoc?.fields.drainage ?? state.fields?.drainage
  const {
    flowDirection,
    flowAccumulation,
    ocean: lakeOcean,
  } = ctx.flowFieldSession.recomputeFullFlow({
    reason: FLOW_RECOMPUTE_REASONS.hydrologyRoute,
    stage: FLOW_RECOMPUTE_STAGES.hydrologyRoute,
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
  const riverNetworkMask = applyRouteStageCorridorAttraction({
    baseRiverNetworkMask: baseRiverNetworkMask,
    elevation: ctx.filledElevation,
    ocean: lakeOcean,
    width,
    height,
    geographySeed: state.geographySeed,
    flowDirection,
    riverAttractionRadiusScale: state.options.riverAttractionRadiusScale,
  })
  ctx.flowDirection = flowDirection
  ctx.flowAccumulation = flowAccumulation
  ctx.lakeOcean = lakeOcean
  setRiverMaskStage(ctx.riverMaskPipeline, 'sketch', riverNetworkMask)
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function runHydrologyInciseSubstep(ctx) {
  const { state, width, height, hooks } = ctx
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
    channelSeedMask: requireRiverMaskStageFromContext(ctx, 'sketch'),
    incisionDepth: state.options.erosionChannelWear * 1.5,
    inciseIterations: state.options.inciseIterations,
    streamPowerK: state.options.streamPowerK,
    streamPowerM: state.options.streamPowerM,
    streamPowerN: state.options.streamPowerN,
    channelInitiationThreshold: state.options.channelInitiationThreshold,
    onProgress: reportInciseProgress,
  })

  ctx.settledElevation = carved.elevation
  setRiverMaskStage(
    ctx.riverMaskPipeline,
    'incised',
    unionCorridorMasks(
      carved.corridorMask,
      deriveIncisedCorridorMask(ctx.filledElevation, carved.elevation, ctx.lakeOcean),
    ),
  )
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function runHydrologyExtractSubstep(ctx) {
  const { state, width, height } = ctx
  const soilDrainage = state.baselineDoc?.fields.drainage ?? state.fields?.drainage
  const extracted = extractRiverNetworkFromIncisedChannels({
    elevation: ctx.settledElevation,
    incisedCorridorMask: requireRiverMaskStageFromContext(ctx, 'incised'),
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
    flowFieldSession: ctx.flowFieldSession,
  })

  ctx.settledFlowDirection = extracted.flowDirection
  ctx.settledFlowAccumulation = extracted.flowAccumulation
  ctx.settledOcean = extracted.ocean
  setRiverMaskStage(ctx.riverMaskPipeline, 'settled', extracted.channelMask)
  ctx.channelWidth = extracted.channelWidth
  ctx.settledRiverGraph = extracted.riverGraph
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function runHydrologyRefineSubstep(ctx) {
  const { state, width, height } = ctx
  const refined = applyRefineStageMeanderPresentation({
    sketchMask: requireRiverMaskStageFromContext(ctx, 'settled'),
    elevation: ctx.settledElevation,
    ocean: ctx.settledOcean,
    flowDirection: ctx.settledFlowDirection,
    flowAccumulation: ctx.settledFlowAccumulation,
    lakeMask: ctx.lakeMask,
    width,
    height,
    geographySeed: state.geographySeed,
    options: state.options,
  })
  ctx.settledElevation = refined.elevation
  setRiverMaskStage(
    ctx.riverMaskPipeline,
    'presentation',
    unionCorridorMasks(requireRiverMaskStageFromContext(ctx, 'settled'), refined.riverNetworkMask),
  )
}

/**
 * @param {HydrologySubstepContext} ctx
 */
function runHydrologySettleSubstep(ctx) {
  const { state, width, height } = ctx
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
  } = ctx.flowFieldSession.recomputeFullFlow({
    reason: FLOW_RECOMPUTE_REASONS.hydrologySettle,
    stage: FLOW_RECOMPUTE_STAGES.hydrologySettle,
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
  const displayRiverNetworkMask = resolveDisplayRiverNetworkMaskFromPipeline(ctx.riverMaskPipeline)
  ctx.channelWidth = buildChannelWidthField({
    flowAccumulation: ctx.settledFlowAccumulation,
    channelMask: displayRiverNetworkMask,
    width,
    height,
  })
  ctx.settledRiverGraph = buildRiverGraph({
    flowAccumulation: ctx.settledFlowAccumulation,
    flowDirection: ctx.settledFlowDirection,
    ocean: ctx.settledOcean,
    lakeMask: ctx.lakeMask,
    width,
    height,
    navigableFlowCutoffScale: state.options.navigableFlowCutoffScale,
    channelMask: displayRiverNetworkMask,
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

/**
 * @param {HydrologySubstepContext} ctx
 */
function runHydrologyPaintSubstep(ctx) {
  const { width, height, hooks } = ctx
  const paintSubstep = HYDROLOGY_SUBSTEPS.find((substep) => substep.id === 'hydrologyPaint')
  const paintSubstepIndex = HYDROLOGY_SUBSTEPS.findIndex((substep) => substep.id === 'hydrologyPaint')
  const substepCount = HYDROLOGY_SUBSTEPS.length
  const reportPaintProgress = (progress) => {
    if (!paintSubstep) return
    hooks.onSubstepProgress?.({
      substepId: 'hydrologyPaint',
      substepIndex: paintSubstepIndex,
      substepCount,
      label: paintSubstep.label,
      progress,
    })
  }

  const riverNetworkMask = resolveDisplayRiverNetworkMaskFromPipeline(ctx.riverMaskPipeline)
  const rawMask = buildPhysicalRiverCorridorMask(riverNetworkMask, width, height, {
    elevation: ctx.settledElevation,
    flowDirection: ctx.settledFlowDirection,
    channelWidth: ctx.channelWidth,
    ocean: ctx.settledOcean ?? undefined,
    lakeMask: ctx.lakeMask ?? undefined,
    onProgress: (progress) => reportPaintProgress(progress * 0.92),
  })
  const paintedCorridorMask = smoothRiverCorridorMaskForDisplay(rawMask, width, height, 1)
  setRiverMaskStage(ctx.riverMaskPipeline, 'painted', paintedCorridorMask)
  ctx.riverNetwork = assembleRiverNetwork({
    centerline: riverNetworkMask,
    corridor: paintedCorridorMask,
    flowDirection: ctx.settledFlowDirection,
    flowAccumulation: ctx.settledFlowAccumulation,
    channelWidth: ctx.channelWidth,
    graph: ctx.settledRiverGraph,
    width,
    height,
  })
  reportPaintProgress(1)
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
  hydrologyPaint: runHydrologyPaintSubstep,
}

/**
 * @param {HydrologySubstepContext} ctx
 * @returns {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState}
 */
function buildPipelineStateFromHydrologyContext(ctx) {
  const { state, width, height } = ctx
  const settledElevation = ctx.settledElevation
  if (ctx.lakeIdByCell && ctx.lakeMeta && ctx.lakeMask) {
    applyLakeSurfacesFromMeta(
      settledElevation,
      ctx.lakeIdByCell,
      ctx.lakeMeta,
      ctx.lakeMask,
      width,
      height,
    )
  }

  const previewFields = refreshClimateScalarsAfterElevationMutation({
    geographySeed: state.geographySeed,
    prevailingWindDegrees: state.prevailingWindDegrees,
    elevation: settledElevation,
    drainage: ctx.settledDrainage,
    width,
    height,
    options: state.options,
  })

  return {
    ...state,
    lakeMask: ctx.lakeMask,
    lakes: ctx.lakes,
    lakeMeta: ctx.lakeMeta,
    lakeIdByCell: ctx.lakeIdByCell,
    hydrologyStats: ctx.hydrologyStats,
    workingElevation: ctx.settledElevation,
    riverGraph: ctx.riverNetwork.graph,
    riverNetworkMask: ctx.riverNetwork.centerline,
    riverCorridorMask: ctx.riverNetwork.corridor,
    channelWidth: ctx.channelWidth,
    flowDirection: ctx.settledFlowDirection,
    fields: previewFields,
    biomes: classifyBiomesWithHydrology(previewFields, width, height, {
      lakeMask: ctx.lakeMask,
      riverCorridorMask: getRiverMaskStageFromContext(ctx, 'painted'),
      flowDirection: ctx.settledFlowDirection,
    }, state.options.seaLevel, state.geographySeed, state.options.biomeEdgeNoiseStrength),
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
 * @param {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} state
 * @param {HydrologySubstepHooks} [hooks]
 * @returns {{
 *   state: import('../landmassPipelineTypes.js').DerivedGeographyPipelineState,
 *   timings: HydrologySubstepTiming[],
 *   flowField: { fullFlowSolveCount: number, solveLog: import('./flowField.js').FlowRecomputeLogEntry[] },
 * }}
 */
export function runHydrologySubsteps(state, hooks = {}) {
  const ctx = createHydrologyContext(state, hooks)
  const substepCount = HYDROLOGY_SUBSTEPS.length
  /** @type {HydrologySubstepTiming[]} */
  const timings = []

  for (let substepIndex = 0; substepIndex < substepCount; substepIndex += 1) {
    if (hooks.shouldCancel?.()) {
      throw new LandmassPipelineCancelledError(ctx.state)
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

    const input = pickHydrologySubstepInput(substep.id, ctx)
    hooks.onSubstepPrepare?.({
      substepId: substep.id,
      substepIndex,
      substepCount,
      label: substep.label,
      input,
    })

    let durationMs = 0
    if (!skipped) {
      const startedAt = performance.now()
      HYDROLOGY_SUBSTEP_RUNNERS[substep.id](ctx)
      assertHydrologySubstepOutputs(substep.id, ctx)
      durationMs = performance.now() - startedAt
    } else if (substep.id === 'hydrologyRefine') {
      applySkipRefineTransition(ctx)
      assertHydrologySubstepOutputs(substep.id, ctx)
    }

    ctx.lastCompletedSubstep = substep.id

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
      transition:
        skipped && substep.id === 'hydrologyRefine'
          ? RIVER_MASK_SKIP_REFINE_TRANSITION
          : undefined,
      maskLifecycle: snapshotRiverMaskLifecycle(ctx),
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
    flowField: {
      fullFlowSolveCount: ctx.flowFieldSession.fullFlowSolveCount,
      solveLog: ctx.flowFieldSession.solveLog,
    },
  }
}
