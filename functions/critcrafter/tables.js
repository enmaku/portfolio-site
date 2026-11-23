'use strict'
// Fixed name tables for the Actions screen and the skill-to-action links. Each name must exist in the
// rules corpus as an `action`; names that do not resolve are left out (they are not export names, so no warning).

const GROUPS = [
  { id: 'class', label: 'Class', defaultOpen: true },
  { id: 'ancestry', label: 'Ancestry', defaultOpen: true },
  { id: 'general', label: 'General', defaultOpen: true },
  { id: 'archetype', label: 'Archetype', defaultOpen: true },
  { id: 'familiar', label: 'Familiar', defaultOpen: true },
  { id: 'basic', label: 'Basic actions', defaultOpen: false },
  { id: 'exploration', label: 'Exploration', defaultOpen: false },
  { id: 'skill', label: 'Skill actions', defaultOpen: false },
]

/** Universal basic actions, then specialty basic actions. */
const BASIC_ACTIONS = [
  'Aid', 'Avert Gaze', 'Cast a Spell', 'Crawl', 'Delay', 'Drop Prone', 'Escape', 'Interact', 'Leap', 'Raise a Shield',
  'Ready', 'Release', 'Seek', 'Sense Motive', 'Stand', 'Step', 'Stride', 'Strike', 'Take Cover',
  'Arrest a Fall', 'Dismiss', 'Grab an Edge', 'Mount', 'Point Out', 'Sustain',
]

const EXPLORATION_ACTIONS = [
  'Avoid Notice', 'Defend', 'Detect Magic', 'Follow the Expert', 'Hustle', 'Investigate', 'Refocus', 'Repeat a Spell', 'Scout', 'Search',
]

/** Skill id -> the actions that use it (Athletics: Grapple, Trip, Shove ...). */
const SKILL_ACTIONS = {
  acrobatics: ['Balance', 'Maneuver in Flight', 'Squeeze', 'Tumble Through'],
  arcana: ['Borrow an Arcane Spell', 'Decipher Writing', 'Identify Magic', 'Learn a Spell', 'Recall Knowledge'],
  athletics: ['Climb', 'Disarm', 'Force Open', 'Grapple', 'High Jump', 'Long Jump', 'Reposition', 'Shove', 'Swim', 'Trip'],
  crafting: ['Craft', 'Earn Income', 'Identify Alchemy', 'Repair'],
  deception: ['Create a Diversion', 'Feint', 'Impersonate', 'Lie'],
  diplomacy: ['Gather Information', 'Make an Impression', 'Request'],
  intimidation: ['Coerce', 'Demoralize'],
  medicine: ['Administer First Aid', 'Treat Disease', 'Treat Poison', 'Treat Wounds'],
  nature: ['Command an Animal', 'Identify Magic', 'Learn a Spell', 'Recall Knowledge'],
  occultism: ['Identify Magic', 'Learn a Spell', 'Recall Knowledge'],
  performance: ['Earn Income', 'Perform'],
  religion: ['Identify Magic', 'Learn a Spell', 'Recall Knowledge'],
  society: ['Create Forgery', 'Decipher Writing', 'Recall Knowledge', 'Subsist'],
  stealth: ['Conceal an Object', 'Hide', 'Sneak'],
  survival: ['Cover Tracks', 'Sense Direction', 'Subsist', 'Track'],
  thievery: ['Disable a Device', 'Palm an Object', 'Pick a Lock', 'Steal'],
}

/** Export field -> corpus types a name from that field may resolve to. */
const HINTS = {
  feat: ['feat', 'classFeature'],
  special: ['classFeature', 'feat', 'heritage', 'action'],
  heritage: ['heritage'],
  item: ['equipment'],
  spell: ['spell'],
  familiar: ['action', 'feat'],
}

module.exports = { GROUPS, BASIC_ACTIONS, EXPLORATION_ACTIONS, SKILL_ACTIONS, HINTS }
