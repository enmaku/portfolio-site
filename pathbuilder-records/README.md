# Pathbuilder 2e — reverse-engineering context

Research corpus for a planned **mobile-first** character-builder app, produced by
reverse-engineering `https://pathbuilder2e.com/app.html?v=81e` (app version **112.0
"Feylines"**).

This folder is **documentation only**. It is deliberately *not* wired into
[`../CONTEXT-MAP.md`](../CONTEXT-MAP.md) yet — that happens once the new application
takes shape and its domain vocabulary is settled.

## Start here

| Document | Topic |
| --- | --- |
| [FINAL-REPORT.md](./FINAL-REPORT.md) | Executive summary of the whole investigation |
| [docs/00-overview.md](./docs/00-overview.md) | Document map, executive summary, reading order |
| [docs/09-clone-blueprint.md](./docs/09-clone-blueprint.md) | Recommended architecture for the rewrite |
| [docs/10-pathfinder-2e-rules.md](./docs/10-pathfinder-2e-rules.md) | PF2e rules primer (rules authority) |
| [docs/11-legal-and-licensing.md](./docs/11-legal-and-licensing.md) | What may and may not be copied |

## Layout

```
pathbuilder/
  FINAL-REPORT.md      summary of method, findings, and deliverables
  docs/                12 analysis documents (~280 KB)
    img/               55 captured screenshots, embedded in 06-ui-architecture.md
  probe/               the CDP toolkit that produced docs/ (no assets/)
```

## Reading order

`10` (what the rules are) → `00` (what the app is) → `01`/`02` (what data exists) →
`03`/`04`/`05` (how it is modelled) → `06`/`07` (how it renders and computes) →
`08` (how it escapes) → `09` (what to build) → `11` (what you may ship).

## What is not here

`probe/assets/` is excluded: it held a beautified copy of Pathbuilder's shipped
JavaScript bundle, its raw CDN data files, a 245-table SQLite mirror, and derived text
dumps. Those are third-party artifacts, so they are not redistributed. Every
`probe/assets/…` path referenced in `docs/` names a file you regenerate locally —
see [`probe/README.md`](./probe/README.md).

## Legal note

[docs/11-legal-and-licensing.md](./docs/11-legal-and-licensing.md) governs what may be
copied. In short: an independently-written, functionally-equivalent builder is
permitted, as is reading and writing the same JSON export format for compatibility.
Copying Pathbuilder's source, CSS, artwork, or icons is not, and neither is using its
name. The screenshots in `docs/img/` are captures of its live UI and are included here
as analysis evidence, not as assets to reuse.
