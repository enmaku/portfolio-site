/**
 * History log kinds for increment 3 faction politics.
 * Domain: world-builder/CONTEXT.md — history log, faction, conflict engine.
 */

export const HISTORY_KIND_INCREMENT3_LATCHED = 'increment3_latched'
export const HISTORY_KIND_FACTION_EMERGED = 'faction_emerged'
export const HISTORY_KIND_FACTION_EXTINCT = 'faction_extinct'
export const HISTORY_KIND_FACTION_ABSORPTION = 'faction_absorption'
export const HISTORY_KIND_VASSAL_DEFECTION = 'vassal_defection'
export const HISTORY_KIND_CITY_STATE_FOUNDING = 'city_state_founding'
export const HISTORY_KIND_MAJOR_WAR_START = 'major_war_start'
export const HISTORY_KIND_MAJOR_WAR_END = 'major_war_end'
export const HISTORY_KIND_REBELLION_START = 'rebellion_start'
export const HISTORY_KIND_REBELLION_END = 'rebellion_end'
export const HISTORY_KIND_TREATY_PEACE = 'treaty_peace'
export const HISTORY_KIND_TRADE_PARTNER_JOIN = 'trade_partner_join'
export const HISTORY_KIND_TRADE_PARTNER_PEEL = 'trade_partner_peel'
export const HISTORY_KIND_TRADE_BACKED_REBEL_EXIT = 'trade_backed_rebel_exit'
export const HISTORY_KIND_ALLIANCE = 'alliance'

/** @type {ReadonlySet<string>} */
export const POLITICS_HISTORY_KINDS = Object.freeze(
  new Set([
    HISTORY_KIND_INCREMENT3_LATCHED,
    HISTORY_KIND_FACTION_EMERGED,
    HISTORY_KIND_FACTION_EXTINCT,
    HISTORY_KIND_FACTION_ABSORPTION,
    HISTORY_KIND_VASSAL_DEFECTION,
    HISTORY_KIND_CITY_STATE_FOUNDING,
    HISTORY_KIND_MAJOR_WAR_START,
    HISTORY_KIND_MAJOR_WAR_END,
    HISTORY_KIND_REBELLION_START,
    HISTORY_KIND_REBELLION_END,
    HISTORY_KIND_TREATY_PEACE,
    HISTORY_KIND_TRADE_PARTNER_JOIN,
    HISTORY_KIND_TRADE_PARTNER_PEEL,
    HISTORY_KIND_TRADE_BACKED_REBEL_EXIT,
    HISTORY_KIND_ALLIANCE,
  ]),
)
