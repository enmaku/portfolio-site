# World Builder expedition budget and settlement merge

Increment 2 colonization originally dispatched one **expedition** per idle living **settlement** each **epoch** (implementation never wired stochastic constants). Large runs produced dozens of living **settlements** and wasted CPU on interior sites that could not reach unvisited territory. Separately, there was no **settlement merge**—only **ruin** at population zero—so daughter outposts accumulated without historical consolidation paths.

Glossary: [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md) (**Realm expedition budget**, **Frontier-eligible settlement**, **Port settlement**, **Inland sail settlement**, **Settlement merge**, **Administrative federation**). Partially supersedes dispatch/maritime sections of [ADR 0012](0012-world-builder-bearing-based-expedition-routing.md) and sail corridor presentation rules in [ADR 0013](0013-world-builder-founding-route-corridor-computation.md). **Administrative federation** merge remains increment 3 ([#394](https://github.com/enmaku/portfolio-site/issues/394)).

## Decision

### Realm expedition budget

- Field a fixed number of **expedition** slots per **epoch** from a **realm expedition budget**, not one attempt per **settlement**.
- **Independent pools:** **land expedition** and **maritime expedition** capacities do not steal from each other.
- **Scaling:** each pool ∝ √population × √frontier boundary length (visited↔unvisited edge cell count on dry land or **Sail overlay**).
- **Allocation:** among **frontier-eligible** idle senders, **seeded weighted lottery** by sender population when slots are scarce.
- **Land-frontier-eligible:** unvisited dry-land cell within sender **haul-shed** isochrone.
- **Maritime-frontier-eligible:** unvisited **Sail overlay** cell within sender maritime reach.
- **`frontierExhausted` taper:** multiply **land expedition** pool by ~**0.15** when all scored **logistics nodes** are founded or rejected; **maritime expedition** pool ignores logistics-node exhaustion and follows sail-frontier edges only.

### Expedition modes and senders

Replace the single **sail expedition** + coastal 60/40 land/sail coin flip with three fixed modes at dispatch:

| Mode | Senders | Range default | Step rules |
| --- | --- | --- | --- |
| **Land expedition** | Land-frontier-eligible inland sites | **2×** **three-day haul distance** | Unchanged from ADR 0012 land rules |
| **Inland sail expedition** | **Inland sail settlement** (and **port settlements** on sheltered legs) | **3×** | **Sail overlay** only; shore within **6 cells** (ADR 0012) |
| **Open-sea expedition** | **Port settlement** only | **8×** | **Sail overlay** only; **may cross open ocean** (no shore cap) |

**Colonist settings** (locked at **begin colonization**): **land expedition range**, **inland sail expedition range**, **open-sea expedition range** (sliders per glossary).

**Port settlements** always receive at least one **maritime expedition** slot per **epoch** when unvisited sail frontier exists—the maritime pool floor equals the count of maritime-frontier-eligible **port settlements**.

### Routes overlay presentation

Persisted **route segment** geometry remains mode-specific A→B corridors at founding (ADR 0013 land and sheltered-water rules). **Routes overlay** presentation differs by mode:

- **Land route:** terrain-following
- **Inland sail route:** shore-/river-hugging
- **Open-sea route:** long sweeping curves between ports (display spline; authoritative cells may remain grid-based for sim)

### Settlement merge (increment 2)

New **epoch** phase after **survival triad**, before **ruin**: **settlement merge**.

Two paths—no **road** or **route segment** requirement:

1. **Outpost reabsorption** — daughter with `originSettlementId`, outpost tier or below, population ≤ ~2× founding outpost headcount, **5 consecutive epochs** stagnation; origin always survives.
2. **Living-sphere consolidation** — pins within one **three-day haul distance** **travel time**; smaller negative food surplus vs larger positive surplus for **3 consecutive epochs**; survivor = higher **settlement tier** (population tie-break); pair pick = highest surplus, then shortest **travel time**, then tier.

**Founding landing** is merge-immune as the absorbed pin. At most one absorption per pin per **epoch**; no chain merges same **epoch**; **outpost reabsorption** wins when both paths qualify. Transfer all population then clamp survivor to **population ceiling**; cancel absorbed pin's active **expeditions**; legacy **absorbed** dynasty roster entry; **history log** `settlement_merged` row.

**Administrative federation** (town-tier+ cores in one **logistics connectivity component**) is deferred to increment 3 ([#394](https://github.com/enmaku/portfolio-site/issues/394)).

## Considered options

- **Per-settlement dispatch with interior skip:** fixes CPU waste but slot count still tracks **settlement** count (~79 rolls).
- **Unified land/maritime pool:** simpler; starves **open-sea expedition** once inland frontier thickens.
- **Single sail mode with higher range slider:** cannot model open-ocean founding without dropping ADR 0012 shore rule.
- **Merge requires **road** connectivity:** historically plausible but heavy to evaluate; dropped for increment 2 simplicity.
- **Glossary-only (no ADR):** insufficient for partial reversal of accepted routing ADRs.

## Consequences

- Wire `EXPEDITION_DISPATCH_BASE_PROBABILITY` only if stochastic slot fill is added later; primary gate is budget + eligibility.
- Implement frontier edge counting and pool computation each network phase.
- Split expedition mode in schema (`land` | `inland_sail` | `open_sea`); migrate `sailExpeditionRange` → inland + open-sea settings.
- Amend expedition step, dispatch, and route renderer for three modes; open-sea route overlay splines.
- Add `applySettlementMerge` phase; extend **history log** and **founding chronicle** with merge rows.
- Update ADR 0012/0013 cross-links; refresh increment 2 flagged ambiguities in **CONTEXT.md**.
