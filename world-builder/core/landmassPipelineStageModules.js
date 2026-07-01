import { physicalTerrainBaselineStage } from './stages/physicalTerrainBaselineStage.js'
import { erosionStage } from './stages/erosionStage.js'
import { hydrologyStage } from './stages/hydrologyStage.js'
import { fieldRefreshStage } from './stages/fieldRefreshStage.js'
import { coastAndResourcesStage } from './stages/coastAndResourcesStage.js'
import { validationStage } from './stages/validationStage.js'

export { selectLandmassStageInput } from './stages/moduleTypes.js'

/** @typedef {import('./stages/moduleTypes.js').LandmassStageModule} LandmassStageModule */

/** @type {readonly LandmassStageModule[]} */
export const LANDMASS_PIPELINE_STAGE_MODULES = [
  physicalTerrainBaselineStage,
  erosionStage,
  hydrologyStage,
  fieldRefreshStage,
  coastAndResourcesStage,
  validationStage,
]

/** @type {Record<import('./landmassPipelineTypes.js').LandmassPipelineStepId, LandmassStageModule>} */
export const LANDMASS_PIPELINE_STAGE_MODULE_BY_ID = Object.fromEntries(
  LANDMASS_PIPELINE_STAGE_MODULES.map((module) => [module.id, module]),
)
