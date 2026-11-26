/**
 * Static text for the CritCrafter "About and rules text licence" dialog (#505).
 * Counsel review of the ORC share-alike boundary and AoN's compilation layer is an open caveat;
 * see docs/critcrafter/LICENCE.md. Do not remove the caveat from this notice without that review.
 */

/** Default rules the viewer assumes and does not apply (SPEC, Derived numbers). */
export const ASSUMPTIONS = [
  'Default Pathfinder 2e rules are assumed. Proficiency Without Level and other variant rules are not applied.',
  'Level is added only for trained or better proficiency; untrained is the ability modifier alone.',
  'Armor check penalty, armor speed penalty and Strength requirements are not applied.',
  'Size adjustment to bulk limits is not applied.',
  'Any circumstance or status bonus not present in the Pathbuilder export is not applied.',
  'Conditions (dying, wounded, drained and so on) and daily-use ability tracking are not part of this viewer.',
  'Names that cannot be matched to rules text show the name only, with a search link.',
]

export const LICENCE_SECTIONS = [
  {
    title: 'ORC License',
    body:
      'Rules text for Pathfinder Second Edition (Remaster) content is used under the ORC License '
      + '(Library of Congress TX 9-307-067, available at paizo.com/orclicense). All warranties are disclaimed as set forth therein.',
  },
  {
    title: 'Open Game License v1.0a',
    body:
      'Rules text for legacy content is used under the Open Game License, Version 1.0a, '
      + 'Copyright 2000 Wizards of the Coast, LLC. Open Game Content is used as permitted by that licence.',
  },
  {
    title: 'Section 15, Copyright Notice',
    body:
      'Pathfinder Core Rulebook (Second Edition) (c) 2019, Paizo Inc. Authors: Logan Bonner, Jason Bulmahn, '
      + 'Stephen Radney-MacFarland, and Mark Seifter. Each entry detail shows the source book and licence of the text displayed.',
  },
  {
    title: 'Source and attribution',
    body:
      'Rules text is derived from the Foundry VTT Pathfinder 2e system data (foundryvtt/pf2e), published with permission of '
      + 'Paizo Inc. and the Foundry VTT project, and reflects their work. Reserved Material (setting proper nouns, art and logos) is not used.',
  },
  {
    title: 'No endorsement',
    body:
      'CritCrafter is an independent fan project. It is not published, endorsed or approved by Paizo Inc. or Foundry Gaming LLC, '
      + 'and it makes no compatibility claim. Pathfinder is a registered trademark of Paizo Inc.',
  },
  {
    title: 'Legal review pending',
    body:
      'Counsel has not yet reviewed the ORC share-alike boundary for rewritten text or the Archives of Nethys compilation layer. '
      + 'Treat this notice as provisional until that review is recorded.',
  },
]

/** Whole dialog as plain text (for tests and any plain rendering). */
export function aboutText() {
  return [
    ...ASSUMPTIONS,
    ...LICENCE_SECTIONS.flatMap((s) => [s.title, s.body]),
  ].join('\n')
}
