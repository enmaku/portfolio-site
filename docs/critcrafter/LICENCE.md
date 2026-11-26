# CritCrafter licence notes and open ship-blockers

Source of truth for the in-app notice is `src/features/critcrafter/about/aboutContent.js` (rendered by `CritcrafterAbout.vue` on the landing screen and at the end of every viewer screen). Basis and facts: SPEC.md, Corpus section.

## Rules text licence notice

The consolidated "Rules text licence" notice carries: the ORC notice, the OGL 1.0a text and a Section 15 line, Paizo and Foundry VTT attribution, no implied endorsement, no compatibility claim, and no Reserved Material. Each entry's detail sheet additionally shows that entry's own licence tag and source book.

The Section 15 list in the notice is a baseline (Pathfinder Core Rulebook, Second Edition). The owner or counsel should confirm it is the complete list required for the OGL-tagged legacy entries shipped.

## Counsel caveat (open)

Counsel has not reviewed: (1) the ORC share-alike boundary for rewritten or derived text, and (2) Archives of Nethys' compilation layer (alias pairs fetched server-side at ingest). The notice says so explicitly. The caveat ships with the notice and is removed only when a review is recorded here.

## Ship-blocker: action glyph licence (UNRESOLVED, owner decision)

The action-cost glyphs (`src/assets/critcrafter-prototype/action-*.png`, copied from the SoT card templates) have unconfirmed provenance and licence. They are used:

- in the production viewer UI (`CritcrafterCostGlyph.vue`: one, two, three actions, reaction, free), and
- planned as the basis for the share card, favicon and Open Graph icon (SPEC, Share, favicon and nav).

Do not ship the viewer or branding built on them until the owner confirms the licence, or replaces them with licensed or self-drawn art (for example a Paizo Community Use compatible approach, or plain-text cost labels). This is an owner-only decision and is not decided in code or docs here. #505 cannot close while it is open.

## Other launch items (owner or lead)

- First production ingest, verified (runbook).
- App Check registered with a reCAPTCHA key and the site key set in the production build (runbook, "function deploy and App Check").
- Function deploy.
