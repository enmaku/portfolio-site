/**
 * Tuning constants for faction politics (behavior contracts stay fixed).
 */

/** Epochs between staggered component mint due dates after latch. */
export const FACTION_MINT_STAGGER_EPOCHS = 2

/** Refractory floor after an inverse membership flip (epochs). */
export const MEMBERSHIP_REFRACTORY_EPOCHS = 2

/** Epochs a cause must stay clear before re-arming. */
export const MEMBERSHIP_CLEAR_AND_REARM_EPOCHS = 2

/** Sustained epochs of lone unaligned viability before crystallize. */
export const UNALIGNED_CRYSTALLIZE_EPOCHS = 5

/** Sustained epochs of asymmetric dependence before absorption. */
export const ABSORPTION_SUSTAINED_EPOCHS = 3

/** Sustained epochs of local food independence before vassal loyalty breaks. */
export const VASSAL_INDEPENDENCE_EPOCHS = 3

/** Sustained epochs above strategic overstretch span before hinterland peel. */
export const OVERSTRETCH_STREAK_EPOCHS = 3

/** Maximum simultaneously living (active) factions (ColorBrewer qualitative set). */
export const MAX_ACTIVE_FACTIONS = 12
