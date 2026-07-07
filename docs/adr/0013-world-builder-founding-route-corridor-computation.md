# World Builder founding route corridor computation

**Status:** Partially superseded by [ADR 0015](0015-world-builder-expedition-budget-and-settlement-merge.md) (**open-sea route** overlay presentation; three **route segment** modes). A→B corridor computation for land and sheltered sail remains below.

Colonization increment 2 **expeditions** advance by bearing-based local steps (see [ADR 0012](0012-world-builder-bearing-based-expedition-routing.md)). The marched path records where the party traveled and drives in-trek **exploration fog** clearing—it is not the geometry persisted as a founding **route segment**.

Glossary: [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md) (**Route segment**, **land route**, **sail route**, **Routes overlay**, **exploration fog**).

## Decision

When a founding **expedition** succeeds, persist a **built corridor** between the parent and daughter **settlement** pins computed by one-shot A→B least-cost pathfinding on the full terrain. The corridor may leave the surveyed area the trek actually walked; post-founding route engineering is not simulated as additional **expedition** trips.

### Land founding corridors

- **Passability:** dry land only (not ocean, **lakeMask**, or **riverCorridorMask**).
- **Cost model:** 8-connected A* with **movement cost**, **squared uphill penalty** (steep slopes hard-blocked above a wheeled-traffic threshold), **turn penalties** for oxcart-friendly corners, **valley bias** (local elevation minima), and discount on existing **land route** cells.
- **Post-process:** colinear grid-point collapse; no vector smoothing at 1-cell raster width.

### Sail founding corridors

- Weighted A* on the **Sail overlay** with shore-distance constraint (same 6-cell dry-land proximity as **sail expedition** steps) and mild penalty for cells farther from shore.

### Exploration fog

- Mark the route corridor (path cells plus immediate neighbors) visited at founding time.
- **Session rehydrate** rebuilds fog from settlements, **expedition** routes, and persisted **route segment** corridors.

## Considered options

- **Persist marched expedition cells (status quo before this ADR):** Rejected—bearing marches look like straight chords at map scale and do not reflect terrain-following road engineering.
- **Render-only computed path:** Rejected—**land route** movement bonuses and **Routes overlay** would desync from gameplay geometry.
- **Simulate post-founding survey treks:** Rejected—unnecessary epoch cost; founding already implies follow-up engineering off-screen.
- **One-shot A→B corridor at founding (accepted):** Cheap (one search per founding event), plausible (Galin-style least-cost paths), allows paths through fog the trek never entered.

## References (tuning rationale)

- Galin et al. 2010 — weighted anisotropic shortest paths with slope and curvature costs for procedural roads.
- Game Developer (terrain pathfinding) — square steepness penalties for natural tortuous paths.
- Archaeological LCP / Tobler hiking function — valley preference and slope limits for historical plausibility (not full Tobler implementation in v1).

## Consequences

- [`foundDaughterSettlement.js`](../../world-builder/core/colonization/expeditions/foundDaughterSettlement.js) calls `computeFoundingRouteCorridor` instead of copying **expedition** route cells.
- [`rebuildVisitRasterFromSession.js`](../../world-builder/core/colonization/visitStatus/rebuildVisitRasterFromSession.js) marks corridors from persisted **roads**.
- ADR 0012 persistence bullet updated to defer segment geometry to this ADR.
