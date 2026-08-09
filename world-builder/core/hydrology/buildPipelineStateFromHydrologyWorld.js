import { classifyBiomesWithHydrology } from '../classifyBiomesFromFields.js'
import { refreshClimateScalarsAfterElevationMutation } from '../fields/refreshClimateScalarsAfterElevationMutation.js'
import { applyLakeSurfacesFromMeta } from './lakeDisplayCoherence.js'
import { getRiverMaskStage } from './riverMaskLifecycle.js'

/**
 * @typedef {import('./hydrologyWorldTypes.js').HydrologyAfterPaint} HydrologyAfterPaint
 * @typedef {import('./riverMaskLifecycle.js').RiverMaskPipeline} RiverMaskPipeline
 * @typedef {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} DerivedGeographyPipelineState
 */

/**
 * @param {HydrologyAfterPaint} world
 * @param {RiverMaskPipeline} riverMaskPipeline
 * @returns {DerivedGeographyPipelineState}
 */
export function buildPipelineStateFromHydrologyWorld(world, riverMaskPipeline) {
  const { state, width, height } = world
  const settledElevation = world.settledElevation
  const lakeIdByCell = world.lakeIdByCell
  const lakeMeta = world.lakeMeta
  const lakeMask = world.lakeMask
  if (lakeIdByCell && lakeMeta && lakeMask) {
    applyLakeSurfacesFromMeta(settledElevation, lakeIdByCell, lakeMeta, lakeMask, width, height)
  }

  const previewFields = refreshClimateScalarsAfterElevationMutation({
    geographySeed: state.geographySeed,
    prevailingWindDegrees: state.prevailingWindDegrees,
    elevation: settledElevation,
    drainage: world.settledDrainage,
    width,
    height,
    options: state.options,
  })

  const riverNetwork = world.riverNetwork
  const logisticsRiverGraph = world.simulationRiverGraph ?? riverNetwork.graph

  return {
    ...state,
    lakeMask,
    lakes: world.lakes,
    lakeMeta,
    lakeIdByCell,
    hydrologyStats: world.hydrologyStats,
    workingElevation: settledElevation,
    riverGraph: logisticsRiverGraph,
    simulationRiverMask: riverNetwork.simulationCenterline,
    riverNetworkMask: riverNetwork.centerline,
    riverCorridorMask: riverNetwork.corridor,
    channelWidth: world.channelWidth,
    flowDirection: world.settledFlowDirection,
    fields: previewFields,
    biomes: classifyBiomesWithHydrology(
      previewFields,
      width,
      height,
      {
        lakeMask,
        riverCorridorMask: getRiverMaskStage(riverMaskPipeline, 'painted'),
        flowDirection: world.settledFlowDirection,
      },
      state.options.seaLevel,
      state.geographySeed,
      state.options.biomeEdgeNoiseStrength,
    ),
    lastCompletedStep: 'hydrology',
  }
}
