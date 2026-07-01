# Rework protocol — Phase 5

Every implementer deliverable follows **Implement → AutoVerify → Mini thermo → Mini arch → Parent QA → Accept or REWORK**.

## AutoVerify (implementer runs all, pastes output to parent)

```bash
# Changed files (from git diff or explicit list)
git diff --name-only

# ESLint — every changed .js / .vue
npx eslint --max-warnings 0 path/to/changed.js ...

# Tests — slice-specific (see issue sub-plan)
npm run test:world-builder -- world-builder/core/hydrology/hydrologySubsteps.test.js

# Line counts — production files only
wc -l path/to/changed.js

# Forbidden patterns (zero hits unless sub-plan exempts)
rg 'Record<string, unknown>|Record<string, any>' world-builder/core/hydrology/ --glob '*.js'
rg "readFileSync" world-builder --glob '*Seam*.test.js'
```

After #362 lands, also:

```bash
rg 'vectorOverlays' world-builder/renderer/ --glob '*.js' | rg -v test | rg -v '\.test\.'
# Expect 0 production hits
```

## Mini thermo-nuclear review

Parent launches **readonly** reviewer with:

> Apply thermo-nuclear standards to **only** files changed in [SLICE]. Use MINI-REVIEW-RUBRICS.md § [slice-type]. Verdict: **PASS** or **REWORK** with R1, R2, … tagged `[blocker]`, `[structure]`, or `[advisory]`.

**Instant REWORK (any one):**

- `HydrologyWorld & Record<string, unknown>` or equivalent god-bag
- Public substep `run(input: Record<string, any>, …)`
- Production file > **1000** lines
- Hand-maintained `inputKeys`/`outputKeys` parallel to module metadata (post-#360)
- `vectorOverlays` in new production renderer code (post-#362)
- Test title mentions simulation without asserting `simulationRiverMask`
- `readFileSync` source inspection in runtime seam tests
- Renderer import in generation/core path

## Mini architecture review

Parent launches **readonly** reviewer with:

> PR-scoped architecture review. Module/seam/depth/locality vocabulary. Up to 3 findings. **Strong** = REWORK.

**Strong deepenings that must PASS by #380:**

1. Hydrology typed stages — deletion test per substep file
2. Vector per-family layer IDs — overlay owner seam
3. Landmass contracts derived from stage modules

## REWORK rules

1. Reviewer assigns `R1`, `R2`, … — implementer fixes **all**.
2. After rework, re-run **full** AutoVerify + both mini reviews (not partial).
3. **Max 3 rework cycles** per sub-sub-step; then escalate to parent for plan amendment.
4. Subagent must **not** mark GitHub issue complete.

## Parent QA (after both mini reviews PASS)

- [ ] Diff matches sub-plan `MAY touch` list (no drive-by edits)
- [ ] Issue acceptance criteria satisfied verbatim
- [ ] Reviewer PASS artifact in chat/issue comment
- [ ] No TODO/FIXME in production code
- [ ] Parent may close issue slice

## Verdict record template

```markdown
## Slice [ID] — [date]
- Implementer: ...
- Verdict: PASS | REWORK
- Thermo: [blocker count] / [structure count]
- Arch: [Strong count]
- Tests: npm run test:world-builder → [pass/fail] [skipped count]
- ESLint: [pass/fail]
- Notes: ...
```
