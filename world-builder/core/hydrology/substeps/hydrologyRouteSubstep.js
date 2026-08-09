import { buildRiverNetworkMask } from '../buildRiverNetworkMask.js'
import { FLOW_RECOMPUTE_REASONS, FLOW_RECOMPUTE_STAGES } from '../flowField.js'
import { riverMaskContractKey, setRiverMaskStage } from '../riverMaskLifecycle.js'
import { baselineDrainageFromState } from '../baselineDrainageFromState.js'

/** @typedef {import('./moduleTypes.js').HydrologySubstepModule} HydrologySubstepModule */

/** @type {HydrologySubstepModule} */
export const hydrologyRouteSubstep = {
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
