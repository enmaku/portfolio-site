# World Builder present-day session (no committed tips)

Colonization session persistence originally retained **committed tips**: immutable per-**epoch** snapshots (full **settlement** list, **colonist settings**, **`historyLog` copy, and entire hinterland **`primaryClaim`** cell maps) for an **epoch scrubber** and past-**epoch** **campaign kit** export. Long runs accumulated one tip per **epoch step** boundary plus event-year tips—multi‑megabyte JSON that dominated Pinia/localStorage and IndexedDB colonization cache, slowed epoch finalize persistence, and slowed page refresh (parse + re-serialize on the main thread).

Glossary: [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md) (**history log**, **event feed**, **present day**, **campaign kit**, **session persistence**). Related: [ADR 0011](0011-world-builder-bulk-population-wavefunction-collapse.md) (collapse raster not persisted per epoch).

## Context

On a complex **1024×1024** run, colonization session payloads grew to tens of megabytes because each **committed tip** duplicated ~10k+ `{x,y}` claim cells per **settlement**. **`primaryClaim`** for present day was already stripped from persisted session (recomputed on hydrate); tips were the only persisted copy of historical claim maps.

Shipped code never read tips for simulation, overlays, rehydrate, or UI—the **founding chronicle** and **sim status** use present-day slice fields and **`historyLog`** only. Tips existed for unbuilt increment 3 **epoch scrubber** / export flows.

Performance impact was user-visible: epoch finalize **Session** substep, repeated `serializeColonizationSessionForStorage` passes, and refresh IDB load all scaled with tip count.

## Decision

**Remove `committedTips` from colonization session persistence and stop creating tips at `begin colonization` and `epoch step`.**

- **Present day** (latest simulated **epoch**) is the only authoritative sim and map state.
- **Session survival** persists present-day colonization fields plus structured **`historyLog`** entries (small, event-scoped).
- **Campaign kit** export (increment 3) derives from **present day only**—no past-**epoch** export, no scrubber time-choice prompt.
- **Epoch scrubber** is cut from product scope; increment 3 ships a filterable **event feed** from **`historyLog`** that may focus involved **settlement** pins on the **present-day** map—not historical map rewind.
- **`primaryClaim`** remains in-memory / recomputable on hydrate (unchanged per ADR 0011).

Legacy saves may still contain `committedTips` on disk until the next persist; **`resolveColonizationSlice`** strips unknown tip payloads on load.

## Considered options

- **Keep tips but dedupe claim maps or defer Pinia write:** reduces duplicate work but session still grows ~linearly with **epochs**; refresh still parses fat blobs until rewritten.
- **Persist tips without claim maps:** smaller but still duplicates **settlement** graphs and settings per year; scrubber could not show historical hinterland anyway.
- **Recompute past snapshots from `historyLog` on demand:** cannot recover past **roads**, **factions**, or claim geometry without replaying **epochs** from **epoch** 0.
- **Epoch scrubber with on-demand replay:** correct but expensive and out of v1 scope; deferred indefinitely.

## Consequences

- Update [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md), epic #390, increment 3 #394; cross-reference ADR 0011 and [`POPULATION-MODEL.md`](../../world-builder/docs/POPULATION-MODEL.md).
- Delete `createCommittedTip` and tip retention in commit/epoch step; remove `retainTip` event fields used only for tips.
- **`COLONIZATION_SLICE_KEYS`** no longer includes `committedTips`.
- Increment 3 **campaign kit builder** reads present-day slice, not a tip index.
- Tests assert **`historyLog`** retention and present-day round-trip—not tip sets.
- If historical map investigation returns later, it needs a new storage strategy (sparse event snapshots or epoch replay)—not a restoration of full tip arrays.
