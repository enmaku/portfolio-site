# Page controller interface — `useWorldBuilderPageController`

> **Purpose:** Document the single app seam between `WorldBuilderPage.vue` and World Builder packages (ADR-0009). Drives [#368](https://github.com/enmaku/portfolio-site/issues/368) SFC thinning and [#375](https://github.com/enmaku/portfolio-site/issues/375) behavioral test matrix.
>
> **Source:** `src/composables/useWorldBuilderPageController.js`

---

## Architectural role

The page controller is the **only** place the Vue layer may:

- Wire generation (`useWorldBuilderGeneration`) to map lifecycle (`createGenerationMapLifecycle`)
- Lazy-load the renderer viewport factory (`createWorldBuilderMapViewport`)
- Project overlay owner state (`useWorldBuilderOverlayState`) to the viewport
- Expose validation/hydrology **display models** (computed from `worldDocument.generationReport`)

The SFC renders markup and delegates side effects here. It must not import `@world-builder/core`, worker modules, or renderer implementations directly after #368.

```
WorldBuilderPage.vue
  └─ useWorldBuilderPageController({ getMapHost, settingsStore, ... })
       ├─ useWorldBuilderGeneration (generation seam)
       ├─ useWorldBuilderOverlayState (overlay seam)
       ├─ worldBuilderPageModel (display projections)
       └─ createGenerationMapLifecycle (map host ↔ viewport)
```

---

## Constructor options

| Option | Required | Default | Role |
|--------|----------|---------|------|
| `getMapHost` | yes | — | Returns DOM element for Pixi canvas mount |
| `settingsStore` | yes | — | Pinia-backed seed, wind, generation options, overlay persistence |
| `onGenerationError` | no | — | `(message: string) => void` error forwarding |
| `loadViewportFactory` | no | dynamic import of `@world-builder/renderer/createWorldBuilderMapViewport` | Test injection point |
| `createMapLifecycle` | no | `createGenerationMapLifecycle` | Test injection point |
| `runDerivedGeographyInWorker` | no | default worker runner | Test injection point |

All behavioral tests (#375) should inject fakes for the three defaults — never mount the full page or real renderer.

---

## Returned state (read-only refs / computeds)

| Export | Type | Source |
|--------|------|--------|
| `seedInput` | `Ref<string>` | Local seed text field |
| `worldDocument` | from generation | Latest pipeline/world doc |
| `generationProgress` | from generation | Step/substep indices |
| `showGenerationProgress` | from generation | UI visibility flag |
| `showResourceOverlayBar` | from generation | Post-validation overlay chrome |
| `showValidationFailureIndicator` | from generation | Rejection/exhausted signal |
| `validationRows` | `ComputedRef` | `createValidationRowsForDisplay(report)` |
| `stageSummary` | `ComputedRef` | `createStageSummaryForDisplay(report)` |
| `hydrologyStats` | `ComputedRef` | `createHydrologyStatsForDisplay(report)` |
| `generationStepStatuses` | `ComputedRef` | Landmass step progress UI model |
| `hydrologySubstepStatuses` | `ComputedRef` | Hydrology substep progress UI model |
| `hydrologySubstepTimings` | `ComputedRef` | Timing rows for display |
| `resourceOverlayVisibility` | from overlay | Per-overlay boolean map |
| `overlayDisplaySetting` | from overlay | Display tuning (e.g. arable threshold) |
| `runPhase` | from generation | Exposed for advanced UI (rare) |

Display computeds must stay free of renderer imports — formatting lives in `worldBuilderPageModel.js`.

---

## Returned actions (side-effect methods)

### Lifecycle

| Method | Side effects | #375 test |
|--------|--------------|-----------|
| `start()` | `ensureInitialized`, hydrate overlays, lazy-load viewport factory, create map lifecycle, `onViewportReady → overlay.syncToViewport()`, `regenerate()` | Required |
| `destroy()` | `generation.dispose()`, destroy map lifecycle | Required |

### Generation triggers

| Method | Side effects | #375 test |
|--------|--------------|-----------|
| `regenerate()` | Delegates to `generation.regenerate()` | Covered via toggle/slider/seed |
| `onToggleChange(key, value)` | `setControl` + **immediate regenerate** | Required |
| `onSliderInput(key, value)` | `setControl` only — **no regenerate** | Required |
| `onSliderCommit(key, value)` | `setControl` + regenerate | Required |
| `commitSeed()` | `applySeed` + regenerate | Recommended |
| `randomizeSeed()` | New random seed string, `applySeed`, regenerate | Required |
| `resetDefaults()` | `resetToDefaults`, `overlay.applyPersistedDefaults`, regenerate | Recommended |

### Overlay

| Method | Side effects | #375 test |
|--------|--------------|-----------|
| `toggleResourceOverlayVisibility(id)` | Overlay owner + viewport sync | Via overlay composable or controller |
| `setResourceOverlayDisplaySetting(key, value)` | Display setting + sync | Optional |
| `resetOverlays()` | `overlay.resetVisibility()` only — **no regenerate** | Required |

### Map / validation

| Method | Side effects | #375 test |
|--------|--------------|-----------|
| `focusValidationRow(row)` | Viewport `focusOn(mapFocus)` when present | Optional (no copy asserts) |
| `controlValue(key)` | Read-only settings lookup | Pure — no test required |

---

## Internal wiring (not exported)

| Concern | Implementation |
|---------|----------------|
| Params build | `getDerivedGeographyParams()` — parses seed, returns null on invalid |
| Apply doc to map | `applyWorldDocumentToMap` → `mapLifecycle.applyWorldDocument` |
| Generation hooks | `onBeforeRun` / `onRunCompleteSuccess` → `overlay.resetVisibility()` |
| Generation errors | `onRunError` → `onGenerationError?.(message)` |

---

## Settings store contract

The controller expects `settingsStore` to implement:

```javascript
{
  geographySeed: number | null,
  prevailingWindDegrees: number,
  generationOptions: WorldGenerationOptions,
  ensureInitialized: () => void,
  applySeed: (rawSeed: string | number) => void,
  setControl: (key: string, value: number | boolean) => void,
  resetToDefaults: () => void,
}
```

Overlay store facets are consumed by `useWorldBuilderOverlayState` — see `useWorldBuilderOverlayState.js` for persistence keys (#385).

---

## Display model boundary

These functions live in `worldBuilderPageModel.js` and must remain **presentation-only**:

- `createValidationRowsForDisplay`
- `createStageSummaryForDisplay`
- `createHydrologyStatsForDisplay`
- `createGenerationStepStatuses` (uses `DERIVED_GEOGRAPHY_STEPS`)
- `createHydrologySubstepStatuses` (uses `HYDROLOGY_SUBSTEPS` + skipped set)
- `createHydrologySubstepTimingsForDisplay`
- `parseGeographySeedInput`, `buildDerivedGeographyParams`

The controller wires computeds; it does not format strings for the template.

---

## ADR-0009 compliance checklist

- [ ] SFC imports only Vue, Quasar, controller, and page model symbols
- [ ] No `@world-builder/renderer` import in SFC script
- [ ] No `@world-builder/core` import in SFC script
- [ ] Viewport created only after `start()` resolves factory
- [ ] Generation never imports renderer modules
- [ ] Overlay mutations go through owner → `syncToViewport`

Audit coverage: [#370](https://github.com/enmaku/portfolio-site/issues/370) seam contract tests.

---

## Test strategy (#375)

```javascript
// Pattern: inject fakes, no Vue SFC mount
const controller = useWorldBuilderPageController({
  getMapHost: () => document.createElement('div'),
  settingsStore: fakeSettingsStore(),
  onGenerationError: (msg) => errors.push(msg),
  loadViewportFactory: async () => fakeCreateViewport,
  createMapLifecycle: (opts) => fakeLifecycle(opts),
  runDerivedGeographyInWorker: fakeWorker,
})
```

**Forbidden in controller tests:**

- Asserting button labels or heading copy
- Snapshotting HTML
- `readFileSync` import-ban greps

**Required behaviors:**

1. Toggle change triggers exactly one regeneration
2. Slider input alone does not regenerate; commit does
3. `randomizeSeed` changes stored seed and regenerates
4. `resetOverlays` resets visibility without regeneration
5. `onGenerationError` receives worker/orchestrator messages
6. `start()` calls `overlay.syncToViewport` when viewport ready

Cross-reference: [SEAM-TEST-CATALOG.md](./SEAM-TEST-CATALOG.md) entries for `useWorldBuilderPageController.test.js`.

---

## Related docs

- [SEAM-TEST-CATALOG.md](./SEAM-TEST-CATALOG.md)
- [ARCHITECTURE-SEAMS.md](./ARCHITECTURE-SEAMS.md) — page and composable seam boundaries
- [OVERLAY-LAYER-LOCALITY.md](./OVERLAY-LAYER-LOCALITY.md) — overlay owner wiring
