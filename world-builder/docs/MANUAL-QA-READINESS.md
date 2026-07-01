# Manual QA gate readiness — Phase 5 Gate 5 (#381)

> **Branch:** `world-builder`  
> **Issue:** [#381](https://github.com/enmaku/portfolio-site/issues/381) — manual QA checklist for World Builder Phase 5  
> **Parent epic:** [#354](https://github.com/enmaku/portfolio-site/issues/354)  
> **Generated:** 2026-06-30 (Ralph Step 2 of 3 — Gate 5 checklist **ready-for-human-execution**; **no manual QA executed in CI**)

Formalizes sub-sub-step **381.0 (checklist audit)** before executing **381.1 … 381.10** per [plans/ISSUE-381.md](./plans/ISSUE-381.md). Ralph Step 2 prepares the checklist and syncs GitHub; **human execution** on `quasar dev` is required because Gate 5 cannot be fully automated in CI. Recording results in the merge PR test plan is **Ralph Step 3**.

---

## CI limitation

Gate 5 manual QA **cannot be fully executed in CI**. Rows depend on interactive browser behavior (pan/zoom, overlay toggles, slider persistence after reload, validation panel focus). Automated tests cover seams and contracts; this gate requires a human on `npx quasar dev` at `http://localhost:9000/#/projects/world-builder`.

**Status:** `ready-for-human-execution` — all doc sources aligned; proceed with Gate 5 rows 1–11 when [#379](https://github.com/enmaku/portfolio-site/issues/379) and [#380](https://github.com/enmaku/portfolio-site/issues/380) Parent QA PASS.

---

## Checklist source-of-truth audit

| Artifact | 381.5 reload persistence (#385) | Step count | Status |
| --- | --- | ---: | --- |
| [plans/ISSUE-381.md](./plans/ISSUE-381.md) | ✓ step 381.5 | 10 (381.1–381.10) | **Canonical — already complete** |
| [MERGE-GATES.md](./MERGE-GATES.md) Gate 5 | ✓ row 7 | 11 rows + record in PR | **Complete** |
| [SUBAGENT-WAVE-PROMPTS/ISSUE-381.md](./SUBAGENT-WAVE-PROMPTS/ISSUE-381.md) | was missing | was 9 | **Fixed this step** |
| [_generate-issue-docs.mjs](./_generate-issue-docs.mjs) `#381` | was missing | was 9 | **Fixed this step** |
| GitHub [#381](https://github.com/enmaku/portfolio-site/issues/381) issue body | ✓ step 381.5 | 10 AC lines | **Synced (Ralph Step 2)** |

---

## Gate 5 ↔ sub-sub-step mapping

Gate 5 expands **381.1** (generate / pan / zoom / framing) into four PR-friendly rows. All other rows map 1:1.

| Gate 5 # | Gate 5 step | Sub-sub-step |
| ---: | --- | --- |
| 1 | Generate default **world**; map renders | 381.1 |
| 2 | Pan and zoom work | 381.1 |
| 3 | Framing preserved on regen | 381.1 |
| 4 | Cancel mid-generation; UI recovers; no stuck progress | 381.2 |
| 5 | Toggle each **strategic resource** overlay on/off; no indeterminate checkbox | 381.3 |
| 6 | Change arable envelope threshold; only arable overlay affected | 381.4 |
| 7 | Change arable threshold; reload page; arable slider retains value ([#385](https://github.com/enmaku/portfolio-site/issues/385)) | **381.5** |
| 8 | Change **geography seed**; regen; validation panel updates | 381.6 |
| 9 | Reset defaults; overlay display settings restore | 381.7 |
| 10 | Validation row map focus zooms expected region | 381.8 |
| 11 | Exhausted **rejection sampling** run shows failure indicator; map still usable | 381.9 |
| — | Check off in merge PR test plan | 381.10 |

---

## 381.5 — reload persistence spot-check (Gate 5 row 7)

Depends on [#385](https://github.com/enmaku/portfolio-site/issues/385) Pinia overlay display settings persistence.

1. Open `http://localhost:9000/#/projects/world-builder` (`npx quasar dev`).
2. Generate a default **world**; wait for map to render.
3. Enable the **arable** strategic resource overlay if not already visible.
4. Move the **arable envelope threshold** slider away from its default; confirm only the arable overlay changes visually (381.4 sanity).
5. **Reload the page** (hard refresh acceptable).
6. **Pass:** arable slider shows the same threshold value as before reload; overlay reflects that threshold after regen or overlay refresh.

---

## Full manual QA procedure (human execution)

```bash
npx quasar dev
# Open: http://localhost:9000/#/projects/world-builder
```

Execute [MERGE-GATES.md](./MERGE-GATES.md) Gate 5 rows 1–11 in order, then sub-sub-steps **381.1–381.9** from [plans/ISSUE-381.md](./plans/ISSUE-381.md). File blocking defects before [#382](https://github.com/enmaku/portfolio-site/issues/382).

---

## Acceptance criteria (#381)

| Criterion | Doc sync (Step 1) | Manual pass (human) |
| --- | --- | --- |
| Generate default world; map renders; pan/zoom; framing on regen | ✓ in plan + Gate 5 rows 1–3 | Pending |
| Cancel mid-generation; UI recovers; no stuck progress | ✓ | Pending |
| Toggle each strategic resource overlay; no indeterminate checkbox | ✓ | Pending |
| Change arable envelope threshold; only arable overlay affected | ✓ | Pending |
| Change arable threshold; reload; slider retains value ([#385](https://github.com/enmaku/portfolio-site/issues/385)) | ✓ (gap fixed) | Pending |
| Change geography seed; regen; validation panel updates | ✓ | Pending |
| Reset defaults; overlay display settings restore | ✓ | Pending |
| Validation row map focus zooms expected region | ✓ | Pending |
| Exhausted validation run shows failure indicator; map still usable | ✓ | Pending |
| Results checked off in PR test plan | Pending (Step 3) | Pending |

---

## Gate 5 pass criteria ([MERGE-GATES.md](./MERGE-GATES.md))

| Criterion | Status |
| --- | --- |
| Checklist complete in plan, Gate 5, subagent prompt, generator, GitHub #381 | ✓ |
| 381.5 reload persistence included | ✓ |
| Checklist marked ready-for-human-execution | ✓ (Ralph Step 2) |
| CI limitation documented (Gate 5 not automatable) | ✓ (Ralph Step 2) |
| All Gate 5 rows checked on dev server | **Pending — human execution** |
| Defects filed before #382 if any row fails | **Pending — human execution** |

**Blocks:** [#382](https://github.com/enmaku/portfolio-site/issues/382) until Gate 5 fully passes.

---

## Ralph Step 1 deliverable summary

| Item | Status |
| --- | --- |
| Read [plans/ISSUE-381.md](./plans/ISSUE-381.md) + Gate 5 | ✓ |
| 381.5 reload persistence present in all doc sources | ✓ (2 files updated) |
| Gate 5 ↔ 381.x mapping documented | ✓ (table above) |
| MANUAL-QA-READINESS.md | ✓ this file |

## Ralph Step 2 deliverable summary (#381.2)

| Item | Status |
| --- | --- |
| Gate 5 checklist ready-for-human-execution | ✓ |
| CI limitation documented (not fully automatable) | ✓ |
| GitHub [#381](https://github.com/enmaku/portfolio-site/issues/381) body synced with 381.5 reload AC | ✓ |
| 381.5 reload spot-check procedure documented | ✓ (section above) |
| Manual QA on quasar dev | **NO** — requires human; blocked from CI |
| PR test plan checkoffs | **NO** (Step 3) |

**Next (human):** Run Gate 5 checklist on `npx quasar dev` at `http://localhost:9000/#/projects/world-builder`; include **381.5** reload spot-check.

**Next (Ralph Step 3):** Record pass/fail per row in merge PR test plan ([#382](https://github.com/enmaku/portfolio-site/issues/382)).

---

## Related

- [plans/ISSUE-381.md](./plans/ISSUE-381.md)
- [SUBAGENT-WAVE-PROMPTS/ISSUE-381.md](./SUBAGENT-WAVE-PROMPTS/ISSUE-381.md)
- [MERGE-GATES.md](./MERGE-GATES.md) — Gate 5
- [plans/ISSUE-385.md](./plans/ISSUE-385.md) — overlay persistence (#381.5 dependency)
