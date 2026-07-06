# World Builder bearing-based expedition routing

Colonization increment 2 **expeditions** advance **exploration fog**, survey **logistics nodes**, and may found daughter **settlements**. Early implementations picked a stochastic target cell in unscouted territory and pathfound toward it—first with global least-resistance / A* search, later with a greedy step-toward-target fallback when pathfinding proved too slow. Both approaches produced unrealistic behavior (routing through undiscovered terrain as if the party already knew the map; greedy paths cutting through lakes and rivers) and poor performance (grid-wide search per dispatch on a **1024×1024** landmass).

Glossary: [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md) (**Expedition**, **land expedition**, **sail expedition**, **land route**, **sail route**, **Routes overlay**, **Colonist settings**).

## Decision

**Expeditions do not pathfind toward a pre-selected destination.** At dispatch the sim fixes **mode** (**land expedition** or **sail expedition**), rolls a **random bearing**, and each **epoch** spends a travel-time budget on **local terrain-following steps** along that bearing until the trek ends.

### Mode and bearing at dispatch

- **Inland settlements** (pin not on **Sail overlay**): **land expedition** only.
- **Sail-reachable settlements**: ~**60% sail expedition** / **40% land expedition**, then independent random bearing.
- If a coastal **land expedition** has no legal first step, skip dispatch that epoch (no auto-conversion to sail).
- Bearing is **fixed for the trek**; terrain curves the path without mid-trek re-rolls.

### Local step rules

- **Land expedition**: **dry land** only (not ocean, **lakeMask**, or **riverCorridorMask**). Among legal neighbors, prefer bearing alignment, then lowest travel cost (valleys and existing **land route** cells over steep climbs), then unvisited cells.
- **Sail expedition**: **Sail overlay** only; **3×** land travel-time budget per epoch; each step prefers bearing alignment while staying within **6 cells** of dry land (no open-ocean shortcuts in increment 2).

### Termination and persistence

A trek ends on: **founding** at a viable **logistics node**, **blocked** (no legal terrain-following step), **range cap** (**land expedition range** / **sail expedition range** multipliers in **colonist settings**, locked at **begin colonization**), or **survey complete** (legal steps exist but all enter visited cells).

Successful founding persists a **route segment** (**land route** or **sail route**) computed as a terrain-following A→B corridor between parent and daughter **settlements**—not the marched **expedition** trace (see [ADR 0013](0013-world-builder-founding-route-corridor-computation.md)). The **Routes overlay** shows founding segments only (gray cobblestone land, cyan/teal sail)—not failed or completed-without-founding treks (**exploration fog** covers visit status). **Sail expedition** founding is limited to **Sail overlay**-reachable **logistics nodes**.

## Considered options

- **Target + global pathfinding (status quo in glossary, early code):** deterministic march to a picked cell; terrain-hugging A* on **movement cost**. Rejected: pathfinding through undiscovered map is unrealistic; full-grid A* per dispatch was too expensive on large grids; fallback greedy routing crossed impassable water.
- **Target + bounded A*, skip on failure:** keep destination-driven expansion with visit-budget caps. Rejected: still assumes knowledge of unseen terrain topology; does not match exploration fantasy; perf risk remains on worst-case targets.
- **Mixed land/sail treks with portage:** lowest travel time chooses mode per leg; overland portion persists as **land route**. Rejected for increment 2—deferred until dock-and-march inland is modeled; pure modes keep rules legible.
- **Bearing + terrain-following (accepted):** local steps only; no global search. Accepted: matches exploration fantasy, avoids water-crossing artifacts, stays cheap per **epoch step**, pairs naturally with separate **land expedition** / **sail expedition** semantics.

## Consequences

- Remove destination-based APIs (`pickExplorationTarget` bearing-to-cell as route goal, precomputed full routes, `buildSimpleExplorationRoute`-style greedy walks) from the expedition dispatch path.
- Reuse **Sail overlay** derivation and **movement cost** / **land route** masks for **local** legality and step ranking—not for A* to a distant index.
- **Colonist settings** gain **land expedition range** and **sail expedition range** sliders (defaults **2×** / **3×** **three-day haul distance**); UI overlay id renames from `roads` to **routes overlay** with mode-colored segments.
- Expansion becomes less destination-predictable: founding depends on what the march encounters, not whether a target cell was viable.
- Increment 3 **trade route** candidate graphs still consume persisted **land route** / **sail route** segments; commodity activation remains a separate layer.
