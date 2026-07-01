# Subagent operating model — Phase 5 (#354)

This document is **mandatory reading** for every implementer and reviewer subagent on the `world-builder` branch.

## Mission

Complete GitHub epic [#354](https://github.com/enmaku/portfolio-site/issues/354) — final merge-readiness for the **landmass pipeline** — so that thermo-nuclear and architecture dry-runs (#379, #380) produce **zero structural blockers** before PR [#382](https://github.com/enmaku/portfolio-site/issues/382) merges to `main`.

## Non-negotiable rules

1. **No production code** until Wave 0 `DOC-AUDIT` passes (see [PHASE-5-MASTER-PLAN.md](./PHASE-5-MASTER-PLAN.md)).
2. **One slice at a time.** Do not touch files outside your issue's `MAY touch` list.
3. **Do not close GitHub issues.** Only the parent orchestrator closes issues after Parent QA.
4. **Do not skip reviews.** Implement → AutoVerify → mini thermo → mini arch → Parent QA.
5. **No gap-analysis theater.** Tests green ≠ merge-ready. Structural debt listed in [PHASE-5-MASTER-PLAN.md](./PHASE-5-MASTER-PLAN.md) must be **deleted**, not rearranged.
6. **No new branch.** All work stays on `world-builder`.
7. **No product scope.** Settlement, culture engine, full logistics pass, history log are out of scope.
8. **ESLint on every changed file** before claiming complete: `npx eslint --max-warnings 0 <files>`.
9. **No `eslint-disable`** unless the same pattern exists nearby for the same reason.
10. **No copy assertions in unit tests** (repo rule). Test behavior and contracts, not user-facing strings.

## Roles

| Role | May write code | May close issues | Runs AutoVerify | Runs mini reviews |
|------|----------------|------------------|-----------------|-------------------|
| Implementer subagent | Yes (in scope) | No | Yes | Self-checklist only |
| Reviewer subagent | No (readonly) | No | No | Yes — PASS/REWORK |
| Parent orchestrator | Yes (fixes rework) | Yes | Yes | Dispatches reviewer |

## Workflow (every deliverable)

```
Read mandatory docs
  → Implement sub-sub-steps in order
  → AutoVerify (eslint, tests, wc -l, forbidden greps)
  → Self-check MINI-REVIEW-RUBRICS for slice type
  → Hand off to parent
  → Parent launches reviewer subagent
  → PASS → next sub-sub-step | REWORK → fix all findings → repeat (max 3)
  → Parent QA → issue slice complete
```

## Branch and paths

- **Repo root:** portfolio-site (Quasar SPA + `world-builder/` package)
- **Branch:** `world-builder`
- **Domain glossary:** [../CONTEXT.md](../CONTEXT.md)
- **Context map:** [../../CONTEXT-MAP.md](../../CONTEXT-MAP.md)
- **ADR map display:** [../../docs/adr/0009-world-builder-map-display-stack.md](../../docs/adr/0009-world-builder-map-display-stack.md)

## Package layout (ADR-0009)

| Path | Role |
|------|------|
| `world-builder/core/` | **Landmass pipeline**, world document mutation — no DOM, no Pixi |
| `world-builder/renderer/` | Map viewport, layer compositing — reads world document + overlay config |
| `src/composables/` | Page controller, overlay owner, generation composables |
| `src/pages/projects/WorldBuilderPage.vue` | Quasar layout + thin controller bindings |

**Forbidden:** `world-builder/core/**` importing from `world-builder/renderer/**`.

## Test commands

```bash
npm run test:world-builder                    # all WB tests + module mocks
npm test                                      # full repo CI parity
npx eslint --max-warnings 0 <changed-files>
```

## When stuck

- **Structural ambiguity:** read the issue sub-plan in `plans/ISSUE-###.md` and the linked deep spec (e.g. HYDROLOGY-TYPED-STAGES.md).
- **Behavior regression:** run the test file listed in SEAM-TEST-CATALOG.md for your seam.
- **Third REWORK failure:** stop and escalate to parent — do not hack forward.

## Related documents

- [REWORK-PROTOCOL.md](./REWORK-PROTOCOL.md)
- [MINI-REVIEW-RUBRICS.md](./MINI-REVIEW-RUBRICS.md)
- [PHASE-5-MASTER-PLAN.md](./PHASE-5-MASTER-PLAN.md)
- [MERGE-GATES.md](./MERGE-GATES.md)
