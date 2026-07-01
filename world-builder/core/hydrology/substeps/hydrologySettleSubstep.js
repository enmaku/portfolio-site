import { buildRiverGraph } from '../buildRiverGraph.js'
import { FLOW_RECOMPUTE_REASONS, FLOW_RECOMPUTE_STAGES } from '../flowField.js'
import { deriveDrainageFromFlow } from '../deriveDrainageFromFlow.js'
import { buildChannelWidthField } from '../extractRiverNetworkFromIncisedChannels.js'
import { applyLakeSurfacesFromMeta } from '../lakeDisplayCoherence.js'
import {
  resolveDisplayRiverNetworkMaskFromPipeline,
  resolveSimulationRiverNetworkMaskFromPipeline,
} from '../riverMaskLifecycle.js'
import { settleLakeEquilibrium } from '../settleLakeEquilibrium.js'
import { baselineDrainageFromState } from '../baselineDrainageFromState.js'

/** @typedef {import('./moduleTypes.js').HydrologySubstepModule} HydrologySubstepModule */

/** @type {HydrologySubstepModule} */
export const hydrologySettleSubstep = {
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
    simulationRiverGraph: (world) => world.settledRiverGraph,
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
    'simulationRiverGraph',
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
      simulationRiverGraph,
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
    const simulationRiverNetworkMask =
      resolveSimulationRiverNetworkMaskFromPipeline(riverMaskPipeline)
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
      channelMask: simulationRiverNetworkMask,
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
      simulationRiverGraph,
    }
  },
}
