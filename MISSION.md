# Mission: Portfolio Site Codebase

## Why

Most of this codebase was written with LLM assistance. As sole maintainer, you need a **systems-level mental model**: where every major file group lives, what each system does, and the **interfaces** of the most-used modules — without memorizing implementation details. That lets you make intelligent design choices, review PRs (including agent-generated ones), and know where to drill down when something breaks.

## Success looks like

- Glance at any path under `src/` and know which system owns it and what responsibility it carries
- Name the primary **interface** (exports, props, wire shapes) for star-room P2P, each project feature, routing/sharing, and build scripts — treat internals as gray boxes until needed
- Trace a feature request to the right bounded context before opening files
- Perform systems-thinking on new features: what shells, stores, Firebase paths, and CONTEXT terms are affected
- Review agent output by checking layer placement and interface contracts, not line-by-line re-derivation

## Constraints

- **High-level first** — structure and interfaces, not algorithm/game-rule internals unless requested
- Ground teaching in this repo's CONTEXT files, ADRs, and README
- Sole maintainer; no onboarding-for-others framing
- Gray-box file contents are fine; atlas + interface cards are the durable artifacts

## Out of scope

- Memorizing election math, dungeon engine rules, or NN training (sibling dungeon-runner repo)
- Generic Vue/Quasar tutorials
- Line-by-line walkthrough of every file
