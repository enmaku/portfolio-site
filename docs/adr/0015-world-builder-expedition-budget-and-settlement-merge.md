# World Builder expedition budget and settlement merge

Increment 2 colonization originally dispatched one **expedition** per idle living **settlement** each **epoch** (implementation never wired stochastic constants). Large runs produced dozens of living **settlements** and wasted CPU on interior sites that could not reach unvisited territory. Separately, early designs considered **settlement merge** paths to thin failed or marginal daughter sites; those logistics merge paths were later removed (see Amendment below).

Glossary: [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md) (**Realm expedition budget**, **Frontier-eligible settlement**, **Port settlement**, **Inland sail settlement**, **Settlement merge**, **Administrative federation**). Partially supersedes dispatch/maritime sections of [ADR 0012](0012-world-builder-bearing-based-expedition-routing.md) and sail corridor presentation rules in [ADR 0013](0013-world-builder-founding-route-corridor-computation.md). **Administrative federation** remains the sole **settlement merge** mechanic and is increment 3 ([#394](https://github.com/enmaku/portfolio-site/issues/394)).

## Decision

### Realm expedition budget

- Field a fixed number of **expedition** slots per **epoch** from a **realm expedition budget**, not one attempt per **settlement**.
- **Independent pools:** **land expedition** and **maritime expedition** capacities do not steal from each other.
- **Scaling:** each pool ∝ √population × √frontier boundary length (visited↔unvisited edge cell count on dry land or **Sail overlay**).
- **Allocation:** among **frontier-eligible** idle senders, **seeded weighted lottery** by sender population when slots are scarce.
- **Land-frontier-eligible:** living settlement on dry land while realm overland frontier edges remain (`landFrontierEdges > 0`); no per-sender haul-shed reach oracle at dispatch.
- **Maritime-frontier-eligible:** settlement with maritime role while sail frontier edges remain (`maritimeFrontierEdges > 0`); no per-sender sail reach oracle at dispatch.
- **`frontierExhausted` taper:** multiply **land expedition** pool by ~**0.15** when all scored **logistics nodes** are founded or rejected; **maritime expedition** pool ignores logistics-node exhaustion and follows sail-frontier edges only.

### Expedition modes and senders

Replace the single **sail expedition** + coastal 60/40 land/sail coin flip with three fixed modes at dispatch:

| Mode | Senders | Range default | Step rules |
| --- | --- | --- | --- |
| **Land expedition** | Land-frontier-eligible inland sites | **2×** **three-day haul distance** | Unchanged from ADR 0012 land rules |
| **Inland sail expedition** | **Inland sail settlement** (and **port settlements** on sheltered legs) | **3×** | **Sail overlay** only; shore within **6 cells** (ADR 0012) |
| **Open-sea expedition** | **Port settlement** only | **8×** | **Sail overlay** only; **may cross open ocean** (no shore cap) |

**Colonist settings** (locked at **begin colonization**): **land expedition range**, **inland sail expedition range**, **open-sea expedition range** (sliders per glossary).

**Port settlements** always receive at least one **maritime expedition** slot per **epoch** when unvisited sail frontier exists—the maritime pool floor equals the count of living **port settlements** (while `maritimeFrontierEdges > 0`).

### Routes overlay presentation

Persisted **route segment** geometry remains mode-specific A→B corridors at founding (ADR 0013 land and sheltered-water rules). **Routes overlay** presentation differs by mode:

- **Land route:** terrain-following
- **Inland sail route:** shore-/river-hugging
- **Open-sea route:** long sweeping curves between ports (display spline; authoritative cells may remain grid-based for sim)

### Settlement merge

**Retracted for increment 2** (see Amendment). Cluster density is controlled by founding spacing and the **realm expedition budget**. The only remaining **settlement merge** path is **administrative federation** in increment 3 ([#394](https://github.com/enmaku/portfolio-site/issues/394)).

## Considered options

- **Per-settlement dispatch with interior skip:** fixes CPU waste but slot count still tracks **settlement** count (~79 rolls).
- **Unified land/maritime pool:** simpler; starves **open-sea expedition** once inland frontier thickens.
- **Single sail mode with higher range slider:** cannot model open-ocean founding without dropping ADR 0012 shore rule.
- **Increment 2 logistics merge (outpost reabsorption / living-sphere consolidation):** implemented then removed—cluster control already covered by budget + founding spacing; political amalgamation belongs in #394.
- **Glossary-only (no ADR):** insufficient for partial reversal of accepted routing ADRs.

## Consequences

- Wire `EXPEDITION_DISPATCH_BASE_PROBABILITY` only if stochastic slot fill is added later; primary gate is budget + eligibility.
- Implement frontier edge counting and pool computation each network phase.
- Split expedition mode in schema (`land` | `inland_sail` | `open_sea`); migrate `sailExpeditionRange` → inland + open-sea settings.
- Amend expedition step, dispatch, and route renderer for three modes; open-sea route overlay splines.
- Do **not** ship an increment-2 **settlement merge** epoch phase; **administrative federation** is owned by [#394](https://github.com/enmaku/portfolio-site/issues/394).
- Update ADR 0012/0013 cross-links; refresh increment 2 flagged ambiguities in **CONTEXT.md**.

## Amendment (2026)

Dispatch **frontier-eligible** gating no longer runs per-sender isochrone or sail BFS to prove an unvisited cell is reachable. Eligibility uses realm frontier edge counts plus cheap sender checks (dry-land pin; maritime role). Whether a dispatched party finds new territory is resolved during **advance** (`blocked`, **survey complete**, range cap)—consistent with ADR 0012 random bearing and no destination oracle at dispatch.

## Amendment (2026-07-10) — retract increment-2 settlement merge

The increment-2 **settlement merge** decision (outpost reabsorption + living-sphere consolidation as an epoch phase after survival and before **ruin**) is **retracted**. Those paths have been removed from the codebase.

**Reasons:** founding spacing and the **realm expedition budget** already prevent huge overlapping settlement clusters; the logistics merge phase caused small sim issues and duplicated work that belongs under political/infrastructure amalgamation.

**Going forward:** the only **settlement merge** mechanic is **administrative federation** (social / logistics / politics amalgamation of town-tier+ cores) under [#394](https://github.com/enmaku/portfolio-site/issues/394). Annual epoch order has no merge phase until that ships.
