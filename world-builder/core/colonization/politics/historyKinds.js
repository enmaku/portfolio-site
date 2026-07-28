/**
 * History log kinds for increment 3 faction politics.
 * Domain: world-builder/CONTEXT.md — history log, faction, faction absorption.
 */

export const HISTORY_KIND_INCREMENT3_LATCHED = 'increment3_latched'
export const HISTORY_KIND_FACTION_EMERGED = 'faction_emerged'
export const HISTORY_KIND_FACTION_EXTINCT = 'faction_extinct'
export const HISTORY_KIND_FACTION_ABSORPTION = 'faction_absorption'
export const HISTORY_KIND_VASSAL_DEFECTION = 'vassal_defection'
export const HISTORY_KIND_CITY_STATE_FOUNDING = 'city_state_founding'

/** @type {ReadonlySet<string>} */
export const POLITICS_HISTORY_KINDS = Object.freeze(
  new Set([
    HISTORY_KIND_INCREMENT3_LATCHED,
    HISTORY_KIND_FACTION_EMERGED,
    HISTORY_KIND_FACTION_EXTINCT,
    HISTORY_KIND_FACTION_ABSORPTION,
    HISTORY_KIND_VASSAL_DEFECTION,
    HISTORY_KIND_CITY_STATE_FOUNDING,
  ]),
)
