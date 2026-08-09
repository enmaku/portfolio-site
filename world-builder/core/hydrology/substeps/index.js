import { hydrologyFillSubstep } from './hydrologyFillSubstep.js'
import { hydrologyClimateSubstep } from './hydrologyClimateSubstep.js'
import { hydrologySeasonalSubstep } from './hydrologySeasonalSubstep.js'
import { hydrologyRouteSubstep } from './hydrologyRouteSubstep.js'
import { hydrologyInciseSubstep } from './hydrologyInciseSubstep.js'
import { hydrologyExtractSubstep } from './hydrologyExtractSubstep.js'
import { hydrologyRefineSubstep } from './hydrologyRefineSubstep.js'
import { hydrologySettleSubstep } from './hydrologySettleSubstep.js'
import { hydrologyPaintSubstep } from './hydrologyPaintSubstep.js'

/** @typedef {import('./moduleTypes.js').HydrologySubstepModule} HydrologySubstepModule */

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

/** @type {Object.<string, HydrologySubstepModule>} */
export const HYDROLOGY_SUBSTEP_MODULE_BY_ID = Object.fromEntries(
  HYDROLOGY_SUBSTEP_MODULES.map((module) => [module.id, module]),
)

export { selectHydrologySubstepInput } from './moduleTypes.js'
