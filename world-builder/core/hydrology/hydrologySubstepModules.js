import { refreshFieldsAfterErosion } from '../fields/refreshFieldsAfterErosion.js'
import { buildRiverGraph } from './buildRiverGraph.js'
import { buildRiverNetworkMask } from './buildRiverNetworkMask.js'
import { FLOW_RECOMPUTE_REASONS, FLOW_RECOMPUTE_STAGES } from './flowField.js'
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
  applyPresentationStageCorridorAttraction,
  applyRefineStageMeanderPresentation,
  isCorridorAttractionEnabled,
} from './riverNetworkLegacyMeanders.js'
import { carveTemporaryRivers } from './seededTemporaryRiverCarve.js'
import {
  buildPhysicalRiverCorridorMask,
  smoothRiverCorridorMaskForDisplay,
} from './riverCorridorDisplay.js'
import { assembleRiverNetwork } from './riverNetwork.js'
import {
  applySkipRefineToPipeline,
  requireRiverMaskStage,
  resolveDisplayRiverNetworkMaskFromPipeline,
  resolveSimulationRiverNetworkMaskFromPipeline,
  riverMaskContractKey,
  RIVER_MASK_SKIP_REFINE_TRANSITION,
  setRiverMaskStage,
} from './riverMaskLifecycle.js'
import { settleLakeEquilibrium } from './settleLakeEquilibrium.js'
import { simulateSeasonalHydrology } from './simulateSeasonalHydrology.js'

/**
 * @typedef {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} DerivedGeographyPipelineState
 */

/**
 * Accumulated hydrology state threaded through the substep composition. Unlike a
 * pre-declared nullable context, fields exist only once a prior substep produces them.
 * @typedef {{
 *   state: DerivedGeographyPipelineState,
 *   width: number,
 *   height: number,
 * } & Record<string, unknown>} HydrologyWorld
 */

/**
 * Shared mutable value objects and reporting threaded to every substep.
 * @typedef {Object} HydrologySubstepShared
 * @property {import('./flowField.js').FlowFieldSession} flowFieldSession
 * @property {import('./riverMaskLifecycle.js').RiverMaskPipeline} riverMaskPipeline
 * @property {(progress: number) => void} onProgress
 */

/**
 * A hydrology substep module owning its own narrow input/output contract.
 * @typedef {Object} HydrologySubstepModule
 * @property {import('./hydrologySubsteps.js').HydrologySubstepId} id
 * @property {string} label
 * @property {Record<string, (world: HydrologyWorld) => unknown>} inputs Narrow input selectors; keys form the substep's input contract.
 * @property {readonly string[]} outputKeys Data and river-mask stages the substep produces.
 * @property {(input: Record<string, any>, shared: HydrologySubstepShared) => Record<string, unknown>} run
 * @property {(world: HydrologyWorld) => boolean} [shouldSkip]
 * @property {(input: Record<string, any>, shared: HydrologySubstepShared) => Record<string, unknown>} [runSkipped]
 * @property {string} [skipTransition]
 */

/**
 * @param {DerivedGeographyPipelineState} state
 * @returns {Float32Array | null}
 */
function baselineDrainageFromState(state) {
  return state.baselineDoc?.fields.drainage ?? state.fields?.drainage ?? null
}

/** @type {HydrologySubstepModule} */
const hydrologyFillSubstep = {
  id: 'hydrologyFill',
  label: 'Fill lakes',
  inputs: {
    options: (world) => world.state.options,
    width: (world) => world.width,
    height: (world) => world.height,
    erodedElevation: (world) => world.state.erodedElevation,
  },
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
  run({ options, width, height, erodedElevation }, { flowFieldSession }) {
    const ocean = flowFieldSession.deriveOceanMask({
      elevation: erodedElevation,
      width,
      height,
      seaLevel: options.seaLevel,
    })
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
      elevation: erodedElevation,
      width,
      height,
      ocean,
      seaLevel: options.seaLevel,
      minLakeAreaScale: options.minLakeAreaScale,
      breachThreshold: options.breachThreshold,
      useDryFloorInitialLevel: options.enableSeasonalHydrology,
    })
    return {
      ocean,
      lakeMask,
      lakes,
      lakeMeta,
      hydrologyStats: {
        breachCount,
        endorheicCount,
        endorheicFraction: lakes.length > 0 ? endorheicCount / lakes.length : 0,
        lakeCount: lakes.length,
      },
      filledElevation,
      spillOutlet,
      lakeIdByCell,
      catchmentCellsByLake: basinCellsByLake,
    }
  },
}

/** @type {HydrologySubstepModule} */
const hydrologyClimateSubstep = {
  id: 'hydrologyClimate',
  label: 'Climate refresh',
  inputs: {
    geographySeed: (world) => world.state.geographySeed,
    prevailingWindDegrees: (world) => world.state.prevailingWindDegrees,
    options: (world) => world.state.options,
    width: (world) => world.width,
    height: (world) => world.height,
    erodedElevation: (world) => world.state.erodedElevation,
    baselineDrainage: (world) => baselineDrainageFromState(world.state),
  },
  outputKeys: ['temperature', 'rainfall', 'snowCapMask', 'meltContribution'],
  run({ geographySeed, prevailingWindDegrees, options, width, height, erodedElevation, baselineDrainage }) {
    const climateFields = refreshFieldsAfterErosion({
      geographySeed,
      prevailingWindDegrees,
      elevation: erodedElevation,
      drainage: baselineDrainage,
      width,
      height,
      options,
    })
    const { temperature, rainfall } = climateFields
    const snowCapMask = deriveSnowCapMask({
      elevation: erodedElevation,
      temperature,
      width,
      height,
      seaLevel: options.seaLevel,
    })
    const meltContribution = options.enableSeasonalHydrology
      ? new Float32Array(width * height)
      : deriveSnowMeltContribution({
          elevation: erodedElevation,
          temperature,
          snowCapMask,
          width,
          height,
          prevailingWindDegrees,
        })
    return { temperature, rainfall, snowCapMask, meltContribution }
  },
}

/** @type {HydrologySubstepModule} */
const hydrologySeasonalSubstep = {
  id: 'hydrologySeasonal',
  label: 'Seasonal hydrology',
  inputs: {
    geographySeed: (world) => world.state.geographySeed,
    prevailingWindDegrees: (world) => world.state.prevailingWindDegrees,
    options: (world) => world.state.options,
    width: (world) => world.width,
    height: (world) => world.height,
    erodedElevation: (world) => world.state.erodedElevation,
    baselineDrainage: (world) => baselineDrainageFromState(world.state),
    filledElevation: (world) => world.filledElevation,
    lakeMask: (world) => world.lakeMask,
    lakes: (world) => world.lakes,
    lakeMeta: (world) => world.lakeMeta,
    lakeIdByCell: (world) => world.lakeIdByCell,
    temperature: (world) => world.temperature,
    rainfall: (world) => world.rainfall,
    snowCapMask: (world) => world.snowCapMask,
    meltContribution: (world) => world.meltContribution,
    ocean: (world) => world.ocean,
    hydrologyStats: (world) => world.hydrologyStats,
  },
  outputKeys: [
    'effectiveRunoff',
    'overflowLakeIds',
    'filledElevation',
    'lakeMeta',
    'lakes',
    'catchmentCellsByLake',
    'hydrologyStats',
  ],
  run(input) {
    const {
      options,
      width,
      height,
      erodedElevation,
      baselineDrainage,
      filledElevation,
      lakeMask,
      lakes,
      lakeMeta,
      lakeIdByCell,
      temperature,
      rainfall,
      snowCapMask,
      meltContribution,
      ocean,
      hydrologyStats,
      geographySeed,
      prevailingWindDegrees,
    } = input

    if (!options.enableSeasonalHydrology) {
      return {
        effectiveRunoff: computeCellRunoff({
          rainfall,
          meltContribution,
          soilDrainage: baselineDrainage,
          soilDrainageScale: options.soilDrainageScale,
          ocean,
        }),
        overflowLakeIds: new Set(),
      }
    }

    const { catchmentCellsByLake } = deriveBasinCatchments({
      elevation: erodedElevation,
      lakeIdByCell,
      width,
      height,
      seaLevel: options.seaLevel,
    })

    const seasonal = simulateSeasonalHydrology({
      elevation: erodedElevation,
      filledElevation,
      rainfall,
      temperature,
      snowCapMask,
      lakeMask,
      lakes,
      lakeMeta,
      catchmentCellsByLake,
      lakeIdByCell,
      soilDrainage: baselineDrainage,
      ocean,
      width,
      height,
      geographySeed,
      prevailingWindDegrees,
      options,
    })

    const nextStats = hydrologyStats
      ? {
          ...hydrologyStats,
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
      : hydrologyStats

    return {
      filledElevation: seasonal.filledElevation,
      lakeMeta: seasonal.lakeMeta,
      lakes: seasonal.lakes,
      effectiveRunoff: seasonal.effectiveRunoff,
      overflowLakeIds: seasonal.overflowLakeIds,
      catchmentCellsByLake,
      hydrologyStats: nextStats,
    }
  },
}

/** @type {HydrologySubstepModule} */
const hydrologyRouteSubstep = {
  id: 'hydrologyRoute',
  label: 'Route runoff',
  inputs: {
    options: (world) => world.state.options,
    width: (world) => world.width,
    height: (world) => world.height,
    filledElevation: (world) => world.filledElevation,
    lakeMask: (world) => world.lakeMask,
    rainfall: (world) => world.rainfall,
    effectiveRunoff: (world) => world.effectiveRunoff,
    meltContribution: (world) => world.meltContribution,
    baselineDrainage: (world) => baselineDrainageFromState(world.state),
    overflowLakeIds: (world) => world.overflowLakeIds,
    lakeIdByCell: (world) => world.lakeIdByCell,
  },
  outputKeys: ['flowDirection', 'flowAccumulation', 'lakeOcean', riverMaskContractKey('sketch')],
  run(input, { flowFieldSession, riverMaskPipeline }) {
    const {
      options,
      width,
      height,
      filledElevation,
      lakeMask,
      rainfall,
      effectiveRunoff,
      meltContribution,
      baselineDrainage,
      overflowLakeIds,
      lakeIdByCell,
    } = input
    const {
      flowDirection,
      flowAccumulation,
      ocean: lakeOcean,
    } = flowFieldSession.recomputeFullFlow({
      reason: FLOW_RECOMPUTE_REASONS.hydrologyRoute,
      stage: FLOW_RECOMPUTE_STAGES.hydrologyRoute,
      elevation: filledElevation,
      width,
      height,
      seaLevel: options.seaLevel,
      rainfall,
      cellRunoff: effectiveRunoff,
      soilDrainage: baselineDrainage,
      soilDrainageScale: options.soilDrainageScale,
    })
    const sketchRiverNetworkMask = buildRiverNetworkMask({
      flowAccumulation,
      flowDirection,
      ocean: lakeOcean,
      lakeMask,
      width,
      height,
      meltContribution,
      navigableFlowCutoffScale: options.navigableFlowCutoffScale,
      overflowLakeIds: overflowLakeIds ?? undefined,
      lakeIdByCell: lakeIdByCell ?? undefined,
    })
    setRiverMaskStage(riverMaskPipeline, 'sketch', sketchRiverNetworkMask)
    return { flowDirection, flowAccumulation, lakeOcean }
  },
}

/** @type {HydrologySubstepModule} */
const hydrologyInciseSubstep = {
  id: 'hydrologyIncise',
  label: 'Incise channels',
  inputs: {
    options: (world) => world.state.options,
    width: (world) => world.width,
    height: (world) => world.height,
    geographySeed: (world) => world.state.geographySeed,
    filledElevation: (world) => world.filledElevation,
    lakeMask: (world) => world.lakeMask,
    lakeOcean: (world) => world.lakeOcean,
    flowDirection: (world) => world.flowDirection,
    flowAccumulation: (world) => world.flowAccumulation,
  },
  outputKeys: ['settledElevation', riverMaskContractKey('incised')],
  run(input, { riverMaskPipeline, onProgress }) {
    const {
      options,
      width,
      height,
      geographySeed,
      filledElevation,
      lakeMask,
      lakeOcean,
      flowDirection,
      flowAccumulation,
    } = input
    const carved = carveTemporaryRivers({
      elevation: filledElevation,
      ocean: lakeOcean,
      flowDirection,
      flowAccumulation,
      lakeMask,
      width,
      height,
      geographySeed,
      seaLevel: options.seaLevel,
      channelSeedMask: requireRiverMaskStage(riverMaskPipeline, 'sketch'),
      incisionDepth: options.erosionChannelWear * 1.5,
      inciseIterations: options.inciseIterations,
      streamPowerK: options.streamPowerK,
      streamPowerM: options.streamPowerM,
      streamPowerN: options.streamPowerN,
      channelInitiationThreshold: options.channelInitiationThreshold,
      onProgress,
    })
    setRiverMaskStage(
      riverMaskPipeline,
      'incised',
      unionCorridorMasks(
        carved.corridorMask,
        deriveIncisedCorridorMask(filledElevation, carved.elevation, lakeOcean),
      ),
    )
    return { settledElevation: carved.elevation }
  },
}

/** @type {HydrologySubstepModule} */
const hydrologyExtractSubstep = {
  id: 'hydrologyExtract',
  label: 'Extract river graph',
  inputs: {
    options: (world) => world.state.options,
    width: (world) => world.width,
    height: (world) => world.height,
    settledElevation: (world) => world.settledElevation,
    lakeMask: (world) => world.lakeMask,
    rainfall: (world) => world.rainfall,
    effectiveRunoff: (world) => world.effectiveRunoff,
    meltContribution: (world) => world.meltContribution,
    baselineDrainage: (world) => baselineDrainageFromState(world.state),
  },
  outputKeys: [
    'settledFlowDirection',
    'settledFlowAccumulation',
    'settledOcean',
    riverMaskContractKey('settled'),
    'channelWidth',
    'settledRiverGraph',
  ],
  run(input, { flowFieldSession, riverMaskPipeline }) {
    const {
      options,
      width,
      height,
      settledElevation,
      lakeMask,
      rainfall,
      effectiveRunoff,
      meltContribution,
      baselineDrainage,
    } = input
    const extracted = extractRiverNetworkFromIncisedChannels({
      elevation: settledElevation,
      incisedCorridorMask: requireRiverMaskStage(riverMaskPipeline, 'incised'),
      rainfall,
      meltContribution,
      cellRunoff: effectiveRunoff,
      soilDrainage: baselineDrainage,
      soilDrainageScale: options.soilDrainageScale,
      seaLevel: options.seaLevel,
      width,
      height,
      navigableFlowCutoffScale: options.navigableFlowCutoffScale,
      lakeMask,
      flowFieldSession,
    })
    setRiverMaskStage(riverMaskPipeline, 'settled', extracted.channelMask)
    return {
      settledFlowDirection: extracted.flowDirection,
      settledFlowAccumulation: extracted.flowAccumulation,
      settledOcean: extracted.ocean,
      channelWidth: extracted.channelWidth,
      settledRiverGraph: extracted.riverGraph,
    }
  },
}

/** @type {HydrologySubstepModule} */
const hydrologyRefineSubstep = {
  id: 'hydrologyRefine',
  label: 'Meander refine',
  inputs: {
    options: (world) => world.state.options,
    width: (world) => world.width,
    height: (world) => world.height,
    geographySeed: (world) => world.state.geographySeed,
    settledElevation: (world) => world.settledElevation,
    settledOcean: (world) => world.settledOcean,
    settledFlowDirection: (world) => world.settledFlowDirection,
    settledFlowAccumulation: (world) => world.settledFlowAccumulation,
    lakeMask: (world) => world.lakeMask,
  },
  outputKeys: ['settledElevation', riverMaskContractKey('presentation')],
  skipTransition: RIVER_MASK_SKIP_REFINE_TRANSITION,
  shouldSkip: (world) =>
    !world.state.options.enableMeanderRefine &&
    !isCorridorAttractionEnabled(world.width, world.state.options.riverAttractionRadiusScale),
  run(input, { riverMaskPipeline }) {
    const {
      options,
      width,
      height,
      geographySeed,
      settledElevation,
      settledOcean,
      settledFlowDirection,
      settledFlowAccumulation,
      lakeMask,
    } = input
    const settledMask = requireRiverMaskStage(riverMaskPipeline, 'settled')
    const attractedMask = applyPresentationStageCorridorAttraction({
      baseRiverNetworkMask: settledMask,
      elevation: settledElevation,
      ocean: settledOcean,
      width,
      height,
      geographySeed,
      flowDirection: settledFlowDirection,
      riverAttractionRadiusScale: options.riverAttractionRadiusScale,
    })
    if (!options.enableMeanderRefine) {
      setRiverMaskStage(riverMaskPipeline, 'presentation', attractedMask)
      return {}
    }
    const refined = applyRefineStageMeanderPresentation({
      sketchMask: attractedMask,
      elevation: settledElevation,
      ocean: settledOcean,
      flowDirection: settledFlowDirection,
      flowAccumulation: settledFlowAccumulation,
      lakeMask,
      width,
      height,
      geographySeed,
      options,
    })
    setRiverMaskStage(
      riverMaskPipeline,
      'presentation',
      unionCorridorMasks(attractedMask, refined.riverNetworkMask),
    )
    return { settledElevation: refined.elevation }
  },
  runSkipped(_input, { riverMaskPipeline }) {
    applySkipRefineToPipeline(riverMaskPipeline)
    return {}
  },
}

/** @type {HydrologySubstepModule} */
const hydrologySettleSubstep = {
  id: 'hydrologySettle',
  label: 'Settle drainage',
  inputs: {
    options: (world) => world.state.options,
    width: (world) => world.width,
    height: (world) => world.height,
    settledElevation: (world) => world.settledElevation,
    lakeMask: (world) => world.lakeMask,
    lakes: (world) => world.lakes,
    lakeMeta: (world) => world.lakeMeta,
    settledOcean: (world) => world.settledOcean,
    rainfall: (world) => world.rainfall,
    effectiveRunoff: (world) => world.effectiveRunoff,
    lakeIdByCell: (world) => world.lakeIdByCell,
    baselineDrainage: (world) => baselineDrainageFromState(world.state),
  },
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
  run(input, { flowFieldSession, riverMaskPipeline }) {
    const {
      options,
      width,
      height,
      settledElevation,
      lakeMask,
      lakes,
      lakeMeta,
      settledOcean,
      rainfall,
      effectiveRunoff,
      lakeIdByCell,
      baselineDrainage,
    } = input
    const lakeSettled = settleLakeEquilibrium({
      elevation: settledElevation,
      lakeMask,
      lakes,
      lakeMeta,
      ocean: settledOcean,
      width,
      height,
      seaLevel: options.seaLevel,
    })

    const {
      flowDirection: nextFlowDirection,
      flowAccumulation: nextFlowAccumulation,
      ocean: nextOcean,
    } = flowFieldSession.recomputeFullFlow({
      reason: FLOW_RECOMPUTE_REASONS.hydrologySettle,
      stage: FLOW_RECOMPUTE_STAGES.hydrologySettle,
      elevation: lakeSettled.elevation,
      width,
      height,
      seaLevel: options.seaLevel,
      rainfall,
      cellRunoff: effectiveRunoff,
      soilDrainage: baselineDrainage,
      soilDrainageScale: options.soilDrainageScale,
    })

    const settledDrainage = deriveDrainageFromFlow(nextFlowAccumulation)
    const displayRiverNetworkMask = resolveDisplayRiverNetworkMaskFromPipeline(riverMaskPipeline)
    const channelWidth = buildChannelWidthField({
      flowAccumulation: nextFlowAccumulation,
      channelMask: displayRiverNetworkMask,
      width,
      height,
    })
    const settledRiverGraph = buildRiverGraph({
      flowAccumulation: nextFlowAccumulation,
      flowDirection: nextFlowDirection,
      ocean: nextOcean,
      lakeMask,
      width,
      height,
      navigableFlowCutoffScale: options.navigableFlowCutoffScale,
      channelMask: displayRiverNetworkMask,
    })

    if (lakeIdByCell && lakeSettled.lakeMeta && lakeMask) {
      applyLakeSurfacesFromMeta(
        lakeSettled.elevation,
        lakeIdByCell,
        lakeSettled.lakeMeta,
        lakeMask,
        width,
        height,
      )
    }

    return {
      settledElevation: lakeSettled.elevation,
      lakes: lakeSettled.lakes,
      lakeMeta: lakeSettled.lakeMeta,
      spillOutlet: lakeSettled.spillOutlet,
      settledFlowDirection: nextFlowDirection,
      settledFlowAccumulation: nextFlowAccumulation,
      settledOcean: nextOcean,
      settledDrainage,
      channelWidth,
      settledRiverGraph,
    }
  },
}

/** @type {HydrologySubstepModule} */
const hydrologyPaintSubstep = {
  id: 'hydrologyPaint',
  label: 'Paint river corridors',
  inputs: {
    width: (world) => world.width,
    height: (world) => world.height,
    settledElevation: (world) => world.settledElevation,
    settledFlowDirection: (world) => world.settledFlowDirection,
    settledFlowAccumulation: (world) => world.settledFlowAccumulation,
    channelWidth: (world) => world.channelWidth,
    settledOcean: (world) => world.settledOcean,
    lakeMask: (world) => world.lakeMask,
    settledRiverGraph: (world) => world.settledRiverGraph,
  },
  outputKeys: [riverMaskContractKey('painted'), 'riverNetwork'],
  run(input, { riverMaskPipeline, onProgress }) {
    const {
      width,
      height,
      settledElevation,
      settledFlowDirection,
      settledFlowAccumulation,
      channelWidth,
      settledOcean,
      lakeMask,
      settledRiverGraph,
    } = input
    const riverNetworkMask = resolveDisplayRiverNetworkMaskFromPipeline(riverMaskPipeline)
    const rawMask = buildPhysicalRiverCorridorMask(riverNetworkMask, width, height, {
      elevation: settledElevation,
      flowDirection: settledFlowDirection,
      channelWidth,
      ocean: settledOcean ?? undefined,
      lakeMask: lakeMask ?? undefined,
      onProgress: (progress) => onProgress(progress * 0.92),
    })
    const paintedCorridorMask = smoothRiverCorridorMaskForDisplay(rawMask, width, height, 1)
    setRiverMaskStage(riverMaskPipeline, 'painted', paintedCorridorMask)
    const riverNetwork = assembleRiverNetwork({
      simulationCenterline: resolveSimulationRiverNetworkMaskFromPipeline(riverMaskPipeline),
      centerline: riverNetworkMask,
      corridor: paintedCorridorMask,
      flowDirection: settledFlowDirection,
      flowAccumulation: settledFlowAccumulation,
      channelWidth,
      graph: settledRiverGraph,
      width,
      height,
    })
    onProgress(1)
    return { riverNetwork }
  },
}

/** @type {readonly HydrologySubstepModule[]} */
export const HYDROLOGY_SUBSTEP_MODULES = [
  hydrologyFillSubstep,
  hydrologyClimateSubstep,
  hydrologySeasonalSubstep,
  hydrologyRouteSubstep,
  hydrologyInciseSubstep,
  hydrologyExtractSubstep,
  hydrologyRefineSubstep,
  hydrologySettleSubstep,
  hydrologyPaintSubstep,
]

/** @type {Record<string, HydrologySubstepModule>} */
export const HYDROLOGY_SUBSTEP_MODULE_BY_ID = Object.fromEntries(
  HYDROLOGY_SUBSTEP_MODULES.map((module) => [module.id, module]),
)

/**
 * Resolve a substep module's narrow input object from the accumulated world.
 * @param {HydrologySubstepModule} module
 * @param {HydrologyWorld} world
 * @returns {Record<string, unknown>}
 */
export function selectHydrologySubstepInput(module, world) {
  /** @type {Record<string, unknown>} */
  const input = {}
  for (const [key, select] of Object.entries(module.inputs)) {
    input[key] = select(world)
  }
  return input
}
