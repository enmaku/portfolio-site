/**
 * Assemble pipeline state after hydrologyFinalize has produced fields and biomes.
 * @typedef {import('./hydrologyWorldTypes.js').HydrologyAfterFinalize} HydrologyAfterFinalize
 * @typedef {import('./riverMaskLifecycle.js').RiverMaskPipeline} RiverMaskPipeline
 * @typedef {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} DerivedGeographyPipelineState
 */

/**
 * @param {HydrologyAfterFinalize} world
 * @param {RiverMaskPipeline} [_unusedRiverMaskPipeline] kept for call-site compatibility
 * @returns {DerivedGeographyPipelineState}
 */
export function buildPipelineStateFromHydrologyWorld(world) {
  const { state } = world
  const settledElevation = world.settledElevation
  const riverNetwork = world.riverNetwork
  const logisticsRiverGraph = world.simulationRiverGraph ?? riverNetwork.graph

  return {
    ...state,
    lakeMask: world.lakeMask,
    lakes: world.lakes,
    lakeMeta: world.lakeMeta,
    lakeIdByCell: world.lakeIdByCell,
    hydrologyStats: world.hydrologyStats,
    workingElevation: settledElevation,
    riverGraph: logisticsRiverGraph,
    simulationRiverMask: riverNetwork.simulationCenterline,
    riverNetworkMask: riverNetwork.centerline,
    riverCorridorMask: riverNetwork.corridor,
    channelWidth: world.channelWidth,
    flowDirection: world.settledFlowDirection,
    fields: world.fields,
    biomes: world.biomes,
    lastCompletedStep: 'hydrology',
  }
}
