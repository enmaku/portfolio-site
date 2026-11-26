import ActionsScreen from './ActionsScreen.vue'
import GearScreen from './GearScreen.vue'
import SkillsScreen from './SkillsScreen.vue'
import SpellsScreen from './SpellsScreen.vue'
import StatsScreen from './StatsScreen.vue'

/**
 * Screen registry: tab key (viewerModel.TABS) to component. Every screen takes one prop, `sheet`
 * (the CritCrafter sheet). Replace a placeholder by editing its file; no wiring changes needed.
 */
export const SCREENS = {
  stats: StatsScreen,
  skills: SkillsScreen,
  gear: GearScreen,
  spells: SpellsScreen,
  actions: ActionsScreen,
}
