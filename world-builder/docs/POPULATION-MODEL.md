# Population model — bulk superposition and collapse

Why World Builder does **not** simulate every person, and why **population collapse** (wavefunction-collapse-style) is the intended architecture—not a placeholder for a future agent sim.

Domain glossary: [`../CONTEXT.md`](../CONTEXT.md). Decision record: [ADR 0011](../../docs/adr/0011-world-builder-bulk-population-wavefunction-collapse.md).

---

## Part 1 — The problem

Colonization must track **settlement** survival, tier, and a map-readable sense of where anonymous people live. A continental **landmass** at default resolution is **1024×1024** cells. Even a modest **starting population** of a few hundred people, repeated across many **settlements** and **epochs**, is not a handful of counters—it is a spatial distribution problem on a million-cell grid.

Three naive approaches all fail for different reasons:

| Approach | What goes wrong |
| --- | --- |
| **Simulate every person** | Thousands of agents planting, harvesting, hauling, and eating each **epoch** is DF-scale simulation. v1 aggregates calories and stress through **survival triad** and **population ceiling** at **settlement** scale instead. |
| **Store a full-grid population raster** | A 1024×1024 density field is ~1M cells per snapshot. Persisting it for every **epoch** duplicates information already implied by headcounts, **primary claim**, and arable weights—and balloons session storage (historical epoch snapshots rejected in [ADR 0014](../../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md)). |
| **Settlement pins only** | Pin population totals are correct but invisible rural spread inside a **haul-shed** misleads inspection; the **population overlay** exists because GMs need spatial scatter, not a single urban dot. |

World Builder needs compact authoritative state, **epoch**-scale aggregate survival math, and a believable map overlay—at the same time.

---

## Part 2 — Bulk population (superposition)

**Bulk population** is how almost everyone exists in the sim.

Between collapses the persisted state holds **parameters that govern lives**, not a census:

- **Settlement** headcount and **settlement tier**
- Exclusive **primary claim** cells (nearest pin by **travel time**; recomputed each **epoch**)
- Arable productivity on claimed hinterland
- Distribution rules: **core + hinterland** split, habitable-cell filters, deterministic RNG stream

Think of this as superposition: the sim knows how many people a **settlement** has and where they *may* be, but not which exact cells they occupy until something asks.

**Avoid** when reading or changing code:

- Adding per-cell population to `COLONIZATION_SLICE_KEYS` or session serialization
- Treating `settlements[].population` as the only population state when the **population overlay** is enabled
- Assuming “bulk” means “unimportant”—bulk people drive **survival triad** food accounting and tier thresholds

Implementation seam: [`../core/colonization/createDefaultColonizationSlice.js`](../core/colonization/createDefaultColonizationSlice.js) documents `populationCollapseRaster` as derived and lists persisted slice keys.

---

## Part 3 — Population collapse (observation)

**Population collapse** is the once-per-**epoch** observation step. After **survival triad** adjusts headcounts, collapse turns parameters into a concrete spatial assignment:

1. Split each **settlement**’s integer population into urban **core** (pin cluster) and **hinterland** (claimed food-weighted scatter—arable, with a small floor on shore **fish** cells)
2. Place integer people on legal land only (no water, lakes, rivers, ruins)
3. Use seeded weighted sampling so the same inputs always yield the same raster

The mechanism is **wavefunction-collapse-style constraint satisfaction**: satisfy totals, claims, and weights with a deterministic placement—not a physics sim of individuals walking home each night.

Output: `populationCollapseRaster` (`Float32Array`, `gridWidth × gridHeight`). Fed to the renderer for the **population overlay** ([`../renderer/buildPopulationOverlayRgba.js`](../renderer/buildPopulationOverlayRgba.js)).

**Critical:** the raster is **not** persisted. On session restore it is `null` until the next collapse or lazy recompute. Storing it would be the 1024×1024 problem the architecture avoids.

Implementation: [`../core/colonization/collapsePopulation.js`](../core/colonization/collapsePopulation.js), orchestrated from [`../core/colonization/applyPopulationCollapse.js`](../core/colonization/applyPopulationCollapse.js).

---

## Part 4 — Who is *not* bulk population

Very few individuals are modeled outside **bulk population**. If a feature needs a specific person’s agency or path, use an explicit tracked entity—do not infer them from collapse placement.

| Category | Examples | Reason |
| --- | --- | --- |
| **Notable figure** dynasties | Founding house, **vassal** seat at a **chokepoint**, apex **faction** house | Political succession and loyalty have outsized effects; tracked as houses across **epochs**, not as collapse pixels |
| **Expedition** / explorer movement | Routed party clearing **exploration fog** | Path must follow the routed corridor; regional collapse could place people off-route or break fog semantics |

Everyone else—anonymous farmers, laborers, townsfolk without a dynasty seat—exists only through **bulk population** + annual collapse.

**Notable figure** headcount is **not** subtracted from collapse totals in v1; dynasties are political flavor and roster hooks, not a parallel per-agent census.

---

## Part 5 — Data flow (one **epoch**)

```
survival triad → settlement headcounts (parameters)
       ↓
primary claim recompute (parameters)
       ↓
population collapse → populationCollapseRaster (derived, in-memory)
       ↓
population overlay (renderer heatmap)
```

**Settlement** pins still carry authoritative totals and **settlement tier**. The overlay shows spatial spread; collapse totals must match pin headcounts.

Annual tick order (after network / founding / **roads**): claim recompute → **survival triad** / **population collapse** → politics. See **epoch** in [`../CONTEXT.md`](../CONTEXT.md).

---

## Part 6 — Agent checklist

Before proposing an alternative population architecture, check:

1. **Would it persist a 1024×1024 raster per year?** If yes, reconcile with ADR 0011 or open a new ADR.
2. **Does it simulate per-person grain cycles?** v1 uses **survival triad** aggregates; agent sim is out of scope unless explicitly chartered.
3. **Does it need a known individual at a known cell?** Use **notable figure** or **expedition** tracking—not collapse.
4. **Is “wavefunction collapse” just UI wording?** No—it names collapse-on-observation from compact parameters. Do not surface the phrase in product copy.

---

## Related tests

| File | What it guards |
| --- | --- |
| `core/colonization/collapsePopulation.test.js` | Habitable cells, core/hinterland split, totals, determinism |
| `core/colonization/applyPopulationCollapse.test.js` | Raster attached to slice after apply |
| `core/colonization/createDefaultColonizationSlice.test.js` | Raster omitted from session serialization |
| `renderer/buildPopulationOverlayRgba.test.js` | Overlay paints integer collapse values only |

Indexed in [`SEAM-TEST-CATALOG.md`](./SEAM-TEST-CATALOG.md).
