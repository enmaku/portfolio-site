import { buildWorldDocumentFromPipelineState } from '../buildWorldDocumentFromPipelineState.js'
import { cloneWorldDocument } from '../cloneWorldDocument.js'
import { getRiverMaskStage } from './riverMaskLifecycle.js'

/**
 * Build an interim world document for map redraw at hydrology milestones.
 * @param {Object} params
 * @param {string} [params.substepId]
 * @param {import('./hydrologyWorldTypes.js').HydrologyWorldBase & Record<string, unknown>} params.world
 * @param {import('./riverMaskLifecycle.js').RiverMaskPipeline} params.riverMaskPipeline
 * @returns {import('../types.js').WorldDocument | null}
 */
export function buildHydrologySubstepPreviewDocument({ world, riverMaskPipeline }) {
  const state = world.state
  if (!state) return null

  const settledElevation =
    world.settledElevation ?? world.filledElevation ?? state.workingElevation ?? state.fields?.elevation
  const sketch = getRiverMaskStage(riverMaskPipeline, 'sketch')
  const incised = getRiverMaskStage(riverMaskPipeline, 'incised')
  const settled = getRiverMaskStage(riverMaskPipeline, 'settled')
  const presentation = getRiverMaskStage(riverMaskPipeline, 'presentation')
  const painted = getRiverMaskStage(riverMaskPipeline, 'painted')
  const simulationCenterline = settled ?? incised ?? sketch ?? state.simulationRiverMask
  const displayCenterline = presentation ?? settled ?? incised ?? sketch ?? state.riverNetworkMask
  const corridor = painted ?? presentation ?? displayCenterline ?? state.riverCorridorMask

  /** @type {import('../landmassPipelineTypes.js').DerivedGeographyPipelineState} */
  const previewState = {
    ...state,
    lakeMask: world.lakeMask ?? state.lakeMask,
    lakes: world.lakes ?? state.lakes,
    lakeMeta: world.lakeMeta ?? state.lakeMeta,
    lakeIdByCell: world.lakeIdByCell ?? state.lakeIdByCell,
    hydrologyStats: world.hydrologyStats ?? state.hydrologyStats,
    workingElevation: settledElevation ?? state.workingElevation,
    riverGraph: world.settledRiverGraph ?? world.simulationRiverGraph ?? state.riverGraph,
    simulationRiverMask: simulationCenterline,
    riverNetworkMask: displayCenterline,
    riverCorridorMask: corridor,
    channelWidth: world.channelWidth ?? state.channelWidth,
    flowDirection: world.settledFlowDirection ?? world.flowDirection ?? state.flowDirection,
    fields: world.fields
      ? world.fields
      : state.fields && settledElevation
        ? { ...state.fields, elevation: settledElevation }
        : state.fields,
    biomes: world.biomes ?? state.biomes,
    lastCompletedStep: 'hydrology',
  }

  try {
    return cloneWorldDocument(buildWorldDocumentFromPipelineState(previewState))
  } catch {
    return null
  }
}
