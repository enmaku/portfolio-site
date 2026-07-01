# Merge gates — Phase 5 (#377–#382)

Commands and pass criteria for the final merge sequence on branch `world-builder`. Parent epic: [#354](https://github.com/enmaku/portfolio-site/issues/354). Prerequisites: all implementation issues #355–#375, #383–#386 complete with Parent QA; commit hygiene [#376](https://github.com/enmaku/portfolio-site/issues/376) done.

Run all commands from **repository root** (`portfolio-site/`).

---

## Gate overview

| Order | Issue | Gate | Blocking |
| ---: | ---: | --- | --- |
| 1 | #376 | Commit hygiene + clean working tree | #377, #378 |
| 2 | #377 | Full-repo ESLint | #379, #380 |
| 3 | #378 | Full-repo test | #379, #380 |
| 4 | #379 | Thermo-nuclear dry-run | #381 |
| 5 | #380 | Architecture dry-run | #381 |
| 6 | #381 | Manual QA | #382 |
| 7 | #382 | Merge PR + CI | merge to `main` |

---

## Gate 0 — Pre-gate (#376 commit hygiene)

**Purpose:** Branch is reviewable; commits grouped by slice.

```bash
git status
# Expect: nothing to commit, working tree clean

git log --oneline -30
# Expect: grouped commits (hydrology, landmass, overlay, tests, glossary)
# Not: one giant commit or dozens of one-line commits

git branch --show-current
# Expect: world-builder
```

**Pass criteria:**

- Working tree clean after maintainer commits
- Branch pushed to `origin/world-builder`
- Commit messages reference issue numbers where helpful

**Sub-plan:** [`plans/ISSUE-376.md`](./plans/ISSUE-376.md)

---

## Gate 1 — #377 Full-repo ESLint

**Purpose:** Every Phase 5 file passes project ESLint profile (`eslint.config.js`).

```bash
# Full repo (repo default --max-warnings 0)
npm run lint
```

If `npm run lint` fails, fix and re-run. For Phase 5 touched files individually:

```bash
# Example: all changed JS/Vue on branch vs main
git diff --name-only main...HEAD -- '*.js' '*.vue' | while read -r f; do
  [ -f "$f" ] && npx eslint --max-warnings 0 "$f"
done
```

**Forbidden pattern check (Phase 5 debt):**

```bash
rg 'Record<string, unknown>|Record<string, any>' world-builder/core/hydrology/ --glob '*.js'
# Expect 0 hits post-#355

rg 'vectorOverlays' world-builder/renderer/ --glob '*.js' | rg -v test | rg -v '\.test\.'
# Expect 0 hits post-#362
```

**Pass criteria:**

- `npm run lint` exits 0
- Every file created or modified in Phase 5 passes `npx eslint --max-warnings 0 <file>`
- No new `eslint-disable` unless matching pre-existing pattern with justification

**Sub-plan:** [`plans/ISSUE-377.md`](./plans/ISSUE-377.md)

---

## Gate 2 — #378 Full-repo test

**Purpose:** CI parity; viewport behavioral suites not skipped.

```bash
# File size budget (#372) — also runs inside test:world-builder
npm run check:world-builder-file-size

# First run
npm test

# World Builder package (includes composable tests via npm script)
npm run test:world-builder

# Second run — flake check
npm test
npm run test:world-builder
```

**Skipped test audit:**

```bash
npm test 2>&1 | rg 'SKIP|skipped' || true
# Expect: 0 skipped viewport overlay sync/locality/framing tests
```

**Pass criteria:**

- `npm test` exits 0 both runs
- `npm run test:world-builder` exits 0 both runs
- Skipped count 0 for viewport behavioral suites (#369)
- No new flaky tests

**Sub-plan:** [`plans/ISSUE-378.md`](./plans/ISSUE-378.md)

---

## Gate 3 — #379 Thermo-nuclear dry-run

**Purpose:** Zero structural blockers on full branch diff vs `main`.

**Prerequisite:** Gates 1 and 2 green.

```bash
# Re-verify gates
npm run lint && npm test && npm run test:world-builder

# File size audit (see FILE-SIZE-BUDGET.md)
find world-builder -name '*.js' -not -path '*/test*' -not -name '*.test.js' -exec wc -l {} + | sort -n | tail -20

# Instant-REWORK greps (REWORK-PROTOCOL.md)
rg 'Record<string, unknown>' world-builder/core/hydrology/ --glob '*.js'
rg 'readFileSync' world-builder --glob '*Seam*.test.js'
rg 'world-builder/renderer' world-builder/core/ world-builder/worker/ --glob '*.js' | rg -v test
```

**Review against [`MINI-REVIEW-RUBRICS.md`](./MINI-REVIEW-RUBRICS.md)** on full diff. Categories that must be empty:

- God-bag / shallow modules
- Overlay locality regression
- Source-grep seam tests
- Production file >1000 lines without PR justification
- Dual contract ceremony (parallel inputKeys tables)
- Page orchestration leak in SFC

**Pass criteria:**

- Dry-run verdict APPROVE-equivalent
- Findings list in merge PR description as "addressed" or deferred with issue/ADR (none expected)

**Sub-plan:** [`plans/ISSUE-379.md`](./plans/ISSUE-379.md)

---

## Gate 4 — #380 Architecture dry-run

**Purpose:** PR-scoped architecture review; three Strong deepenings verified.

**Prerequisite:** Gates 1 and 2 green.

```bash
npm run test:world-builder
```

**Verify Strong deepenings** (see [`ARCHITECTURE-SEAMS.md`](./ARCHITECTURE-SEAMS.md) Part 11):

1. **Hydrology typed modules** — deletion test narrative; substeps in `core/hydrology/substeps/*.js`
2. **Vector per-family layer IDs** — #362 grep clean; overlay sync tests per layer
3. **Landmass contracts derived** — `landmassPipelineStageContracts.js` derives from modules (#360)

**ADR-0009 checklist:**

Complete [`ADR-0009-COMPLIANCE-CHECKLIST.md`](./ADR-0009-COMPLIANCE-CHECKLIST.md) worksheet.

**Pass criteria:**

- No merge-blocking **Strong** architecture findings
- Simulation vs presentation hydrology seam clear for future **logistics pass**
- Deletion-test narrative captured in PR body

**Sub-plan:** [`plans/ISSUE-380.md`](./plans/ISSUE-380.md)

---

## Gate 5 — #381 Manual QA

**Purpose:** Human verification on Quasar dev server.

**Prerequisite:** #379 and #380 pass.

```bash
npx quasar dev
# Open: http://localhost:9000/#/projects/world-builder
```

**Checklist (check off in merge PR test plan):**

| # | Step | Pass |
| ---: | --- | :---: |
| 1 | Generate default **world**; map renders | ☐ |
| 2 | Pan and zoom work | ☐ |
| 3 | Framing preserved on regen | ☐ |
| 4 | Cancel mid-generation; UI recovers; no stuck progress | ☐ |
| 5 | Toggle each **strategic resource** overlay on/off; no indeterminate checkbox | ☐ |
| 6 | Change arable envelope threshold; only arable overlay affected | ☐ |
| 7 | Change arable threshold; reload page; arable slider retains value ([#385](https://github.com/enmaku/portfolio-site/issues/385)) | ☐ |
| 8 | Change **geography seed**; regen; validation panel updates | ☐ |
| 9 | Reset defaults; overlay display settings restore | ☐ |
| 10 | Validation row map focus zooms expected region | ☐ |
| 11 | Exhausted **rejection sampling** run shows failure indicator; map still usable | ☐ |

**Pass criteria:** All rows checked; notes for any defect filed as blocking issue before #382.

**Sub-plan:** [`plans/ISSUE-381.md`](./plans/ISSUE-381.md)

---

## Gate 6 — #382 Merge PR

**Purpose:** Ready-for-review PR `world-builder` → `main`.

**Prerequisite:** Gates 1–5 pass; CI configured for lint + test (+ build if applicable).

```bash
# Verify remote branch
git fetch origin
git status

# Build (if CI runs build)
npm run build
```

**PR requirements:**

- Title: Phase 5 / World Builder landmass pipeline merge-readiness (or similar)
- Body: Phase 1–5 summary, ADR-0009 compliance section, closed issue list (#355–#386)
- Test plan: manual QA from #381 + automated gate commands
- Assignee: `enmaku`
- **Not draft** (ready for review)
- CI green on PR

```bash
gh pr create --base main --head world-builder \
  --title "World Builder Phase 5: landmass pipeline merge-readiness" \
  --assignee @me \
  --body "$(cat <<'EOF'
## Summary
- Phase 5 structural debt removed on world-builder branch
- ADR-0009 seams verified (see test plan)

## Test plan
- [ ] npm run lint
- [ ] npm test (0 skipped viewport suites)
- [ ] Manual QA (#381 checklist)
- [ ] ADR-0009 compliance checklist

## Issues
Closes #354. Closes #355 … #386 (list in merge commit / PR body).

EOF
)"
```

**Pass criteria:**

- PR created ready for review
- CI green
- Merge unblocks [#354](https://github.com/enmaku/portfolio-site/issues/354) closure on merge

**Sub-plan:** [`plans/ISSUE-382.md`](./plans/ISSUE-382.md)

---

## Gate failure handling

| Failure | Action |
| --- | --- |
| Lint failure | Fix in place; re-run #377; do not proceed to #379 |
| Test failure | Fix or revert offending slice; re-run full #378 twice |
| Thermo structural blocker | Open targeted fix or REWORK slice; reset gate 3 |
| Architecture Strong finding | Fix before #381; document in PR if genuinely deferred |
| Manual QA defect | File issue; block #382 until resolved or waived by maintainer |
| CI failure on PR | Same as local gate failure; push fix to `world-builder` |

**Max rework:** Per [`REWORK-PROTOCOL.md`](./REWORK-PROTOCOL.md), 3 cycles per slice then escalate.

---

## Quick copy-paste — full gate sequence

```bash
# From repo root, branch world-builder, after #376
npm run lint
npm test
npm run test:world-builder
npm test
npm run test:world-builder
npm run build

# Structural greps
rg 'Record<string, unknown>' world-builder/core/hydrology/ --glob '*.js'
rg 'vectorOverlays' world-builder/renderer/ --glob '*.js' | rg -v test
rg 'readFileSync' world-builder --glob '*Seam*.test.js'
rg 'world-builder/renderer' world-builder/core/ world-builder/worker/ --glob '*.js' | rg -v test

# File size budget (#372)
npm run check:world-builder-file-size
```

All commands must succeed before opening #382 PR.

---

## Related documents

| Document | Role |
| --- | --- |
| [`PHASE-5-MASTER-PLAN.md`](./PHASE-5-MASTER-PLAN.md) | Wave map and success definition |
| [`REWORK-PROTOCOL.md`](./REWORK-PROTOCOL.md) | AutoVerify and REWORK rules |
| [`FILE-SIZE-BUDGET.md`](./FILE-SIZE-BUDGET.md) | Line limits for #372 |
| [`ADR-0009-COMPLIANCE-CHECKLIST.md`](./ADR-0009-COMPLIANCE-CHECKLIST.md) | #380 worksheet |
