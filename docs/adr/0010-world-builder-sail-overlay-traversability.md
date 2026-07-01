# World Builder sail overlay as traversability source of truth

Hydrology validation and generation reports previously used **simulation hydrology**—`riverGraph` edges built from the settled centerline before **meander refine** (#358, #365). **Meander refine** and corridor attraction were meant to improve connected, boat-viable river networks on the map, but presentation-only bridges did not move navigability checks. That split made the map lie: connected pink/blue water on screen while validation still read a disconnected simulation graph.

Glossary: [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md) (**Sail overlay**, **Sailable water**, **Coastal river access**, **Coast-to-interior sailing path**).

## Decision

**Traversable water for sailing follows the final map**, not pre-refine simulation graph edges.

### Sail overlay

- Bright-pink toggle overlay (**Sail**) derived on demand—not stored on the **world document**.
- Input: final display water union (ocean below sea level + `lakeMask` + painted `riverCorridorMask` after refine/paint).
- Pipeline: blur (closes inter-waterway gaps + yields a usable waterfront sliver) → high-pass → binary/set mask.
- Fixed blur/threshold constants in v1; same function for renderer and validation.
- **Connectivity:** two points are sail-connected iff an **8-connected** path through set pixels never crosses unset pixels.

### Validation and report

- Sailing checks read **Sail overlay** connectivity, not `riverGraph` navigable edges.
- User-facing labels (stable internal `enforce*` keys):
  - **Sailable water** — largest connected overlay component ≥ threshold (guards trivial puddles).
  - **Coastal river access** — at least one overlay connection between ocean and inland river/lake water (replaces graph mouth counts).
  - **Coast-to-interior sailing path** — qualifying inland reach from coast through the overlay (replaces coast-connected navigable path on the graph).
- Generation report hydrology stats show sail metrics; legacy graph-edge counts (navigable edges, mouth count, navigable km from centerline graph) drop from the default user-facing report.

### Simulation hydrology role

Settled centerline, flow solves, and pre-refine graphs remain for drainage physics and tuning—they are **not** the authority for whether boats can sail what the map shows. **Meander refine** bridges must affect **Sail overlay** because they affect painted corridors.

Upstream/downstream sailing cost is deferred; future work may use elevation incline along flow direction.

## Considered options

- **Simulation-first validation (status quo, #358/#365):** physics-faithful; prevents presentation from inflating logistics metrics. Rejected: contradicts product intent for meander refine and map-visible connectivity.
- **Rebuild `riverGraph` from presentation masks:** keeps edge-shaped metrics. Rejected: centerline graph model does not match blurred sailing regions and waterfront slivers.
- **Persist `sailTraversibilityMask` on the world document:** simpler reads. Rejected: duplicate source of truth; derive-from-inputs stays deterministic and drift-free.

## Consequences

- Seam docs and tests that assert presentation toggles leave validation invariant (#365, #386) must be revised for **Sail overlay** checks.
- `#358` byte-invariance of `simulationRiverMask` can remain for simulation export; it no longer defines sailing validation.
- Implementations must compute **Sail overlay** after hydrology paint (or from exported masks) before validation runs.
