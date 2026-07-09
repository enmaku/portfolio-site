# World Builder bulk population via wavefunction collapse

World Builder colonization must answer where people live, how many there are, and whether **settlements** survive—without simulating every farmer, hauler, and child on a continental **landmass**. Agents repeatedly propose full agent models, persistent per-cell population rasters, or treating **settlement** pin headcounts as sufficient. Those approaches miss why the product uses **bulk population** held in superposition and **population collapse** on observation.

Glossary: [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md) (**bulk population**, **population collapse**, **population overlay**, **notable figure**, **settlement**). Design notes: [`world-builder/docs/POPULATION-MODEL.md`](../../world-builder/docs/POPULATION-MODEL.md).

## Context

A default **world document** grid is **1024×1024** (`DEFAULT_GRID_SIZE`). The vast majority of people are anonymous background population—not **notable figure** dynasties, **expedition** parties, or political actors whose individual choices reshape **factions**.

Modeling everyone explicitly is unwieldy in three ways:

1. **Storage** — A per-cell population state for the full grid is a **1024×1024** raster (~1M cells). Persisting that raster every **epoch** for historical epoch snapshots multiplies session size and sync cost for data that is almost entirely redundant with **settlement** headcounts, hinterland **primary claim**, and arable weights (see [ADR 0014](0014-world-builder-present-day-session-no-committed-tips.md)).
2. **Simulation** — Running thousands of agents who plant, harvest, haul, and eat grain each in-world year is Dwarf Fortress depth, not v1 World Builder scope. **Survival triad** and **population ceiling** already aggregate food, freshwater, and shelter at **settlement** scale.
3. **Presentation** — The **population overlay** needs a believable spatial scatter (urban cluster + arable hinterland), not a census table. Pin dots alone misread rural spread inside a **haul-shed**.

The product needs “where are people this year?” on demand, deterministically, without keeping every person simulated between **epochs**.

## Decision

### Bulk population in superposition

**Bulk population** is the default model for almost everyone. Between collapses the sim stores **parameters**, not per-cell headcounts:

- Per-**settlement** total population and **settlement tier**
- Exclusive hinterland **primary claim** (nearest pin by **travel time**)
- Arable productivity weights on claimed land
- Distribution constraints (**core + hinterland** fraction, habitable-cell rules)

Those parameters govern how people would distribute if observed. They are the wavefunction; no per-person or per-cell census lives in persisted colonization state.

### Collapse on observation

Once per **epoch**, after **survival triad** updates headcounts, **population collapse** resolves parameters into a concrete spatial distribution:

- Seeded, weighted placement of **integer** people onto legal claimed land (urban cluster at the pin + arable-weighted hinterland sample)
- Inspired by wavefunction-collapse-style constraint satisfaction—not a generic render pass and not a reachability tint
- Deterministic from **geography seed** + **colonist settings** + **founding landing** + sim state

The output is `populationCollapseRaster` (`Float32Array`, length `gridWidth × gridHeight`) for the **population overlay**. It is **derived in memory** and **never persisted** in colonization session storage; it can be recomputed from stored parameters whenever the map needs it.

“Wavefunction collapse” describes the architecture for agents and implementers. It is **not** product UI copy.

### Outside the bulk model

Very few people are **not** held as **bulk population**:

| Role | Why individual tracking |
| --- | --- |
| **Notable figure** dynasties (lords, **vassal** seats, apex houses) | Individual political choices and succession have outsized effects on **factions**, **rivalry**, and **conditional loyalty** |
| **Expedition** parties / explorers | Specific routed movement through **exploration fog** must not be approximated by a regional collapse that could place people off-path or teleport intent |

Everyone else—farmers, laborers, anonymous townsfolk—lives only through **bulk population** parameters and the annual collapse.

## Considered options

- **Full agent simulation (Dwarf Fortress–style):** richest causality; explains every belly and granary. Rejected for v1: cost, scope, and mismatch with **epoch**-scale **history log** delivery.
- **Persist `populationCollapseRaster` every epoch / historical snapshot:** simple reads for past-year overlay. Rejected: ~4 MB per float raster per snapshot on a 1024² grid, mostly redundant with recomputable inputs; bloats IndexedDB / Tauri session files (historical snapshots cut in [ADR 0014](0014-world-builder-present-day-session-no-committed-tips.md)).
- **Settlement pins only (no overlay):** minimal state. Rejected: misrepresents rural population spread inside **haul-shed**; breaks GM-facing “where do people actually live?” inspection.
- **Continuous per-cell density field updated every tick:** still a full-grid raster in authoritative state. Rejected: same storage and simulation problems as persisting collapse output; collapse-on-observation keeps one canonical raster per **epoch** derived from compact parameters.

## Consequences

- Implementations must treat **bulk population** as parameter-driven superposition; do not add per-cell census to persisted `COLONIZATION_SLICE_KEYS` without a new ADR.
- `populationCollapseRaster` stays in `COLONIZATION_DERIVED_WORLD_DOCUMENT_KEYS`; session restore recomputes or lazily collapses when the overlay is shown.
- New features that need a specific person’s location (e.g. named **expedition** lead) must use explicit tracked entities—not **population collapse** placement.
- **Notable figure** mechanics remain outside collapse totals; dynasty seats are flavor and political hooks, not a second census.
- Tests and agents should read this ADR before replacing collapse with agent sim, dropping the overlay, or persisting the raster for convenience.
