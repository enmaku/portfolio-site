# World Builder

Desktop app for procedural fantasy **worlds**: plausible **landmasses**, **settlements** and **trade networks** driven by logistics, and **histories** that produce **factions** and **rivalries** with traceable causes.

Epic: [#293](https://github.com/enmaku/portfolio-site/issues/293) (overall); colonization phase: [#390](https://github.com/enmaku/portfolio-site/issues/390). Research index: [`research/README.md`](./research/README.md) (Worldbuilding Insights playlist; [Dwarf Fortress terrain notes](./research/dwarf-fortress-terrain-notes.md)).

## Language

### World Builder

Working title for the desktop app in this repo (`world-builder/`). Distinct from portfolio **projects** (Game Timer, Movie Vote, …).

_Avoid_: “Worldbuilder” as a generic verb when naming the product; “map generator” alone (maps are an output, not the whole system).

### World

One generated playable setting: **landmass**, **climate**, **resource** layout, **cultures**, **settlements**, **trade networks**, **political** structure, and **history log**, tied to a **seed**.

_Avoid_: “Setting” alone in export/schema keys; “planet” unless generation is explicitly planetary.

### Landmass

Continental-scale geography output: elevation, coastlines, hydrology, **biomes**, and derived movement-cost fields—not political borders. Produced by the **landmass pipeline** (scalar **fields** → derived geography → **logistics pass** → **rejection sampling**).

_Avoid_: “Map” alone when meaning the full **world** document; “terrain texture” for the political/economic layer; painting biomes or borders before underlying **fields** exist.

### Physical terrain baseline

Minimum **landmass** before **logistics pass**, **rejection sampling**, or **history log**: all continental **scalar fields** plus **biome** labels derived from field overlap (**fields before labels**). Erosion, river graph, lakes, **named regions**, and resource nodes are later **derived geography**—not required for the baseline.

_Avoid_: Treating biome tint alone as “done” **landmass** when **scalar fields** were skipped or painted; calling the baseline the full **landmass pipeline**.

### Closed island rim

**Landmass** layout where map edges are forced to ocean so generated land reads as one surrounded continent (or archipelago) rather than an arbitrary rectangle clip. Distinct from cylindrical wrap or land bleeding off the viewport edge.

_Avoid_: “Island generator” as the whole product; conflating with **maritime reach** economics.

### Landmass pipeline

Ordered generation stages for one **landmass** during **terrain authoring**: **scalar fields**, derived geography (biomes, hydrology), **logistics pass**, **rejection sampling**. Produces geography the **colonization phase** reads; no people, **settlements**, or **factions** until the user **Colonize**s. Same high-level physical-world-first split as Dwarf Fortress world creation (see research notes).

_Avoid_: “Worldgen” as a single opaque step; skipping **validation checks** and accepting incoherent geography; auto-placing **settlements** when terrain generation finishes.

### Terrain authoring

First product phase: generate and tune a **landmass** until the user is satisfied—regenerate, tweak parameters, inspect overlays (**Freshwater availability overlay**, resource rasters, **Sail overlay**, …), review **validation checks** (pass or fail). Ends when the user clicks **Colonize**; the user may return from **colonization setup** to edit geography again until **begin colonization**—returning discards in-progress colonization state (no draft resume).

_Avoid_: “Map editing phase” when **scalar fields** and pipeline stages are meant; conflating with **colonization phase** simulation; persisting partial setup across a return to terrain.

### Colonization phase

Second product phase: user completes **colonization setup**, then **begin colonization** runs annual **epoch** ticks. Delivered in three product increments—**single-colony survival**, then **exploration and new settlements**, then **economy, politics, and history** together. Hands-off simulation after initial conditions: user sets geography and **colonist settings**, then the sim advances with minimal intervention—observe and **epoch step** (or later **epoch batch** controls); no mid-run outcome edits in v1. No fixed or terminal run endpoint—the user keeps stepping **epochs** as long as they like; “present day” for **campaign kit** export is a subjective call, not a sim state change. In `running` phase: left panel keeps **colonist settings** (read-only except **epoch batch** mid-run); right panel shows **validation advisory** at **epoch** 0 only, then increment 2+ **sim status** ( **epoch**, **settlement** count, active **expeditions**, frontier exhaustion) plus a minimal **founding chronicle** listing **history log** entries—a filterable **event feed** (increment 3) supersedes the chronicle for milestone investigation at **present day**. **Reset colonization** lives in persistent chrome, not the left panel. Terrain generation controls stay fully hidden; map overlay toggles remain for reading geography.

_Avoid_: “History sim” alone when founding, expansion, and present-day structure are all meant; restarting terrain pipeline silently mid-colonization; requiring user unlock for core **faction** / **trade route** behavior once thresholds fire; swapping the full panel layout again at increment 1; hiding read-only resource overlays during the run; auto-stop or terminal freeze on **equilibrium state**, **political equilibrium**, or **stop colonization** (scrubbed).

### Single-colony survival

First colonization increment: one **founding landing**, one growing **settlement**—no exploration, no additional **settlements**. Simulation tracks a **survival triad** within the founding **haul-shed** (**three-day haul distance** **travel time** budget from the pin): food ( **arable envelope** ), freshwater, and a fuel/shelter proxy from local biomes inside that zone—**salt**, metals, and inter-**settlement** trade deferred until increment 1 is proven (**strategic resource** preservation layer added before increment 1 is considered complete). **Population collapse** distributes bulk population across cells in the same **haul-shed**; **settlement tier** stays a single node at the pin. Territorial expansion is settlement size only, not map claim. No sim-detected endpoint—the user keeps stepping **epochs** indefinitely.

_Avoid_: “Phase 1 worldgen”; conflating with **terrain authoring**; multi-**settlement** maps in the first colonization test slice; full **resource profile** accounting before the survival triad works; **equilibrium state** as a completion gate (scrubbed).

### Epoch batch

Number of in-world years each **epoch step** advances—stored in **colonist settings**, editable mid-run. Default 50 (author-adjustable 1–100). Internal tick semantics stay annual—batching applies N sequential **epoch** ticks per control action.

_Avoid_: “Speed slider” that changes tick semantics; sub-year **epochs** unless explicitly modeled; **year cap** disguised as batch size.

### Exploration and new settlements

Second colonization increment: **exploration fog** overlay clears along **expedition** paths; additional **settlements** founded automatically when an **expedition** reaches a cell that is both a scored **logistics node** and locally viable under **survival triad** rules (freshwater hard gate + non-trivial arable on the site’s **provisional claim**—claims recomputed as if the new pin already exists). Paths may clear fog without founding if nodes fail viability. **Expedition** dispatch uses a **realm expedition budget** each **epoch**—not one automatic roll per **settlement**. New **settlement** pins must lie at least **one day’s haul** (**one-third** of **three-day haul distance** travel time) from every living **settlement** pin and must differ in cell coordinates; geometric **haul-shed** isochrones may still overlap beyond that minimum (a logistics link until increment 3 **supply-chain independence**), but **survival triad** and **population collapse** use exclusive nearest-pin cell claims—no shared calories. No hard cap on **settlement** count—founding stays automatic for every viable unscouted node—but dispatch capacity tapers as frontiers shrink and **logistics nodes** are founded or exhausted. Still before full **trade route**, **faction**, and **history log** interdependence.

_Avoid_: “Expansion pack” naming; treating as optional when it is the planned second test gate; **city-state** independence before increment 3; requiring user confirmation per new **settlement** in hands-off mode; founding at high-scored nodes that fail freshwater or food viability; rejecting founding solely because **haul-shed** regions overlap another **settlement**; arbitrary maximum **settlement** count; auto-stop or terminal phase when the frontier is exhausted—**epoch step** and existing **settlement** growth continue; tying dispatch attempt count directly to living **settlement** count.

### Colonize

User action that ends **terrain authoring** and opens **colonization setup**: place the **founding landing**, configure **colonist settings**, then **begin colonization** to start the clock. Available once a **landmass** exists to work with—not gated on **validation checks** passing. **Validation advisory** surfaces errors and warnings first; the user may proceed anyway. Colonization reads whatever geography layers exist and fills gaps with documented heuristics for the entire run—full **logistics pass** is not a hard gate at entry or later. Odd or crude politics on a warned map are on the author.

_Avoid_: “Generate world” when only people-layer simulation is starting; blocking **Colonize** until every check is green; hiding failed checks when the user opts in; silent failure when a layer is missing instead of heuristic fallback; a second completeness gate once `running` or at increment 3 latch.

### Colonization setup

Interactive step between **Colonize** and **begin colonization**: user places the **founding landing**, edits **colonist settings** (logistics and founding-wave parameters), and reviews geography. Map time is frozen; no **settlements** or **epoch** ticks yet. **Terrain authoring** controls are fully hidden—not merely disabled; the left and right chrome panels show **colonist settings** and **validation advisory** (warnings/errors) respectively. **Begin colonization** enables once a valid **founding landing** exists—all **colonist settings** already hold defaults in the pane. User may return to **terrain authoring** until **begin colonization**—all setup progress is discarded on return (landing pin, settings edits); no partial-state resume.

_Avoid_: “Pre-sim” in UI copy; conflating with **terrain authoring** parameter panels; saving colonization setup drafts across a terrain return; indeterminate colonist controls; leaving terrain sliders visible in setup.

### Colonist settings

Configuration during **colonization setup** for the founding wave. Pane ships in **colonization setup** (#391): **three-day haul distance** (scale calibration), **starting population**, **yield modifier** (marginal / typical / bountiful **arable envelope** interpretation), **epoch batch** (years advanced per **epoch step**—default 50, configurable 1–100), **land expedition range** (max trek length as a multiple of **three-day haul distance**—default **2×**, slider **1×–4×**), **inland sail expedition range** (default **3×**, slider **2×–6×**—rivers, lakes, sheltered coast), and **open-sea expedition range** (default **8×**, slider **4×–12×**—**port settlement** ocean voyages only; minimum stays above **inland sail expedition range** minimum). Every field has a concrete default—sliders and controls are never indeterminate. **Begin colonization** enables once a valid **founding landing** is placed; unset-looking controls still carry defaults. During `running`, only **epoch batch** remains editable mid-run; expedition range fields and other colonist fields stay read-only after **begin colonization**. Colonists are nameless and flavorless—no author-facing origin culture or homeland; the GM invents a past if they want one. Trade, diplomacy, and expansion temperament knobs wait for later increments. No author-facing RNG seed—colonization reuses **geography seed**. No **year cap** or auto-stop—the user keeps stepping **epochs** indefinitely.

_Avoid_: “Civ picker” that implies pre-existing on-map peoples; “Difficulty” sliders without geographic meaning; indeterminate or empty UI state for colonist controls; a separate **history seed** or **simulation seed** in the setup pane; **year cap** as max **epochs** before auto-stop; settings that only apply to increment 3 **faction** play in the first test slice; a single **sail expedition range** slider conflating inland and open-sea treks.

### Begin colonization

User action that commits **colonization setup** and enters the **colonization phase** `running` state—terrain hard-locked, **epoch** initialized (0), founding **settlement** created at the **founding landing**, founding **haul-shed** marked visited, and one founding **history log** entry (landing, **colonist settings** summary, founding **dynasty** when slice B lands). At commit, **survival triad** resolves once: **starting population** is clamped to **population ceiling**, freshwater failure marks non-sustain, and **population collapse** / tier reflect that honest **epoch** 0 state—marginal landings may already be at cap or in decline. Annual **epoch** ticks and **epoch step** arrive with increment 1; until then the UI stays in colonization mode with time controls inert, but the founding node is already real and inspectable. The run stays in `running` until **reset colonization**—no sim-detected endpoint, terminal freeze, or export gate.

_Avoid_: “Play” / “Run” without colonization context; auto-starting simulation when the **founding landing** is placed; silent terrain edits mid-run; auto-stop on **equilibrium state**, **political equilibrium**, or **year cap**; a fourth “ready” phase between setup and running; **`stopped`** phase that halts **epoch step** (scrubbed); deferring the founding **settlement** until the first **epoch step**; blocking **begin colonization** solely because the landing is marginal.

### Reset colonization

Explicit user action that abandons the colonization run entirely: wipes colonization state (**founding landing**, **colonist settings**, **epoch**, **settlements**, **history log**, …), returns phase to `terrain`, and unlocks geography editing. Always available once **begin colonization** has committed—including at **epoch** 0. One confirm step; no partial colonization resume. The only way back to **terrain authoring** from `running`.

_Avoid_: “New world” as the only escape hatch; preserving sim progress across a reset; different reset rules before vs after the first **epoch** tick; conflating with **campaign kit** export (export does not end the run).

### Founding landing

Map cell where the first colonizing boat makes shore—the seed **settlement** and expansion origin for one founding wave. Chosen by the user during **colonization setup**; must be **Sail overlay**-reachable coast or river mouth on a connected **landmass** large enough to host a colony (tiny offshore sandbars and wisps stay on the map but are not selectable). Invalid cells (inland, non-sailable shore, undersized land bodies) are not selectable—the map shows a “no” cursor like other disabled controls, without error copy. During setup, a single persistent map marker shows the chosen cell, with a live **haul-shed** reach preview centered on the pin (**three-day haul distance** calibration—isochrone when **movement cost** exists, approximate circle under heuristics); the preview rescales as the slider moves. Clicking another valid cell moves the pin and preview. The marker and preview persist in `running` as read-only reference at the **founding landing**.

_Avoid_: “Capital” before a **drain city** or political apex exists; random auto-placement without user intent; overland-only founding in v1; toast or modal explaining why a cell is invalid during placement; hover preview halos beyond the **haul-shed** preview; assuming the preview is always a circle when terrain-aware reach is available.

### Scalar field

Continuous raster over the **landmass** grid—elevation, temperature, rainfall, drainage, salinity—generated before biome labels. Biomes and **resource rasters** **arise** from field overlap (**fields before labels**), not from painting forest/desert tiles first.

_Avoid_: “Biome map” as the first artifact; discrete biome picker without sub-fields.

### Rain shadow

The two-sided way terrain reshapes rainfall along the **prevailing wind**: windward flanks facing the wind gain rainfall as air is forced to rise, while leeward slopes behind high terrain dry into belts on the far side of ranges. Part of rainfall **scalar field** generation—not a separate **biome** label painted by hand.

_Avoid_: “Desert biome slider”; rain shadow as leeward-only drying with no windward enhancement; rain shadow as a post-hoc biome override without elevation input.

### Prevailing wind

Direction moisture crosses the **landmass**; one bearing per generation (often derived from **geography seed**, overridable in UI). Carries ocean moisture inland—soaking windward coasts and drying deep interiors—then drives the bidirectional **rain shadow** (wet windward flanks, dry leeward belts) and biases where wind-blown snow accumulates and melts on highland caps. A stylized transport pass, not a permanent **climate** simulation.

_Avoid_: “Wind biome”; treating wind as a cosmetic bearing with no effect on rainfall or snow; conflating with storm **natural threat** events.

### Salinity

**Scalar field** for salt content of water/soil exposure: maximum in ocean and **closed island rim**, tapering inland with distance from sea. Informs coastal and wetland **biome** boundaries—not a **strategic resource** node layer by itself.

_Avoid_: “Salt layer” when meaning trade **strategic resource** placement; uniform inland salinity without coastal gradient.

### Fields before labels

Design rule: generate basic geographic **fields**, derive classifications (biomes, marshes, arable bands), then run hydrology and **logistics pass**—never place political or settlement labels on a blank aesthetic map. Opposite of map-first border drawing (playlist #05).

_Avoid_: “Start with coastlines and kingdom names”; **culture** or **faction** borders before **landmass** stages finish.

### Named region

Contiguous geographic area with a generated label; may span several **biomes** if connected (e.g. one forest name across taiga and jungle). **Exchange** and **connectivity** often attach at **named region** scale, not only per tile.

_Avoid_: “Kingdom” when meaning a pre-political geographic cluster; one biome equals one culture region.

### Continental biomes (physical terrain baseline)

**Biome** labels derived from **scalar field** overlap at **physical terrain baseline**—fourteen types in v1 of this layer:

Ocean, Coast, Grassland, Savanna, Temperate forest, Tropical rainforest, Taiga, Tundra, Desert, Scrubland, Swamp, Hills, Mountain, Glacier.

Freshwater-lake and river-corridor labels wait for hydrology **derived geography**. No Dwarf Fortress fantasy axes (good/evil, savagery).

_Avoid_: Painting these labels before **fields before labels** completes; treating the list as **culture** names.

### Simulation hydrology

Pre-refine drainage physics from the **landmass pipeline** through settled extract: flow direction, accumulation, and the settled centerline before optional **meander refine**. Input to refine and paint—not the authoritative definition of **traversable water** once the final map is drawn.

_Avoid_: "River network" or "river network mask" alone when meaning settled centerline vs final display; treating settled connectivity as final when **meander refine** bridged segments on the map; using simulation-only graphs for **validation checks** that claim to measure traversable rivers.

### Presentation hydrology

Map-facing hydrology after optional refine and paint: display river centerline, painted corridor width, and river-adjacent display biome labels. Consumed by the renderer and display biome refresh.

_Avoid_: "River network mask" when meaning simulation centerline; conflating with **simulation hydrology** when the question is what the player sees on the map.

### Sailable water

Connected **traversable water** and **waterfront sliver** regions as read from the **Sail overlay**—the metric and validation label for “how much of the map supports boat travel and shore access.” Replaces legacy “navigable river” / graph edge counts in user-facing reports. **Check rule:** pass requires meaningful connected sailing area (largest **8-connected** overlay component ≥ threshold); **Coastal river access** remains a separate row for ocean contact.

_Avoid_: “Navigable” when meaning **Sail overlay** area or components; equating sailable area with **simulation hydrology** centerline length; using total pixel count alone when water is fragmented into useless puddles.

### Coastal river access

Validation check that at least one river or lake meets the ocean through **Sail overlay** connectivity—a sail-native mouth test replacing graph **mouth** node counts. Sidebar label for the former `coastMouth` row.

_Avoid_: “Coast mouth” / graph node IDs as the user-facing contract; failing inland dead-end rivers when overlay shows no coastal connection.

### Coast-to-interior sailing path

Longest (or qualifying) continuous **8-connected** path from ocean/coast inward through the **Sail overlay** without crossing unset pixels—the validation check that inland water is actually reachable from the sea by boat. Replaces legacy “coast-connected navigable path” wording.

_Avoid_: Measuring this on pre-refine **simulation hydrology** graphs; “navigable path” in sidebar copy when **Sail overlay** is the source of truth.

### Sail overlay

Bright-pink map overlay showing where boat travel is allowed and where people can reach the water. Built from the **final display water union** (ocean + lakes + painted river corridors), blurred so connections between waterways close and shore outlines soften, then high-pass filtered so continuous sailing regions read clearly. Includes a narrow waterfront sliver around waterways so simulated people can launch, land, and sail. **Connectivity rule:** two points are sail-connected if an **8-connected** path through the overlay never crosses an unset pixel (diagonal steps allowed).

Display and analysis layer for **traversable water** and sailing **validation checks**; toggled like other map overlays. v1 ships with tuned blur/high-pass so the mask includes connected waterways and a usable **waterfront sliver** for launch and landings—not deferred. Upstream vs downstream cost is out of scope for v1—future simulations may use elevation incline along flow direction.

_Avoid_: “Navigable river graph” as a stand-in for **Sail overlay**; using unblurred centerline masks; conflating overlay visibility with generation options; treating shoreline outline pixels on the base map as non-traversable when the overlay bridge connects them; storing a separate sail mask on the **world document** that can drift from the derive function used at validation time.

### Port settlement

Living **settlement** whose pin lies on **Sail overlay** and within sail reach of open ocean—ocean-adjacent sail cells in the same class as a valid **founding landing** shore. May dispatch **open-sea expedition** and **inland sail expedition**; always retains the maritime slot guarantee when unvisited sail frontier remains. Distinct from economic **drain city** or **settlement tier**—dispatch class is geographic, not political.

_Avoid_: “Port city” as a tier label before simulation backs it; treating every **Sail overlay** pin as a **port settlement**; requiring **drain city** logistics type for open-sea dispatch; inland river towns with open-sea guarantees.

### Inland sail settlement

Living **settlement** whose pin lies on **Sail overlay** but is **not** a **port settlement**—river, lake, or sheltered water only, without open-ocean adjacency. May dispatch **inland sail expedition** only; no open-sea guarantee.

_Avoid_: “River town” as schema keys; conflating with **port settlement**; open-sea range multipliers on sheltered-water-only senders.

**Derivation:** not persisted—computed on demand from final water inputs and **fixed pipeline constants** (blur radius, high-pass threshold); validation and renderer share one deterministic function. Not user-adjustable in v1. **Meander refine** is optional—checks describe the generated map as shown, not a counterfactual with refine enabled.

### Freshwater availability overlay

**Terrain authoring** map layer (toggle like **Sail overlay** and resource overlays) showing where people can access drinkable water: rivers, lakes, coast, and **well-viable** land from the shared well heuristic. Ships with increment 1 (#392): same pure derive function feeds the overlay, **survival triad** freshwater accounting, and author inspection—recomputed from geography inputs like **Sail overlay**; not persisted on the **world document**.

_Avoid_: “Water overlay” alone when **Sail overlay** (boat travel) is meant; conflating with **population overlay**; persisting a separate mask that can drift from colonization heuristics; showing only surface water and omitting **well-viable** cells; colonization freshwater logic without the **terrain authoring** toggle in the same delivery slice.

### Well-viable

Land cell where the well heuristic judges groundwater digging plausible—no aquifer simulation. Derived from existing **scalar fields**: adequate **rainfall**, low **drainage** (permeability / wet soils), low **salinity**, and biome exclusions (**Desert**, **Scrubland**, …). Contributes to **Freshwater availability overlay** and to colonization **survival triad** freshwater inside the founding **haul-shed** when no river, lake, or coast cell is in reach. Exact thresholds are implementation tuning—not author-facing knobs in v1.

_Avoid_: “Aquifer”; per-cell well depth simulation; **well-viable** on ocean or **Glacier** without explicit exception rules.

### Exploration fog

Colonization overlay recording which cells the realm has **visited**—not concealing underlying geography. During `running`, base terrain and standard inspect overlays remain readable everywhere; uncleared cells carry a semi-transparent fog tint showing “not yet reached by the realm.” Cleared cells persist as visited; the overlay is toggleable like **Sail overlay** and **Freshwater availability overlay**. Does not hide biomes or resource rasters from the author—visit status is sim state, not a secret map. At **begin colonization** (**epoch** 0), all cells in the founding **haul-shed** are already visited; the rest of the map starts unvisited until **expeditions** clear it. When a daughter **settlement** is founded, its full **haul-shed** becomes visited immediately—same rule as the founding site.

_Avoid_: “Fog of war” in domain language when **exploration fog** is the product term; pre-revealing visit semantics during **terrain authoring** (overlay absent until colonization); treating fog as the only way to read geography during `running`; full concealment of terrain under uncleared cells; marking only the **founding landing** pin visited while the founding **haul-shed** stays unvisited.

### Faction territory overlay

Colonization map layer—primary political game board in increment 3. Paints each **faction**’s member **settlement** pins and their full geometric **haul-shed** isochrones (political reach)—not exclusive calorie-claim cells. **Vassal** sites count as the liege **faction** until defection. Overlapping isochrone cells use a shared/contested treatment; **survival triad** primary claim stays separate. Visit-status alone does not paint territory. Toggleable like other overlays.

_Avoid_: “Borders” as hand-drawn lines without simulation claims; painting territory independent of **history log**; pins-only with no **haul-shed** fill; claiming all visited cells as territory; capital-only fill that ignores **vassal** geography; using exclusive food-claim cells as the only territory fill when contested political reach is intended.

### Trade route overlay

Colonization map layer showing active **trade routes**; blocked or embargoed corridors visually distinct from open haul.

_Avoid_: Decorative path lines without commodity/volume semantics; user-drawn routes in hands-off mode.

### Realm expedition budget

How many **expeditions** the **realm** can field each **epoch**—a shared capacity derived from total living population and frontier shape (scaling like explored-region perimeter, not visited area or **settlement** count). Rationale: [ADR 0015](../docs/adr/0015-world-builder-expedition-budget-and-settlement-merge.md). Each pool size uses **sublinear scaling:** slot count ∝ √population × √frontier boundary length, where boundary length is proxied by visited↔unvisited edge cell count on dry land (land pool) or **Sail overlay** (maritime pool). **Independent pools:** **land expedition** capacity uses realm living population and overland frontier edges; **maritime expedition** capacity uses maritime-sender population and sail frontier edges—neither pool steals from the other. **Port settlements** always retain at least one maritime slot per **epoch** when unvisited **Sail overlay** frontier still exists—the maritime pool floor equals the count of maritime-frontier-eligible **port settlements**. When eligible senders exceed pool slots, **seeded weighted lottery** by sender population picks dispatch winners (same **geography seed** + **epoch** → same draws); when slots exceed eligible senders, every eligible idle sender gets at most one dispatch. When **frontierExhausted** (all scored **logistics nodes** founded or rejected), multiply the **land expedition** pool by a taper factor (~**0.15** at defaults)—the **maritime expedition** pool does not use logistics-node exhaustion; it follows sail-frontier edges and **port settlement** guarantees only. More people means more explorers; a larger frontier perimeter means more simultaneous parties—not one attempt per hamlet by default.

_Avoid_: “Scout cap” without population or frontier basis; per-**settlement** dispatch rolls as the primary capacity model; counting every living **settlement** as an automatic explorer source; a unified land/maritime pool that starves ocean exploration once inland frontier thickens.

### Frontier-eligible settlement

A living **settlement** that may compete for **realm expedition budget** slots in a given pool. **Land-frontier-eligible:** settlement pin on dry land while the realm still has overland frontier edges—dispatch does not oracle whether unvisited land lies within **haul-shed** reach; failed or empty treks resolve on **advance** (`blocked`, **survey complete**). **Maritime-frontier-eligible:** settlement with maritime role (**port settlement** or **inland sail settlement**) while sail frontier edges remain—same no-oracle rule at dispatch. **Port settlements** count toward the maritime pool floor when unvisited **Sail overlay** frontier still exists.

_Avoid_: “Frontier town” as a permanent tier label; treating every **Sail overlay** pin as a **port settlement**; dispatching land **expeditions** from open-water pins.

### Inland sail expedition

Maritime **expedition** mode for **inland sail settlement** senders (and **port settlements** on sheltered-water legs): **Sail overlay** steps only, coast-hugging preference, **inland sail expedition range** from **colonist settings**. Founding limited to **Sail overlay**-reachable **logistics nodes** on the march.

_Avoid_: “River expedition” as schema keys; open-ocean shortcuts in inland mode; using **open-sea expedition range** for inland senders.

### Open-sea expedition

Maritime **expedition** mode for **port settlement** senders only: long-range ocean voyages using **open-sea expedition range** from **colonist settings** (default **8×** **three-day haul distance**). **Sail overlay** steps only; may cross open ocean without shore-proximity limits (**inland sail expedition** keeps coast-hugging rules). Founding limited to **Sail overlay**-reachable coastal **logistics nodes** on the march. Successful founding persists an **open-sea route** segment.

_Avoid_: “Blue-water” in schema keys; inland river towns dispatching open-sea treks; open-sea founding at inland nodes without **Sail overlay** reach; applying inland shore-proximity caps to open-sea treks.

### Expedition

An outbound trek from a **settlement** that advances **exploration fog**, surveys **logistics nodes**, and may lead to a new **settlement** site. Rationale: [ADR 0012](../docs/adr/0012-world-builder-bearing-based-expedition-routing.md), [ADR 0015](../docs/adr/0015-world-builder-expedition-budget-and-settlement-merge.md). Draws from the **realm expedition budget** each **epoch**; only **frontier-eligible** senders compete for slots. At most **one active expedition per settlement**. **Mode is fixed at dispatch** as **land expedition**, **inland sail expedition**, or **open-sea expedition**—no mixed treks or portage in increment 2. **Land expedition** serves overland frontier expansion. **Inland sail expedition** and **open-sea expedition** are separate maritime modes with different range multipliers in **colonist settings**; **port settlements** may always launch maritime **expeditions** when ocean or sheltered-water frontier remains. **Mode selection** at dispatch follows sender eligibility and pool assignment—not a flat per-site land/sail coin flip. If a coastal **land expedition** has no legal first step (bearing points straight to impassable water), skip dispatch that **epoch**—do not auto-convert to **sail expedition**. At dispatch the sim also rolls a **random bearing**—there is no pre-selected destination cell; explorers follow terrain in that general direction rather than pathfinding toward undiscovered coordinates. The bearing is **fixed for the trek’s lifetime** (intent only); each step picks the legal neighbor that best matches it while satisfying terrain-following rules—the path may curve along coasts or ridgelines without re-rolling bearing mid-trek. If no legal step aligns and terrain blocks further progress, the expedition ends as **blocked**. Each **epoch**, the trek spends a **travel time** budget on **local terrain-following steps** along the bearing. **Land expedition** spends the **three-day haul distance** budget on **movement cost**-weighted steps (uphill slower than downhill; existing **land route** faster than wilderness)—each step picks the legal **dry land** neighbor that best matches the fixed bearing, then lowest travel cost (valleys and **land route** cells over steep climbs), then unvisited over visited; no step may take a large elevation jump when a lower-climb aligned alternative exists. **Sail expedition** spends **3×** that budget at flat low cost on **Sail overlay** cells, favoring coast-hugging and river-mouth travel—each step prefers neighbors within **6 cells** of dry land (non-ocean); if no legal step both matches the bearing and keeps that shore proximity, the trek ends **blocked** (no open-ocean shortcuts in increment 2). **Land expedition** steps only on **dry land** (never ocean, **lakeMask**, or **riverCorridorMask**). **Sail expedition** steps only on **Sail overlay** cells—no dock-and-march inland yet. An expedition **ends** when any of: (1) automatic **founding** at a viable **logistics node** on the path, (2) **blocked**—no legal next step that satisfies mode terrain rules (physical barrier: sea for **land expedition**, land or open water for **sail expedition**), (3) **range cap**—path length from origin exceeds the **land expedition range** or **sail expedition range** multiplier (from **colonist settings**) times **three-day haul distance**, or (4) **survey complete**—legal next steps exist but every candidate enters already-visited cells (rejoined known territory with nowhere new to go). No return journey in increment 2. While moving, visit status extends along the routed path (one cell wide through previously unvisited cells). **Scored logistics nodes** in the path corridor (routed cell plus immediate neighbors) are evaluated for founding viability in **travel order**—first viable unscouted node wins. **Land expedition** founding may occur at any viable inland or coastal **logistics node** on the march; successful founding persists the marched path as a **land route**. **Sail expedition** founding is limited to viable **logistics nodes** whose pin cell is **Sail overlay**-reachable (same class as a valid **founding landing**); successful founding persists the sailed path as a **sail route**. When the party reaches a scored **logistics node** (en route or at terminus), that site clears a local patch (disc around the cell) whether or not founding succeeds—failed viability still records “we’ve surveyed here”; exhausted rejected nodes are not re-targeted while terrain remains locked.

_Avoid_: “Scout unit” as schema keys; player micro of every path in increment 2 unless a later mode adds it; a minimum-survival **epoch** count or tier threshold before any expedition can dispatch; wide corridor clearing that reveals whole regions per step; leaving a reached but rejected node visually unvisited; multiple concurrent treks from the same **settlement**; realm-wide expedition caps unrelated to per-site agency; destination-only founding checks that ignore viable **logistics nodes** along the march; return-home treks; pathfinding toward a specific undiscovered target cell; global A* or unbounded grid search during **epoch step**; mixed land/sail treks or portage in increment 2; sail founding at inland nodes without **Sail overlay** reach; founding without recording the path as a **route segment**; straight-line cuts through impassable water.

### Supply-chain independence

When the unified increment 2 **realm** no longer shares one viable bulk-food **grain circle** across all **settlements**—the increment 3 entry signal. Evaluated each **epoch**; latches increment 3 on the first qualifying **epoch** when **either** branch is true (both not required). Politics **emerge gradually** after latch—not an instant realm split on that **epoch**.

**Land branch:** at least two **settlements** whose terrain-aware **haul-shed** regions share no cells **and** no **road** path connects them within the **three-day haul distance** **travel time** budget **and** no viable **maritime reach** / sail sea-lane still economically links them (**Sail overlay**-reachable coast or river mouth to coast—extends far beyond land **haul-shed** radius). **Roads** and sea lanes can bridge gaps that overlap alone would miss.

**Maritime branch:** any **settlement** whose primary **logistics node** type at founding was **drain city**, at town-tier or higher, where local **arable envelope** inside its **haul-shed** covers less than half its food consumption—the remainder via **maritime reach** import dependence. Maritime latch (or ongoing maritime independence) triggers a **maritime peel**: that **drain city** becomes its own **faction** / **city-state** even when sail or land still reaches inland sites—import / sea-lane dependence is the political fracture, not land isolation. **Rivalry** cause: **logistics** (sea-lane / import).

_Avoid_: “Too far apart” without haul math; ignoring **drain city** import logic when judging whether politics should activate; pure **haul-shed** non-overlap alone when a **road** or sail sea-lane still ties sites; requiring both branches on the same **epoch**; retroactive **drain city** classification for sites that grew into ports without that founding tag; instant **faction** map on the latch **epoch**; treating land **haul-shed** radius as the only distance that matters when **maritime reach** links distant ports; treating maritime latch as a no-op for politics when the **drain city** remains sail-reachable.

### Logistics pass

World Builder–specific **landmass pipeline** stage after physical terrain: **movement cost**, **haul-shed**, **maritime reach**, **arable envelope**, **strategic resource** placement, and **population ceiling** inputs—bulk haul economics the playlist defines and Dwarf Fortress does not model at macro scale.

_Avoid_: “Economy sim” for the whole **world**; conflating with **history log** or **conflict engine** ticks.

### Rejection sampling

Regenerate the candidate **landmass** when **validation checks** fail (missing haul corridors, **population ceiling** violation, impossible capital site)—same belt-and-braces pattern as Dwarf Fortress world rejection, but grounded in logistics constraints rather than biome quotas alone. Automatic during generation when enabled; distinct from **validation advisory**, which never blocks **Colonize** and may show a colonization-relevant subset (or superset) of checks rather than mirroring every rejection criterion.

_Avoid_: “Retry button” without logged reject reasons; conflating auto-reject during generation with a hard **Colonize** gate; assuming the right-panel advisory list is identical to the rejection-sampling criteria.

### Validation advisory

Pre-**Colonize** (and during **terrain authoring** / **colonization setup**) presentation of **validation checks** that matter for **colonization phase**—errors and warnings visible, never a hard block. The right-panel list is colonization-relevant only: omit checks that do not affect founding, survival, exploration, logistics, or politics; add checks when a geography gap would change colonization outcomes (e.g. missing **movement cost**, weak **Sail overlay** for landing, no **well-viable** / surface freshwater bands). **Warnings** alone do not add friction. When any listed check is in **error** state, **Colonize** requires a lightweight confirm (“colonize anyway”) before **colonization setup** opens—proceeding on marginal geography is deliberate, not accidental. **Begin colonization** does not repeat the confirm; the author already accepted the map. Odd or crude politics on a warned map are on the author. Distinct from **rejection sampling**, which may discard candidates during generation.

_Avoid_: requiring all checks green to **Colonize**; proceeding without surfacing what failed; blocking **begin colonization** again after setup; cluttering the panel with checks that never touch colonization; a second completeness gate once `running`.

### Geography seed

Deterministic input to **landmass pipeline** stages through **logistics pass** and **validation checks**, and the RNG for **colonization phase** simulation (**population collapse**, **expeditions**, **conflict engine**, …). Same **geography seed** + params + **colonist settings** + **founding landing** → same terrain and same colonization run.

_Avoid_: “World seed” alone when only terrain is meant; a separate **history seed** in author UI or **world document**; conflating with opaque **seed** when debugging requires knowing which stage diverged.

### Seed

Deterministic input to generation and colonization; same **geography seed** + params + colonization inputs → same **world**. One author-facing seed per **world document**.

_Avoid_: “Random” without reproducibility; sharing worlds without **geography seed** export; **history seed** / **simulation seed** as a second user-facing knob.

### Culture engine

Causality-driven framework for generating **cultures**: **environmental pressures** and **five forces** run **WOAC cycles** that emit **culture layers**—not aesthetic-first trait picking. Colonists have no author-facing origin culture at founding; culture appears when the engine runs. In **single-colony survival**, no culture output is required. In increment 3, **hybrid** mode—**WOAC** only on milestones: each **faction** emergence; the increment 3 latch **epoch** (once per nascent **logistics connectivity component**); major **history log** events (major-war outcomes, **vassal** defection, **city-state** founding). Embargo and routine **economic contest** do not reroll culture. Milestone output updates that **faction**’s culture summary for **campaign kit** **reverse-engineering culture** notes.

_Avoid_: “Lore generator”; “culture tables” that pick dress and gods without pressure inputs; annual culture rerolls for all **factions** every **epoch**; culture drift on every **rivalry** intensify or embargo alone.

### WOAC cycle

**Want** → **obstacle** → **action** → **consequence**. One loop of problem-solving; the **consequence** becomes the next **obstacle** or **want**. Same pattern under **culture engine** and **conflict engine**.

_Avoid_: “WAAC” (mis-acronym); “WAC” in product copy (playlist variant); one-off **events** without a recorded consequence chain.

### Five forces

Active pressures that run **WOAC cycles** and interact: **environment**, **power**, **belief**, **exchange**, **legacy**. One force’s **consequence** can become another’s **obstacle**.

_Avoid_: Treating these as wiki section headers only; “pillars of culture” without cycle semantics.

### Environment (force)

Geography, **climate**, **resources**, and natural threats—the physical pressures that start most forward-generated **cultures**.

_Avoid_: “Nature” as a vibe word; conflating with the **environmental pressure** stack (finer-grained inputs).

### Power (force)

Authority, hierarchy, control—who holds scarce assets and how rule is maintained or challenged.

_Avoid_: “Politics” alone when the **force** sense is meant; “government type” labels before **power centers** exist.

### Belief (force)

Religion, philosophy, values, worldview—especially explanations that **legitimize power** or cope with uncontrollable threats.

_Avoid_: “Religion” alone when **belief** includes secular ideology; random pantheons without threat inputs.

### Exchange (force)

Trade, conflict, migration, cultural contact—isolation vs synthesis with outsiders.

_Avoid_: “Trade” alone when diplomacy and raid economics matter; “foreign policy” without **connectivity** context.

### Legacy (force)

Historical events, trauma, and collective memory that still constrain present **WOAC cycles**.

_Avoid_: “Backstory” as unstructured prose; “ancient history” with no present-tense pressure.

### Environmental pressure stack

Bottom-up inputs that shape **culture** before institutions: **landscape** (movement cost, visibility, connectivity), **climate** (predictability, survival stress, resource cycling), **resource profile** (scarcity and abundance), and **natural threats** (predictability, frequency, defensibility).

_Avoid_: “Biome picker” aesthetics; single-axis desert vs forest without sub-pressures.

### Six culture layers

Outputs of running the **culture engine**—generated, not invented top-down:

1. **Survival strategy and material culture** — food, water, shelter, tools.
2. **Social organization** — families, roles, coordination structures.
3. **Value systems** — moral priorities, shame and honor.
4. **Worldview and temporal culture** — time, death, divine, causality.
5. **Expression and symbolic culture** — art, architecture, visible symbols.
6. **Cultural expressions** — language, food culture, rituals, communication style.

_Avoid_: “Culture sheet” checklists; shuffling layer order as if independent.

### Causality-driven design

Building from pressures and cycles so traits connect; opposite of aesthetic-first design (“warrior culture that values honor” then fill blanks).

_Avoid_: “Realistic” without traceable cause; museum-exhibit **cultures** (detailed but disconnected).

### Reverse-engineering culture

Working backward from an observed trait (ritual, taboo, institution) to the **environmental pressure** or **force** that plausibly caused it—validates generated **cultures** and GM-facing explanations.

_Avoid_: Post-hoc one-line justifications with no chain; “because it's cool.”

### Conflict engine

Under any political surface (feudal, republic, tribal, …): **power centers** with wants, blockers, and actions—the machine that produces ongoing **rivalry**. Built from **WOAC cycles**, not throne furniture. Increment 3 uses a **pressure ladder**: routine inter-**faction** pressure resolves as **economic contest** each **epoch** (haul capacity, **strategic resource** stockpiles, **chokepoint** / toll control)—no **WOAC**, no war **history log** entry. When contest intensity crosses a threshold (implementation-tuned), one major-war **WOAC** cycle runs, writes war/treaty **history log** entries, and may block or reopen **trade routes**. Peace does not erase **rivalry** edges.

_Avoid_: “Factions” lists with static alignments; “everyone hates the evil king” without **obstacles**; tactical battle simulation; full **WOAC** for every skirmish; continuous **WOAC** noise in the **event feed**.

### Political skeleton

Shared structure beneath political labels: **power centers** + **conflict engine**. Thrones and senates are furniture on the skeleton.

_Avoid_: “Government type” as the first design step; copying Earth nation names.

### Power center

A group or institution that wants to keep or gain something and faces **obstacles**—nobles, merchant houses, chiefs, priesthoods, councils, etc.

_Avoid_: “Faction” when the economic want is unspecified; single ruler as the only **power center**.

### Political middle layer

Between apex **great houses** (or crown) and local populations: **vassals**, march lords, castellans—where empires actually fray. Conditional **loyalty** lives here.

_Avoid_: Flat king → five houses hierarchies; **loyalty** as a boolean switch.

### Conditional loyalty

Owed allegiance with history and terms—not permanent unless the **supply chain** or coercion still holds. **Vassals** defect when liege-controlled **grain circle** / **chokepoint** economics stop mattering—alternate **road** or **maritime reach** paths, or local surplus independence—not from tier alone or idle RNG.

_Avoid_: “Betrayal” without prior obligation logic; eternal fealty flags; loyalty decay rolls without a logistics break.

### Great house

Apex **power center** competing for influence, territory, or succession—sits above the **political middle layer**.

_Avoid_: “Kingdom” when the house is the actor; family name without economic base.

### Vassal

**Middle-layer** holder of delegated authority (land, fort, toll)—**loyalty** tied to protection, profit, or habit. Increment 3: internal to a **faction** as **notable figure** dynasties with **conditional loyalty**—not separate **faction territory** until defection. Daughter **settlements** with `originSettlementId` begin as **vassals** under their component **faction**.

**Conditional loyalty** fails when the **vassal**’s **settlement** no longer needs the liege for **grain circle** protection or **chokepoint** access—e.g. an alternate **road** or **maritime reach** / sail path makes the liege’s toll optional, or the **vassal**’s local surplus no longer depends on liege-controlled corridors. Defection is a major **history log** event: spawn a new **faction** (or join an existing adjacent **faction** already in that **logistics connectivity component**), record a **rivalry** cause (**logistics** or **legacy**), and update **faction territory**. No map-visible **vassal** borders before defection.

_Avoid_: “Lord” generically for every noble; vassal without a liege relationship; every **vassal** as an independent map **faction** in v1 increment 3; defection from tier/distance alone while **road** or sail still binds the liege; stochastic loyalty decay without a logistics break.

### Supply-chain feudalism

Pre-industrial rule as logistics: **baronies** and **castles** exist because grain, salt, or goods had to move before they rotted—not because someone drew a border.

_Avoid_: “Feudalism” as costume; **realm** borders without **haul** logic.

### Grain circle

Feedback loop: garrison needs food → road must be safe → grain must move → farmers need protection → garrison needs food. Break one link and the node dies.

_Avoid_: Castles “for flavor”; wars without supply stakes.

### Ox paradox

Haul decay: draft animals consume roughly a fixed fraction of bulk cargo per distance unit; long land routes can deliver nothing but fed beasts. Caps effective **haul-shed** size.

_Avoid_: Infinite overland caravans; “500 miles” without cargo math.

### Haul-shed

Region where delivery still pays after **ox paradox** and **movement cost**—not a geometric circle. For each **settlement**, the **haul-shed** is the terrain-aware reachable zone: cells whose **travel time** from the pin stays within the **three-day haul distance** budget from **colonist settings**, weighted by slope and surface (uphill costs more than downhill; **road** cells cost less than open wilderness). **Colonization setup** may show an approximate reach preview on the map (isochrone when **movement cost** exists; circle fallback under best-effort heuristics) so authors calibrate scale—simulation accounting uses the terrain-aware region. Local **survival triad**, **population collapse**, and visit status at founding use this boundary. Isochrones may overlap geometrically; for food, timber, **salt**, and other summed **survival triad** inputs, each cell is claimed by at most one **settlement**—the nearest pin by **travel time** (primary claim). Claims recompute every annual **epoch** from that year’s movement graph (including new **roads**, founding, and other network-changing **history log** events), so hinterland ownership can shift when corridors or pins change—including in silent years inside an **epoch batch**. Present-day **primary claim** is authoritative for map overlays; historical claim maps are not persisted ([ADR 0014](../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md)).

_Avoid_: “Radius” in miles only without calibration; fixed pixels-per-day baked into the **landmass** without author-facing scale; treating the setup preview shape as the simulation boundary when **movement cost** is available; ignoring **road** travel bonuses inside the reachable zone; double-counting shared cells’ arable or timber into every overlapping **settlement**’s ceiling; freezing calorie ownership at founding while **roads** reshape **travel time**.

### Three-day rule

Rule of thumb: beyond ~three days' **travel time** by cart, bulk food **haul** often fails economically—not tradition, arithmetic. In v1 the distance implied by “three days” is set in **colonist settings** (calibrated **haul-shed** anchor) because the **landmass** grid has no intrinsic real-world scale.

_Avoid_: Stating distances in miles/km alone for RPG prep; “two weeks north” without consistency; assuming one global real-world scale per grid cell without author calibration.

### Travel time

Primary spatial measure for play and simulation—“three days on horseback” beats raw distance.

_Avoid_: “Hexes” in domain language unless the product explicitly uses a hex grid.

### Movement cost

Energy or time to cross terrain (slope, swamp, surface quality); high cost → isolation, local self-sufficiency; low cost → **exchange** and blended **cultures**. Drives terrain-aware **haul-shed** isochrones, **expedition** routing, and **trade route** viability. Uphill segments cost more than downhill along the same path.

_Avoid_: “Difficult terrain” without graph weights; uniform plains with no connectivity story; Euclidean distance substituting for **travel time** in **haul-shed** or **expedition** pathing.

### Route segment

Persisted path geometry on the **world document** linking two **settlements** after a successful founding **expedition**—the **built corridor** between parent and daughter pins, not the bearing **expedition** trace. At founding the sim computes an A→B corridor appropriate to mode; **exploration fog** clears along that corridor. Each segment records its mode (**land route**, **inland sail route**, or **open-sea route**) and the connected **settlement** ids. Later increments may add segments from **trade route** activation and logistics pressure—not only founding marches. Segments remain when an endpoint later becomes a **ruin** (historical connectivity).

_Avoid_: “Road” alone when land and maritime founding paths are meant; user-drawn paths in hands-off v1; decorative lines without simulation effect; erasing founding paths that did not result in a **settlement**; treating the marched **expedition** route as the persisted **route segment** geometry; deleting segments when a **settlement** merges or is abandoned.

### Land route

**Route segment** from a successful **land expedition** founding. Terrain-following corridor on dry land. **Land route** cells apply a **movement cost** multiplier (faster/easier **haul** than open wilderness) for **travel time**, **haul-shed** reach, and overland routing. **Routes overlay** draws terrain-following geometry in gray cobblestone.

_Avoid_: “Road” in UI overlay names when **routes overlay** is meant; treating **land route** cells as sail-traversable; segments that cut through ocean, **lakeMask**, or **riverCorridorMask** cells.

### Inland sail route

**Route segment** from a successful **inland sail expedition** founding—shore- and river-hugging path on the **Sail overlay** between **settlements**. Does not apply a land **movement cost** multiplier; may seed increment 3 **trade route** / sea-lane candidates. **Routes overlay** draws sheltered-water geometry in cool cyan/teal following the overlay (not open-ocean shortcuts).

_Avoid_: Conflating **inland sail route** with **trade route** (commodity activation waits for increment 3); drawing through non-**Sail overlay** cells; open-ocean chord geometry for river legs.

### Open-sea route

**Route segment** from a successful **open-sea expedition** founding—long-range ocean link between **port settlements**. May cross open ocean on the **Sail overlay**. **Routes overlay** presents **open-sea route** geometry as long sweeping curves between ports (readable at map scale—not a jagged cell trace); inland and land routes keep terrain- or shore-following presentation respectively.

_Avoid_: “Sea lane” in schema keys before increment 3 **trade route** activation; cell-staircase art for trans-ocean links; conflating **open-sea route** with **inland sail route** presentation; **sail route** color that matches **Sail overlay** pink when both are on.

### Sail route

Legacy umbrella for persisted maritime **route segment** geometry—prefer **inland sail route** or **open-sea route** when mode matters.

_Avoid_: Single sail presentation style for both sheltered water and open ocean; expecting **sail route** to shorten overland **haul-shed** reach inland.

### Routes overlay

Colonization map layer (toggle like **exploration fog** and **Sail overlay**) showing persisted **route segments** from **successful founding** only—**land route** terrain-following gray cobblestone, **inland sail route** shore-hugging cyan/teal, **open-sea route** long sweeping curves in a distinct cool maritime tone. Segments to **ruin** endpoints remain visible as historical connectivity. Failed, rejected, or completed-without-founding **expeditions** do not appear here (**exploration fog** records where the realm has traveled). Read-only inspection of founding connectivity; not a separate persisted mask.

_Avoid_: “Roads overlay”; a single color and geometry style for all modes; showing scouting paths that did not found; conflating with **trade route** activation state; treating the overlay as the authoritative visit map; erasing segments when an endpoint becomes a **ruin**.

### Maritime reach

Where sea **haul cost** (~order-of-magnitude cheaper than land) extends feeding and **trade** beyond **haul-shed**—enables **drain cities** and empire-scale flows.

_Avoid_: Ports that are decorative; continents fed entirely by ox cart from one capital.

### Drain city

**Settlement** that concentrates flow (often port or river hub)—imports surplus from a wide **arable envelope** or **maritime reach**, not local subsistence alone. **Parasite city** pattern: grows past local **population ceiling** by sea-fed calories; foreign policy becomes sea-lane control.

_Avoid_: “Capital” with arbitrary population; metropolis in a food desert without import logic; treating as a normal inland **settlement** for **haul-shed** fracture.

### Population ceiling

Maximum plausible urban or regional population implied by **arable envelope**, **haul-shed**, and **maritime reach**—an output of geography, not a slider first. Per **settlement**, the ceiling is the minimum of applicable caps on that site’s claimed **haul-shed** cells: food from summed arable (primary), fuel/shelter from summed timber when timber binds below food, and freshwater as a hard gate (no water in claimed cells → colony cannot sustain).

_Avoid_: “100k city” by aesthetic; capitals larger than their hinterland can feed; food ceiling alone when timber sum is the tighter bind; ceilings that double-count cells also claimed by a neighbor.

### Arable envelope

Land that can sustainably feed a **settlement** or **drain city** given era-appropriate yields and **haul**—typically many times the built area for pre-industrial density. Per **settlement**, summed arable productivity on claimed **haul-shed** cells (arable raster × **yield modifier**) is the local food production cap and **population ceiling** input.

_Avoid_: Farmland drawn only as map texture; farm percentage ignored (~80–95% rural in pre-industrial models); single-cell arable bottleneck when claimed-cell sum is the accounting unit; counting the same cell’s arable toward every overlapping **settlement**.

### Survival triad

Minimum resource accounting for **single-colony survival**, aggregated within the **settlement**’s claimed **haul-shed** cells—food and freshwater are the primary gates; fuel/shelter is secondary. Food: **sum** arable productivity across claimed cells (arable raster × **yield modifier**) sets the primary production capacity and **population ceiling** input. Freshwater: **hard gate**—at least one **Freshwater availability overlay** cell among claimed cells; if present, the leg is satisfied and food drives scale. Fuel/shelter: **sum** timber productivity across claimed cells (**Timber** overlay)—when the timber total is scarce, it can cap **population ceiling** below the food cap (e.g. grassland with strong arable but little firewood). **Salt** (slice B): **spoilage tax** on food surplus—salt access in claimed cells scales how much arable production counts toward surplus (weak **salt** → spoilage → surplus-driven growth stalls or reverses despite good arable). Increment 1 test slice A omits salt; slice B completes increment 1. With multiple **settlements**, claimed cells are exclusive (nearest pin by **travel time**); geometric isochrone overlap does not duplicate calories or timber.

_Avoid_: “Needs bars” UI jargon; treating the triad as the full **economy** model; freshwater from **Sail overlay** alone (sailing ≠ drinking); divergent well rules between overlay and colonization tick; bottleneck-only food from a single worst cell when the claimed-cell sum is the cap; volumetric freshwater consumption competing with food for **population ceiling** in increment 1; binary timber gate when sum scarcity is the intended pressure; **salt** as a third **population ceiling** min() when preservation spoilage on surplus is the intended mechanic; independent full-isochrone sums that invent regional capacity.

### Strategic resource

Geographically sparse necessity (salt for preservation, metals, timber above treeline gaps)—controls **trade routes**, **rivalry**, and who taxes whom. In increment 1 slice B, **salt** access in the founding **haul-shed** applies a **spoilage tax** on effective food surplus—not a calorie source.

_Avoid_: “Rare ore” with no logistics effect; salt as flavor text; **salt** as a duplicate **population ceiling** cap when spoilage-on-surplus is meant.

### Chokepoint

Pass, strait, ford, or toll segment where **movement cost** forces traffic—natural fort and **trade** leverage. One **logistics node** type for automatic **settlement** founding in increment 2.

_Avoid_: “Border” lines without funnel geography; castles off the corridor.

### Logistics node

Geography-scored candidate cell where a **settlement** plausibly anchors—choke, **haul junction**, **surplus basin**, **refinery**, or **drain city** pressure. Increment 2 founding scores cells with **multi-tag** weights (non-exclusive—a river mouth may score junction + **drain city** + **surplus basin**); inspect shows a primary type (highest-weight contributor) plus secondary tags. An **expedition** must reach a scored node above threshold **and** pass local **survival triad** viability before automatic founding. Viability uses a **provisional claim**: recompute exclusive nearest-pin ownership including the candidate pin, then apply freshwater and arable thresholds on cells that pin would own—not the full geometric isochrone and not “unclaimed only.”

_Avoid_: Mutually exclusive single-type assignment when several roles overlap; founding on type score alone without freshwater/arable viability; random dots without logistics justification; founding on geometric **haul-shed** sums the new pin will not keep after claims settle.

### Haul junction

**Logistics node** type where **grain circle** or river/road **haul** paths meet—confluence, crossroads, portage landing. Distinct from **chokepoint** (funnel) though one cell may score both.

_Avoid_: “Crossroads” in schema keys; treating every river tile as a junction.

### Surplus basin

**Logistics node** type where local **arable envelope** inside viable **haul-shed** exceeds typical hinterland—farm surplus worth a second **settlement** seat.

_Avoid_: “Farmland tile” without aggregated circle productivity; surplus relative to neighbor **population ceiling** instead of absolute arable sum.

### Refinery

**Logistics node** type tied to **strategic resource** concentration worth processing or taxing— **salt**, metals, timber above treeline gaps—not a generic workshop label. Founding follows the same **logistics node** score + **survival triad** gate as other types.

_Avoid_: “Factory”; decorative industry without **strategic resource** geography; conflating with **surplus basin** when no scarce resource is present.

### Trade route

Graph edge or corridor where moved goods still pay after **haul decay**—rivers, roads, sea lanes, **salt roads**—often explains **settlements** and **political middle layer** placement. When increment 3 latches, geography proposes the full candidate corridor graph once: increment 2 **road** segments, overland paths on **movement cost**, and sail sea-lanes on **Sail overlay** / **maritime reach** (sea corridors may span far beyond land **haul-shed**). Candidates stay dormant until endpoint **settlements** show complementary **settlement trade profile** surplus/deficit, then activate. **Faction** relations and **history log** events (war, embargo, treaty) tax, block, or reopen active routes—dormant candidates remain visible as geography-proposed potential.

_Avoid_: “Trade route” as a line on art without volume or commodity; every road equal; user-drawn routes in hands-off mode; land-only candidates when **maritime reach** links distant ports; gating sail corridors behind maritime-branch latch alone; vanishing corridors when economics pause (block/embargo, do not erase geography).

### Settlement

A persisted population node (hamlet to **drain city**) whose tier and role should be justified by **arable envelope**, **chokepoint**, **strategic resource**, or **trade route**—not random dots. Exposes tier label and population count on inspect; size constrained by local **population ceiling** in **single-colony survival**. The founding **settlement** is created at **begin colonization** (**epoch** 0) from **starting population** in **colonist settings**—not on the first **epoch step**. **Survival triad** resolve (clamp to **population ceiling**, freshwater non-sustain) is deferred to increment 1 (#392); until then **epoch** 0 records the configured headcount. Population changes each later **epoch** from food surplus (production minus consumption)—growth when surplus is positive, stall at balance, decline when negative. Daughter **settlements** founded in increment 2 start at a fixed small outpost headcount (implementation-tuned constant, below founding `startingPopulation`) and use the same global **three-day haul distance** from **colonist settings** for their local **haul-shed**—centered on the new pin, not the **founding landing**. Living **settlements** may **merge** into a neighbor under increment 2 logistics rules (see **settlement merge**). At population 0 without merge the pin remains a **ruin**: no calorie claims, no **expeditions**, still visible for **history log** / **faction** memory; hinterland frees for living neighbors on the next claim recompute; active **trade routes** to the site deactivate (candidates may remain). A **history log** abandonment or merge records the outcome. Ruins are not fully removed and do not keep zombie claims.

_Avoid_: “City” / “town” labels without simulation backing; one capital per kingdom by default; tier without backing population accounting; fixed per-**epoch** headcount increments divorced from **survival triad** production; reusing full founding `startingPopulation` for every daughter site; per-**settlement** **three-day haul distance** knobs in increment 2; empty **settlements** at **epoch** 0 after commit; deleting failed sites with no map memory; zero-population pins that still own hinterland or dispatch **expeditions**; merge purely because **haul-shed** regions overlap without proximity and economic pressure.

### Settlement merge

Absorption of one living **settlement** into another: population transfers to the surviving pin; the absorbed pin becomes a **ruin**; a **history log** entry records the event. Rationale: [ADR 0015](../docs/adr/0015-world-builder-expedition-budget-and-settlement-merge.md). Increment 2 (#393) implements logistics-grounded merges only—no **faction** politics required. Two paths: **outpost reabsorption** (daughter **settlement** with `originSettlementId` stays at outpost tier or below, population never exceeds ~2× founding outpost headcount, and all conditions hold for **5 consecutive epochs**—counter resets on growth past threshold) and **living-sphere consolidation** (two living **settlements** whose pins lie within one **three-day haul distance** **travel time** of each other; smaller runs negative food surplus while larger runs positive surplus for **3 consecutive epochs**—counter resets if the smaller site returns to surplus; when several surplus neighbors qualify, prefer highest surplus, then shortest **travel time**, then higher **settlement tier**). Both require sustained economic pressure and (for living-sphere) geographic proximity—not **haul-shed** overlap alone or a single bad **epoch**. No **road** or **route segment** link required. At most one merge per absorbed pin per **epoch**; a survivor cannot absorb a second **settlement** in the same **epoch**; **outpost reabsorption** takes priority when both paths qualify for the same pin. On merge, all population transfers to the survivor then clamps to **population ceiling** in the same step—excess is lost to overcrowding, not rerouted to other **settlements**. **Survivor rules:** outpost reabsorption always keeps the origin pin; living-sphere consolidation keeps the higher **settlement tier** (population tie-break). The founding **settlement** ( **founding landing** ) may absorb others but is **merge-immune** as the absorbed pin in increment 2—the colonial-origin anchor is never folded into a daughter site. Active **expeditions** from the absorbed pin cancel at merge (visited cells stay cleared; no founding from the aborted trek). The absorbed pin’s **notable figure** dynasty remains on the roster as a legacy **absorbed** house linked to the survivor **settlement**—flavor and **history log** / **campaign kit** hooks in increment 2, not a second active capital seat.

**Administrative federation**—separate urban cores voluntarily or politically federating once shared infrastructure and governance outgrow parish scale (historical “Six Towns” pattern)—is increment 3 scope ([#394](https://github.com/enmaku/portfolio-site/issues/394)), not increment 2.

_Avoid_: “Annexation” without logistics cause; instant merge on proximity alone without sustained deficit/stagnation counters; merging two healthy towns in increment 2; **administrative federation** before increment 3 latch; deleting absorbed pins with no **ruin** memory; merge without **history log** row; absorbed pin becoming the survivor in **outpost reabsorption**; lower-tier **settlement** absorbing a higher-tier neighbor in **living-sphere consolidation**; requiring **road** or **route segment** connectivity for increment 2 merge.

### Settlement tier

RPG-facing size band for a **settlement** from **absolute population count**—hamlet, village, town, and higher bands use fixed headcount thresholds (concrete numbers tuned in implementation), not fractions of local **population ceiling**. A **town** is big in absolute terms; a newer **settlement** below its ceiling but above town threshold is still a town, not a **hamlet**. Primary label on the map; inspect pairs tier with raw population count. **Population ceiling** caps growth; tier reflects how large the **settlement** has actually become.

_Avoid_: “Level” in domain language; ceiling-relative tier (e.g. “60% of local cap = town”)—mislabels large young **settlements** smaller than older neighbors; tier divorced from population accounting.

### Population overlay

Map heatmap of where people actually are after each **epoch**'s **population collapse**—bulk population density, not just **settlement** pin dots. Each **settlement** runs a **core + hinterland** collapse on its claimed cells: a fixed fraction at the pin (urban cluster) and the remainder spread across claimed hinterland weighted by arable productivity. Because claims are exclusive (nearest pin by **travel time**), cells do not stack density from multiple **settlements**. Each pin’s total population still matches that **settlement**’s headcount. The pin carries **settlement tier** and total population; the overlay shows spatial spread.

_Avoid_: “People layer” when only **settlement** markers are shown; static density painted by hand; all population on one cell when **haul-shed** rural spread is intended; ceiling-relative density that ignores where arable lies; double-counting people on cells claimed by only one pin; realm-wide single collapse before increment 3 needs it.

### Bulk population

The vast majority of people not simulated as individuals—held in superposition as regional parameters (**settlement** headcounts, **primary claim**, arable weights, distribution constraints) until **population collapse** each **epoch** resolves “where people are this year.” Between collapses the sim stores what governs their lives, not a per-cell census or per-person agents. In increment 1, total bulk count tracks the founding **settlement** population; **epoch** delta follows food surplus against **population ceiling** caps. Rationale: [ADR 0011](../docs/adr/0011-world-builder-bulk-population-wavefunction-collapse.md); [`docs/POPULATION-MODEL.md`](./docs/POPULATION-MODEL.md).

_Avoid_: “NPCs”; census lists for every farmer; agent simulation of every person in v1; population growth by fixed schedule ignoring **survival triad** surplus; persisting a full-grid population raster as authoritative state; treating **settlement** pin totals as sufficient when **population overlay** spatial spread is required.

### Population collapse

Once per **epoch**, observation step: resolve **bulk population** parameters into a concrete spatial distribution for the **population overlay** and **settlement** totals—inspired by wavefunction-collapse-style constraint satisfaction: seeded weighted placement of integer people onto legal claimed land (urban cluster at the pin plus arable hinterland sample), not a reachability tint. Output is a derived in-memory raster (recomputable from stored parameters; not persisted in session storage). In increment 1, uses **core + hinterland** weighting inside the founding **haul-shed**. Deterministic from **geography seed** + **colonist settings** + **founding landing** + sim state. The canonical “where people are this year” observation.

_Avoid_: “Render pass” alone when simulation state is meant; collapsing mid-epoch for gameplay sub-ticks unless explicitly modeled; spatial output that disagrees with **settlement** pin population total; persisting collapse output every **epoch** instead of recomputing from parameters; using collapse placement for **expedition** parties or other entities that need explicit routed positions.

### Notable figure

A tracked **dynasty** or lineage—not a single person—whose seat persists across **epochs** while holders change every generation. With **epoch batch** spans of many years, one **epoch** may cover multiple lifetimes; the sim tracks the house (e.g. “The Saltmarsh Flats Dynasty”), not “Lord Trentor Abernathy.” Outside **bulk population** accounting; v1 house labels come from a **landing geography heuristic** at the site (coast, river mouth, wetland, pass, …) + “Dynasty”—no procedural personal names; authors rename freely. Increment 1 slice B seeds one founding dynasty at **founding landing** (flavor only, no per-**epoch** mechanics). Increment 2 adds one dynasty per daughter **settlement** at automatic founding—same labeling pattern, no **expedition** lead or **vassal** seats yet. Increment 3 **power roster**: apex house per **faction** plus key **vassal** dynasties at **chokepoints**, **drain city** stewards, and richer political seats—handful per **faction**, not proportional census. **Named region** labels may supersede landing heuristics when that **derived geography** ships.

_Avoid_: “Hero” in schema keys; simulating every holder as a full agent; personal name generation in product output; **notable figure** as one immortal individual across centuries; transient **expedition** lead dynasty seats in increment 2; full **vassal** roster before increment 3 **factions**; dozens of tracked houses per **city-state**; assuming **named region** strings exist before that pipeline stage is implemented.

### Realm

Colonial origin umbrella for one founding wave: all **settlements** that descend from the same **founding landing** share one **realm** (shared empty-continent arrival story). Before increment 3 latch, the **realm** is also the sole polity (one political body). After latch, the **realm** remains as cultural/colonial origin while **factions** carry politics, **rivalry**, and **faction territory**—a **realm** may contain multiple **factions**. **Campaign kit** may describe “colonial **realm**, N **factions**” after fracture. If every **settlement** is a **ruin**, the **realm** remains as colonial memory only—no **expeditions**, no further latch/politics progress—but the run stays in `running` for scrub/export/**reset colonization** (no auto-reset).

_Avoid_: Equating **realm** with a single **faction** after latch; retiring **realm** when politics emerge; treating **realm** as map-drawn borders separate from founding lineage; forcing **reset colonization** when the colony fails.

### Faction

Simulated **power center** or aligned group with territory claims across one or more **settlements**, economic wants, and **rivalry** edges—emerges gradually in increment 3 from **supply-chain independence**, not at **founding landing**. Lives inside a **realm** after latch; does not replace the colonial-origin **realm**. A **city-state** is a **faction** whose capital **settlement** has reached sovereign town-tier or higher.

After increment 3 latches, **factions** form from **logistics connectivity components**: group living **settlements** (population > 0) linked by shared **haul-shed** overlap, **road** paths within **three-day haul distance** budget, or **maritime reach** / sail sea-lanes between **Sail overlay**-reachable sites (sea links extend much farther than land **haul-shed**). Each component that contains at least one town-tier+ living **settlement** becomes one **faction** over staggered **epochs** (**history log** emergence entries)—not an instant split on the latch **epoch**. Hamlets and villages inherit their component’s **faction**. The capital is the highest-tier living **settlement** in the component; if the capital becomes a **ruin**, capital passes to the next highest-tier living member. Daughter sites with `originSettlementId` begin as **vassal** dynasties under that **faction** until **conditional loyalty** breaks. **Ruins** may remain listed as legacy seats in **faction** memory without owning territory fill or claims. A **faction** with no living members becomes extinct (dissolves as an active polity; **history log** records extinction)—not an empty territory holder.

**Maritime peel:** when the maritime branch of **supply-chain independence** is true, the founding-type **drain city** is removed from inland components and forms its own **faction** / **city-state** even if sail or land still reaches inland sites. Land-branch clustering still counts sail as a unifying link; maritime independence is the exception that peels the port.

**Expeditions**, automatic founding, **roads**, and **exploration fog** continue after latch—politics and exploration are concurrent layers, not a freeze. New **settlements** join the origin **settlement**’s **faction** as **vassals** until loyalty breaks.

### Administrative federation

Increment 3 ([#394](https://github.com/enmaku/portfolio-site/issues/394)) **settlement merge** path: separate town-tier+ urban cores in the same **logistics connectivity component** federate when shared **road** / **trade route** infrastructure and governance pressure make a single **faction** capital inadequate—historical amalgamation of adjacent pottery towns or suburban cores, distinct from increment 2 **outpost reabsorption** and **living-sphere consolidation**. Emits a **history log** **settlement merge** row; surviving pin keeps or inherits capital status within the **faction**.

_Avoid_: **Administrative federation** in increment 2; federating hamlets that never reached town-tier; federation without **road** or **trade route** ties; instant federation on increment 3 latch **epoch**.

_Avoid_: “Race = faction”; static good/evil teams; 1:1 **faction** ↔ single hamlet without territorial claims; land-only clustering that ignores sail ties between distant ports; one **faction** per **settlement** on the latch **epoch**; **road**-only graphs when **maritime reach** still links the **realm**; freezing exploration when increment 3 latches; maritime latch with no **faction** split while the **drain city** stays sail-linked.

### City-state

A **faction** whose capital **settlement** has reached sovereign town-tier or higher—an urban polity with its own **grain circle** or **maritime reach** dependence, not merely a fort on the frontier.

_Avoid_: “Kingdom” when only one city is sovereign; **city-state** before increment 3 independence; labeling every **settlement** a **city-state**.

### Rivalry

Directed political tension between **factions** with stored causes—for GM-readable hooks. Edges form sparsely when a concrete **obstacle** appears (embargo, **chokepoint** contest, succession claim)—not for every adjacent **faction** pair by default. Causes record on creation or intensification across: **resource** (monopoly, embargo), **logistics** (**chokepoint**, **grain circle**, sea-lane), **territory** (border, succession), **legacy** (war, treaty), and **belief** (legitimacy, schism). One cause type per creation/intensification event. Edges persist through peace; causes accumulate.

_Avoid_: “They hate each other”; **rivalry** without **legacy** or resource **obstacle**; logging every minor insult; auto-**rivalry** for every neighbor or active **trade route** alone.

### History log

Ordered **epochs** and events that feed **legacy** and reshape borders. Browsable in-app via filterable **event feed** (increment 3) that lists structured entries and may focus involved **settlements** on the **present-day** map—not historical map rewind. **Epoch** 0: one founding entry at **begin colonization** (#391). Increment 2 (#393): one structured entry per daughter **settlement** founded (**epoch**, site, primary **logistics node** type, originating **settlement**) and per **settlement merge** or **settlement** abandonment—no expedition lifecycle or rejected-site entries.

Increment 3 **event feed** catalog (structured fields, not prose): increment 3 latch; **faction** emergence; **faction** extinction; **city-state** founding; daughter **settlement** founding; **settlement** abandonment (population reached 0 → **ruin**); **settlement merge** via **administrative federation**; **vassal** defection; major war start/end; treaty/peace; embargo when it creates or intensifies **rivalry**. Feed filters map to these kinds. Do **not** log routine **economic contest** ticks, culture **WOAC** internals, or **expedition** lifecycle.

_Avoid_: “Timeline” as flavor-only; events that don’t touch **power centers**; export-only log with no in-app investigation; deferring the founding entry until the first **epoch step** when **epoch** 0 should record the commit; logging every **expedition** departure or failed-viability survey; per-**epoch** contest summaries or culture-cycle rows in the feed.

### Epoch scrubber

**Cut** from v1 scope ([ADR 0014](../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md)). Past-**epoch** map rewind and per-year snapshot storage (`committedTips`) were removed for session size and refresh performance. Increment 3 investigation uses **event feed** + **present-day** map focus instead.

_Avoid_: “Epoch scrubber”, “scrubbed year”, or “committed tip” when the product means **event feed**, **history log**, or **present day** inspect only; implying refresh restores historical map states beyond **`historyLog`** entries.

### Epoch

Discrete simulation tick for **colonization phase** and **history log**—one in-world **year** per tick in v1 (harvest cycles, haul economics, and **history log** entries align to annual steps). First release advances one **epoch** per **epoch step**; target UX advances **epoch batch** years per step (~100 default). No auto-stop—the user keeps stepping indefinitely. **Present day** is the latest simulated **epoch** only. Within each annual tick, order is fixed: **network** (**expeditions**, founding, **roads**) → hinterland **primary claim** recompute → **survival triad** / **population collapse** → politics (**supply-chain independence** latch, **factions**, **trade routes**, **conflict engine**). **History log** events for that year are written as their causes complete.

_Avoid_: “Year 1042” precision without source events; real-time wall-clock simulation in v1 copy; conflating with **terrain authoring** (no **epochs** until **begin colonization**); generational or seasonal ticks unless explicitly switched in **colonist settings**; **equilibrium state** or **political equilibrium** as stop triggers; evaluating latch on a pre-founding network; running survival before claims settle for new pins.

### Epoch step

Manual advance during **colonization phase**—applies **epoch batch** sequential annual ticks (1 in first release, configurable later). Primary time control for inspecting causality; no fixed endpoint. Always advances **present day**.

_Avoid_: “Turn” in domain language when **epoch** is the persisted unit; sub-epoch micro-ticks in user-facing copy unless explicitly modeled; implying the sim should halt when resources or population stabilize.

### Founding chronicle

Minimal right-panel list during increment 2 **colonization phase** `running`: chronological **history log** milestone rows—founding wave, each daughter **settlement** founding, each **settlement merge**, and each **settlement** abandonment (**ruin**)—structured fields, not prose narrative. Paired with compact **sim status** (**epoch**, **settlement** count, active **expeditions**, frontier exhaustion). Replaced by filterable **event feed** in increment 3—not a separate persisted artifact.

_Avoid_: “Event log” as schema keys; replaying validation advisory after **epoch** 0; building full **event feed** UX in increment 2; user-facing prose paragraphs in the chronicle rows; showing only founding rows while hiding **settlement merge** and abandonment milestones.

### Continuous colonization run

Optional future UX: simulation auto-applies **epoch batch** ticks with pause between batches—same annual tick semantics as **epoch step**, not a different time model. Deferred past increment 3 (#394)—increment 3 ships manual **epoch step** and editable **epoch batch** only; continuous run waits until stepping, **event feed**, and **campaign kit** export are proven.

_Avoid_: “Real-time strategy mode”; wall-clock tied to in-world days; auto-run as the only way to reach a sim-detected endpoint; requiring continuous run to deliver increment 3 politics and history.

### World document

Serializable snapshot: **geography seed**, stage parameters, geography **fields**, colonization state (**founding landing**, **colonist settings**, **settlements**, **factions**, **trade routes**, **history log**), derived **culture** summaries. Authoritative in-memory sim state during a session is always **present day** (latest **epoch**). **Campaign kit** export derives from **present day**—repeatable without ending the run. Session survival (page refresh) restores present-day colonization state and **`historyLog`**—not per-epoch snapshot arrays. Extends the existing Pinia/localStorage pattern alongside generation settings; no separate colonization save/load UX.

_Avoid_: “Save file” in UI copy when the artifact is author-facing; PNG-only export as the whole **world**; a redundant **history seed** field; explicit save/load buttons for in-progress colonization; treating export as a terminal sim state; refresh that keeps phase/landing/settings but discards **settlements** or **history log**.

### Campaign kit

Primary GM deliverable: map layers, structured **world document** slice, brief for **present day** (**factions**, **rivalries** with causes, key **settlements**), story hooks (border friction, **strategic resource** pressure, **vassal** defection risk), **reverse-engineering culture** notes per **faction**, and per-**settlement** **trade profile** (what each place wants and supplies for table-side trade play). User-initiated export anytime during `running` once the control exists—including before increment 3 latches and as precaution snapshots before stepping further. Pre-latch kits omit or leave empty politics sections and emphasize **settlements**, founding **history log**, and whatever **trade profiles** exist. Repeatable; export never halts **epoch step**. Each export is a point-in-time snapshot (file download or equivalent)—not a live link back into the session.

_Avoid_: “Lore dump” without causal hooks; politics-only export when economic trade opportunities are omitted; gating export on stability, **equilibrium state**, **political equilibrium**, **year cap**, or increment 3 latch; “final export” implying the run must end; single-export-only UX; past-**epoch** export or **epoch scrubber** time-choice prompts ([ADR 0014](../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md)).

### Settlement trade profile

Per-**settlement** synopsis of wanted vs supplied commodities—structured surplus/deficit per simulated good (grain, fish, **salt**, metals, timber, …) with triad-style headlines in the **campaign kit** UI. Derived from local **resource profile**, **haul-shed**, and active **trade routes**.

_Avoid_: Static flavor text without supply/demand backing; narrative-only profiles without structured fields; duplicating full **economy** simulation in the export blurb.

## Relationships

- **Landmass pipeline → fields before labels**: **scalar fields** (elevation, rainfall, temperature, drainage, salinity) overlap into **biomes** and **resource rasters**; hydrology is derived (erosion, river graph)—not painted first (Dwarf Fortress pattern; see research notes).
- **Landmass → hydrology → Sail overlay**: rivers, lakes, and coast on the final map feed **traversable water**; **meander refine** bridges must appear in **Sail overlay** connectivity, not only in presentation paint ignored by metrics.
- **Landmass → Freshwater availability overlay**: rivers, lakes, coast, and **well-viable** cells share one derive function for **terrain authoring** inspect and colonization **survival triad** freshwater—aligned with **Sail overlay**’s on-demand derivation pattern.
- **Landmass pipeline → logistics pass**: after physical terrain, **ox paradox**, **arable envelope**, **maritime reach**, and **strategic resource** nodes apply—World Builder’s layer on top of DF-style geography.
- **Terrain authoring → Colonize → colonization setup → begin colonization**: user finishes tuning geography, places **founding landing**, sets **colonist settings**, then starts the **colonization phase** clock on a fixed **landmass**.
- **Rejection sampling → validation checks**: failed **population ceiling**, haul corridor, or node presence → regenerate candidate **landmass**; reject reasons inform tuning.
- **Geography seed → world document**: one seed drives terrain generation and colonization RNG; same seed + params + **colonist settings** + **founding landing** → reproducible full run. **Founding landing** is independent of **geography seed** placement on the grid.
- **Named region → culture engine**: **exchange** and **connectivity** pressures often differ by contiguous region cluster, not single-tile **biome**.
- **Landmass → environmental pressure stack**: elevation, hydrology, and **climate** produce movement cost, visibility, connectivity, predictability, survival stress, and **resource profile** inputs.
- **Environmental pressure stack → culture engine**: pressures run **WOAC cycles** that fill **six culture layers** per people; **exchange** modulates isolation vs synthesis.
- **Culture engine → settlement simulation**: **survival strategy** and **resource profile** bias where people cluster (water, arable land, defensible **chokepoints**, junctions).
- **Ox paradox + movement cost → haul-shed**: caps land **trade**; explains **three-day rule** and spacing of **baronies** along **grain circle** routes.
- **Maritime reach → drain city**: sea **haul cost** enables large **population ceiling** off-site; **strategic resource** ports become **power centers**.
- **Settlement + haul → trade route**: routes are viable edges on the movement graph; **chokepoints** attract toll **vassals** and forts.
- **Bulk population → population collapse → population overlay**: each **epoch**, compact parameters (headcounts, claims, weights) resolve on observation to density the map can show; collapse raster is derived, not persisted; **notable figures** and **expeditions** stay tracked outside the bulk model ([ADR 0011](../docs/adr/0011-world-builder-bulk-population-wavefunction-collapse.md)).
- **Trade route + strategic resource → conflict engine**: scarcity creates **obstacles** between **power centers**; **exchange** force drives smuggling and alliance.
- **Supply-chain feudalism → political middle layer**: **vassals** hold nodes on **grain circle** and **trade route** graphs; **conditional loyalty** when logistics shift.
- **Maritime reach → logistics connectivity**: sail sea-lanes link distant **settlements** beyond land **haul-shed** radius—count for **supply-chain independence** negation, **faction** component grouping, and **trade route** proposal alike.
- **Five forces → conflict engine**: same **WOAC** machinery as **culture engine**; **belief** **legitimizes** **power**; **legacy** stores grudges as **rivalry**.
- **History log → legacy → rivalry**: wars and treaties rewrite borders and **faction** wants; present politics read from the log, not freehand borders.
- **Reverse-engineering culture ↔ export**: GM-facing tooltips trace rituals and borders to pressures for table use.
- **Campaign kit export**: brief for **present day**, political hooks, per-**faction** culture notes, per-**settlement** **trade profile** (wants/supplies)—repeatable GM snapshot during `running` (including pre-latch); export never ends the sim. After latch, kit may name the colonial **realm** and its **factions**.
- **Realm → factions**: one **realm** per founding wave; after **supply-chain independence**, multiple **factions** may exist inside that **realm** without dissolving colonial origin.

## Example dialogue

- “This **drain city** isn’t impossible—the **maritime reach** from the delta feeds it; the **arable envelope** on the map is three days upstream.”
- “The pass **chokepoint** explains the **vassal** fort; if we add a lowland road, **conditional loyalty** breaks because the **grain circle** bypasses them.”
- “Run one **WOAC cycle** for the desert **environment** force before naming gods—wellkeepers are a **consequence**, not a aesthetic pick.”
- “**Rivalry** here is trade denial on **salt**, not ‘evil neighbors’—check the **strategic resource** layer.”
- “Change **yield modifier** or **founding landing** and **begin colonization** again—the delta’s still there; only the colony’s trajectory moves.”
- “**Rejection sampling** dropped that map: capital over **population ceiling** with no **maritime reach**.”
- “**Colonize** at the delta mouth—set **three-day haul distance** in **colonist settings**, then **begin colonization**.”

## Landmass constraints (simulation inputs)

Geography is not decorative: **landmass pipeline** stages must emit fields the **culture engine**, **settlement** placement, and **conflict engine** consume. Logistics-first worldbuilding (playlist #05, #15–#18, #13); field-first terrain and rejection pattern informed by [Dwarf Fortress terrain research](./research/dwarf-fortress-terrain-notes.md).

### Pipeline stages (canonical order)

1. **Scalar fields** — elevation, temperature, rainfall (with rain shadow), drainage, salinity.
2. **Derived geography** — **biomes**, erosion, river graph, lakes, coast navigability, mineral and **strategic resource** nodes.
3. **Logistics pass** — **movement cost**, visibility, connectivity, **arable envelope**, **maritime reach**, natural threat zones.
4. **Rejection sampling** — **validation checks**; regenerate on failure.

**Colonization phase** (after **begin colonization**), three increments:

1. **Single-colony survival** — one **settlement**, local resource exploitation within founding **haul-shed**; settlement size growth only.
2. **Exploration and new settlements** — territory expansion, additional **settlements** at logistics nodes.
3. **Economy, politics, and history** — **trade routes**, **factions**, **city-states**, **history log**, **rivalry** (interdependent; one delivery slice). Enters automatically when **supply-chain independence** fires (land **haul-shed** split and/or **drain city** **maritime reach** branch)—either branch sufficient alone.

Within each increment, **culture engine** pressure may apply when regions are engaged; full **WOAC** visibility arrives with increment 3 unless earlier increments prove partial cycles.

Physical **landmass** and **logistics pass** complete during **terrain authoring**; **colonization phase** reuses **geography seed** for simulation RNG.

### Required geographic outputs

- **Movement cost** — slope, barriers, road potential; drives isolation vs **exchange** and **haul-shed** extent.
- **Visibility / cover** — open vs enclosed terrain; drives defensive culture (mobility vs ambush vs **chokepoint** holding).
- **Connectivity** — valleys vs plains vs sealed basins; isolated **cultures** vs harbor **exchange**.
- **Hydrology** — rivers (haul edges, flood predictability), lakes, coast; floodplains tie to **climate** predictability and bureaucracy vs neighbor-trust.
- **Climate bands** — predictability, **survival stress**, **resource cycling** (storable vs perishable vs nomadic follow-the-grass).
- **Resource rasters** — arable soil, timber, metals, **strategic resource** nodes (especially preservation-critical goods like **salt**).
- **Natural threat zones** — predictable vs random hazards (defensible with engineering vs **belief**-driven responses).
- **Maritime navigability** — where **maritime reach** overrides **ox paradox** limits.

### Locale interest (RPG-facing)

Interesting play locations tend to sit where pressures collide:

- **Chokepoints** — passes, straits, fords (forts, toll **vassals**, ambush culture).
- **Haul junctions** — where **grain circle** routes meet rivers or roads (inn, market, **barony** seat).
- **Resource mismatch** — abundance beside scarcity (fertile river delta everyone wants; timber above treeline forcing ingenuity).
- **Drain-city candidates** — coast or river hub inside wide **arable envelope** or long **maritime reach**.
- **Border friction** — narrow **haul-shed** overlap between **factions** (trade denial, **rivalry**).
- **Legacy anchors** — defensible positions whose logistics later failed (ruined fort, ghost **settlement** on a bypassed road).

### Validation checks (world feels “read,” not invented)

Used by **rejection sampling** and **validation advisory**; same role as Dwarf Fortress biome and feature quotas, but logistics-grounded. **Validation advisory** (right panel during **terrain authoring** and setup) shows only colonization-relevant checks—those whose failure would change founding, survival, exploration, logistics, or politics—and may include new rows beyond generation-only quotas. Hydrology sailing checks measure **Sail overlay** connectivity using sail-native report labels—**Sailable water**, **Coastal river access**, **Coast-to-interior sailing path**—not pre-refine graph edge counts or “navigable” wording.

_Avoid_: Rejecting or accepting worlds based on `riverGraph` edge counts when **Sail overlay** shows different connectivity; validation metrics that ignore **meander refine** bridges visible on the final map; legacy “navigable edge” language in user-facing validation rows.

**UI vs schema:** validation and generation-control **labels** use sail-native names (**Sailable water**, **Coastal river access**, **Coast-to-interior sailing path**); internal `enforce*` option keys (e.g. `enforceNavigableRiverQuota`) stay stable for saved settings.

- No **population ceiling** violation: urban nodes fit their **arable envelope** and **haul** mode.
- No impossible capitals: apex **settlements** sit on sea, river, or rich hinterland—not isolated peaks without **maritime reach**.
- **Trade routes** follow low **movement cost** paths; long bulk hauls respect **ox paradox** unless **maritime reach** applies.
- Viable haul corridors exist between arable zones and **drain city** candidates where params expect them.
- **Political middle layer** aligns with **supply-chain feudalism** nodes, not random castles.
- **Strategic resource** scarcity produces explainable **conflict engine** wants (salt wars, timber monopolies).
- Resource-mismatch zones present where params expect interesting friction (fertile delta beside scarcity, rain-shadow dry belt).

**Generation report (hydrology):** user-facing stats use **Sail overlay** metrics (**Sailable water**, **Coastal river access**, **Coast-to-interior sailing path**); legacy graph-edge counts (navigable edges, mouth count, navigable km from centerline graph) drop from the default report.

## Flagged ambiguities

- **Simulation vs presentation hydrology (#358, #365):** resolved by [ADR 0010](../docs/adr/0010-world-builder-sail-overlay-traversability.md)—**Sail overlay** is traversability source of truth; simulation graph demoted for sailing checks.
- **WOAC** spelling: canonical is **WOAC cycle** (**Want** → **obstacle** → **action** → **consequence**). Playlist may say “WAC”; never **WAAC**.
- **Fantasy races** vs **culture**: playlist #14 argues species should diverge in cognition/biology; v1 **culture engine** may assume human-norm peoples unless a separate species layer is added later.
- **Magic / industrial exceptions**: **ox paradox** and **population ceiling** assume pre-industrial logistics; teleportation, flying mounts, or preservation magic need explicit overrides or they break **supply-chain feudalism**.
- **Map-first vs story-first**: playlist #05 warns against pretty maps before need; World Builder generates geography-first for simulation, but export should still answer “why is this port valuable?” like a journey-driven story map.
- **Dwarf Fortress depth vs v1 scope**: DF history is full agent simulation; v1 **history log** may use lighter **epoch** ticks with stored **rivalry** causes—same “simulation log, not authored timeline” pattern, not necessarily DF agent count.
- **DF research vs implementation**: terrain notes are conceptual inspiration for **fields before labels**, hydrology-as-derived-graph, and rejection *pattern*—not a mandate to match DF algorithms (e.g. midpoint-displacement elevation), biomes, fantasy layers (good/evil, savagery), or rejection UX (hundreds of silent retries). **`world-builder/core`** ships in JavaScript with JSDoc (portfolio repo convention), not a separate TypeScript toolchain.
- **User-gated colonization vs DF auto-civ-placement**: DF places civilizations after terrain verification without a player-chosen landing; World Builder uses **colonization setup** (**founding landing** + **colonist settings**) then **begin colonization**. v1 continent is empty until the founding wave (no indigenous peoples).
- **Colonization geography inputs**: resolved (epic cross-cut) — **best-effort** for the full run, not only entry. **Colonize** when the author is satisfied; **validation advisory** informs but does not gate; no second hard gate at **begin colonization**, **epoch step**, or increment 3 latch. Missing layers (e.g. full **movement cost**, **maritime reach**) use heuristics throughout. Crude or odd **faction** / latch outcomes on marginal maps are acceptable author risk—and can be interesting—not a product failure.
- **Validation advisory scope**: resolved (epic cross-cut) — right-panel checks during **terrain authoring** (and setup) are colonization-relevant only; drop rows that never affect colonization; add rows when a geography gap would change colonization outcomes. Confirm-on-**error** still applies only to that colonization-relevant list.
- **Well-viable thresholds**: rainfall, **drainage**, **salinity**, and biome exclusion cutoffs are implementation tuning—shared between **Freshwater availability overlay** and colonization freshwater accounting; not author sliders in v1.
- **Settlement tier thresholds**: absolute population bands (hamlet / village / town / …)—implementation tuning; comparable across **settlements** on one map regardless of local **population ceiling** or age.
- **Population collapse core fraction**: share of **settlement** population pinned at **founding landing** vs arable-weighted hinterland in **haul-shed**—implementation tuning for increment 1 **core + hinterland** model.
- **Notable figure naming**: **landing geography heuristic** + “Dynasty” in v1; **named region** labels when that stage exists may replace or enrich house names.
- **Named regions**: glossary term for planned **derived geography** (contiguous cluster labels)—**not implemented** in the landmass pipeline today; do not depend on region strings for slice B dynasty naming.
- **Terrain lock**: geography hard-frozen at **begin colonization**; **reset colonization** is the only way back to editable terrain—no in-place geography edits while colonization state exists.
- **Increment 3 entry**: resolved — latch on first **epoch** when **supply-chain independence** fires (**land branch**: ≥2 **settlements** with no **haul-shed** overlap, no **road** within **three-day haul distance** budget, and no **maritime reach** / sail sea-lane link; **maritime branch**: founding-type **drain city** at town-tier+ with <50% local **arable envelope** food)—either branch alone; politics emerge gradually after latch.
- **Increment 3 politics**: resolved — **factions** emerge from **logistics connectivity components** (**haul-shed** overlap, **road**, or sail links) over staggered **epochs** after latch; town-tier+ capitals; daughter **vassal** dynasties until **conditional loyalty** breaks. **Maritime peel:** founding-type **drain city** becomes its own **faction** even when still sail/land-reachable inland—not an instant full-realm split on the latch **epoch**.
- **Maritime peel**: resolved — maritime independence peels the **drain city** into its own **faction** / **city-state**; land-branch clustering still treats sail as a unifying link.
- **Simulation length**: no terminal state—user keeps **epoch step**ping in `running` until **reset colonization**; no **equilibrium state**, **political equilibrium**, or **year cap** auto-stop (scrubbed).
- **Increment 3 overlays**: resolved — **faction territory** = member pins + geometric **haul-shed** isochrone fill (**vassals** under liege; contested overlap treatment); visit-status alone does not claim; exclusive calorie-claim cells are not the territory fill. **Trade route** overlay required; **strategic resource** layers reuse terrain; **rivalry** heat deferred to inspect/debug.
- **Faction territory vs hinterland claim**: resolved (epic cross-cut) — political fill uses full geometric isochrones with contested overlap; **survival triad** / **population collapse** keep exclusive nearest-pin claims.
- **Increment 3 trade routes**: resolved — full candidate graph at latch (**roads**, overland **movement cost**, **Sail overlay** / **maritime reach** sea-lanes); activate on complementary **settlement trade profile**; **history log** events block/tax/reopen—do not erase geography-proposed candidates.
- **Increment 3 conflict**: resolved — **pressure ladder**: **rivalry** on concrete **obstacles** (sparse causes); routine **economic contest** per **epoch**; major-war **WOAC** only past intensity threshold; war/treaty entries and **trade route** block/reopen; **rivalry** edges survive peace.
- **Increment 3 vassals**: resolved — **conditional loyalty** fails on logistics break (alternate **road** / **maritime reach**, or surplus independence from liege corridors); defection = major **history log** event, new or joined **faction**, **rivalry** cause; no map-visible **vassal** territory before defection.
- **Increment 3 culture**: resolved — hybrid **WOAC** on milestones only (**faction** emergence, increment 3 latch per component, major-war / **vassal** defection / **city-state** founding); not per-**epoch**, not on embargo or routine **economic contest**.
- **Epoch scrubber**: cut — [ADR 0014](../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md). Increment 3 uses **event feed** at **present day**; **campaign kit** export is **present day** only.
- **Increment 3 exploration**: resolved — **expeditions**, founding, **roads**, and **exploration fog** continue after latch; new sites join origin **faction** as **vassals**—politics and exploration concurrent, not a freeze.
- **Continuous colonization run**: resolved — deferred past increment 3; #394 ships manual **epoch step** + editable **epoch batch** only.
- **Increment 3 history log**: resolved — feed catalog: latch, **faction** emergence, **faction** extinction, **city-state** founding, daughter founding, **settlement** abandonment (**ruin**), **vassal** defection, major war start/end, treaty/peace, embargo-on-**rivalry**; no routine contest, culture **WOAC**, or **expedition** rows.
- **Settlement ruin**: resolved (epic cross-cut) — population 0 keeps the pin as a **ruin** (no claims, no **expeditions**, **history log** abandonment); hinterland frees for living neighbors; not full removal and not zombie claims.
- **Extinct polity**: resolved (epic cross-cut) — **faction** with no living members goes extinct (**history log**); **realm** with only **ruins** stays as colonial memory in `running` (export/**reset colonization** only—no auto-reset, no further exploration/politics progress).
- **Faction territory overlay**: resolved — pins + **haul-shed** fill; **vassals** under liege; contested overlaps; not visit-status claims.
- **Mid-run control**: observe-only for outcomes in v1; **epoch batch** editable mid-run; no rewriting **faction** borders or **history log** events by hand.
- **Population model**: resolved — [ADR 0011](../docs/adr/0011-world-builder-bulk-population-wavefunction-collapse.md); [`docs/POPULATION-MODEL.md`](./docs/POPULATION-MODEL.md). **Bulk population** parameters in superposition + per-**epoch** **population collapse** on observation for **population overlay**; collapse raster derived in memory, not session-persisted; **notable figure** dynasties and **expedition** movement tracked outside the bulk model—WFC-style constraint satisfaction (seeded integer placement on legal land) is the collapse mechanism, not a stand-in for future full agent sim; “wavefunction collapse” is not product UI copy.
- **Increment 2 exploration**: **exploration fog** overlay + auto-dispatched **expeditions**; new **settlements** founded automatically at logistics nodes—one **realm** as sole polity until increment 3.
- **Realm after latch**: resolved (epic cross-cut) — **realm** stays the colonial-origin umbrella (shared founding wave); **factions** are political bodies inside it. Not retired; not 1:1 with the origin **faction**.
- **Expedition dispatch gate**: resolved — eligible from first **epoch step**; per-**settlement** stochastic timing each **epoch**; optional surplus/population bias only, no hard tier or survival-streak prerequisite.
- **Automatic founding gate**: resolved — requires scored **logistics node** **and** local **survival triad** viability on a **provisional claim** (recompute exclusive nearest-pin ownership including the candidate pin; freshwater + non-trivial arable on cells that pin would own); fog may clear without founding when nodes fail viability.
- **Provisional claim at founding**: resolved (epic cross-cut) — daughter-site viability and post-founding claims use the same exclusive nearest-pin rule; do not found on geometric isochrone totals the new pin would lose when claims settle.
- **Annual epoch order**: resolved (epic cross-cut) — network (**expeditions**, founding, **roads**) → claim recompute → **survival triad** → **settlement merge** → **ruin** → **population collapse** → politics (increment 3: latch, **factions**, **trade routes**, **conflict**). **Begin colonization** (#391) creates the founding **settlement** at **epoch** 0; increment 1 (#392) applies **survival triad** once for **epoch** 0 without network/politics phases.
- **Exploration fog semantics**: resolved — visit-status tint only; geography and resource overlays stay readable; toggleable overlay during `running` (and absent during **terrain authoring**).
- **Initial visited territory**: resolved — founding **haul-shed** cleared at **begin colonization** (**epoch** 0); remainder unvisited until **expeditions** extend it.
- **Expedition fog clearing**: resolved — one-cell-wide routed path; terminus disc when a scored **logistics node** is reached (viability pass or fail).
- **Logistics node scoring**: resolved — multi-tag non-exclusive weights; primary type = highest contributor in inspect; five types (**chokepoint**, **haul junction**, **surplus basin**, **refinery**, **drain city**); **drain city** included in increment 2 founding mix when geography supports it.
- **Daughter settlement seed**: resolved — fixed small outpost headcount (implementation constant); global **three-day haul distance** **haul-shed** centered on each new pin.
- **Expedition concurrency**: resolved — one active **expedition** per **settlement**; one dispatch attempt per **settlement** per **epoch** while idle.
- **Settlement haul-shed overlap**: resolved — distinct pins required; geometric **haul-shed** isochrones may overlap in increment 2 (still a land-branch logistics link for **supply-chain independence**).
- **Shared hinterland claim**: resolved (epic cross-cut) — **survival triad** sums (food, timber, **salt**) and **population collapse** hinterland use exclusive cell ownership: nearest **settlement** pin by **travel time**. Geometric overlap does not invent regional calories; **population overlay** does not stack multi-pin density on one cell. Claims recompute every annual **epoch** (including silent years inside an **epoch batch** and **history log** event years)—not frozen at founding. Present-day **primary claim** drives overlays; historical claim maps are not persisted ([ADR 0014](../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md)).
- **Session persistence scope**: resolved (epic cross-cut) — refresh restores present-day colonization state plus **`historyLog`**; no per-epoch snapshot arrays ([ADR 0014](../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md)).
- **Increment 2 history log**: resolved — daughter **settlement** founding entries only; no expedition or rejected-site events.
- **Increment 2 notable figures**: resolved — one dynasty per **settlement** at founding (geography heuristic + “Dynasty”); no **expedition** lead or **vassal** seats until increment 3.
- **Multi-settlement population overlay**: resolved — per-**settlement** **core + hinterland** collapse on claimed cells only; no stacked density from multiple pins on one cell.
- **Settlement count cap**: resolved — no hard cap; dispatch exhausts when all scored **logistics nodes** are founded or rejected; sim does not auto-stop.
- **Rejected logistics nodes**: resolved — once surveyed and failed **survival triad** viability, not re-targeted while terrain is locked.
- **En-route founding**: resolved — evaluate scored **logistics nodes** in path corridor (routed cell + immediate neighbors) in travel order; first viable unscouted node wins.
- **Daughter visit on founding**: resolved — full **haul-shed** becomes visited at automatic founding.
- **Haul-shed shape**: resolved — terrain-aware **travel time** isochrone from **movement cost** + **three-day haul distance** budget (not a circle); setup preview approximates reach for calibration.
- **Routes and exploration**: resolved — [ADR 0012](../docs/adr/0012-world-builder-bearing-based-expedition-routing.md), [ADR 0015](../docs/adr/0015-world-builder-expedition-budget-and-settlement-merge.md); **realm expedition budget** with independent land/maritime pools; **frontier-eligible settlement** gating; three modes (**land expedition**, **inland sail expedition**, **open-sea expedition**); **colonist settings** ranges land **2×**, inland sail **3×**, open-sea **8×**; **routes overlay** mode-specific presentation; bearing-based local steps (no pathfinding toward undiscovered targets); increment 2 **settlement merge** before **ruin**.
- **Expedition duration**: resolved — multi-**epoch** treks; **travel time** budget per **epoch** via local terrain-following steps; ends on founding, blocked, **expedition range** cap, or survey complete; founding checks each step.
- **Increment 2 right panel**: resolved — **sim status** header + **founding chronicle** after **epoch** 0; **validation advisory** only at **epoch** 0.
- **Grid scale**: no intrinsic km-per-cell; **three-day haul distance** and related **travel time** metrics are author-calibrated in **colonist settings** until map scale is modeled.
- **Colonization phase states**: `terrain` → `setup` → `running` until **reset colonization** returns to `terrain`. No **`stopped`** phase (scrubbed). **Colonization setup** (#391) ships the full transition through `running` with document fields initialized; increment 1 (#392) plugs in **epoch** ticks without adding interim phases.
- **Founding settlement at commit**: resolved (epic cross-cut) — **begin colonization** (#391) creates the founding **settlement** at **epoch** 0 (visit status for founding **haul-shed**, founding **dynasty** when slice B lands) before any **epoch step**, recording configured **starting population** and a founding **history log** entry. Empty `settlements` is not a post-commit state. **Survival triad** resolve (clamp to **population ceiling**, freshwater non-sustain) is deferred to increment 1 (#392); until then **epoch** 0 reflects configured headcount honestly in present-day state.
- **Panel navigation actions**: left panel = backward / abandon (red, full width at top); right panel = forward / commit (green, full width at top). Do not put phase labels or a shared top toolbar for these actions.
- **Colonization setup chrome**: terrain authoring panels fully hidden; left panel → **Back to terrain** (red) then **colonist settings**; right panel → **Begin colonization** (green) then **validation advisory** (warnings/errors). Same panel real estate as terrain phase, different content.
- **Colonization terrain chrome**: left panel → generation controls; right panel → **Colonize** (green, full width above advisory) then **validation advisory** / generation report.
- **Colonization running chrome**: left panel → **Reset colonization** (red) then **colonist settings** (read-only except permitted mid-run edits such as **epoch batch**); right panel → **validation advisory** at **epoch** 0 only, then **sim status** + **founding chronicle** (increment 2) → **event feed** (increment 3). **Campaign kit** export follows the same right-panel forward pattern when it ships. Terrain generation controls hidden; map overlay toggles remain for inspect.
- **Session persistence**: resolved (epic cross-cut) — refresh restores the full colonization run: phase, **founding landing**, **colonist settings**, present-day sim state (**epoch**, **settlements**, **history log**, **expeditions**, **route segments**, **factions**, **trade routes**, …). Setup-only fields are not enough once `running`. Generation settings live on the Pinia session path; while terrain is locked (`setup` / `running`), the generated **landmass** is also cached in IndexedDB so refresh restores geography without re-running the **landmass pipeline**. Cache is keyed by **geography seed** + generation options and cleared on **Back to terrain**, **reset colonization**, or terrain regen. If the cache is missing or mismatched, fall back to silent **landmass** regen then rehydrate. Not a separate colonization save/load UX. **Campaign kit** export remains user-initiated during `running`, repeatable, non-terminal ([ADR 0014](../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md)).
- **Campaign kit pre-latch**: resolved (epic cross-cut) — export available anytime during `running` once the control exists, including before **supply-chain independence**; pre-latch kits omit or empty politics sections.
- **Colonization RNG**: no separate **history seed**—**geography seed** seeds colonization stochastic rolls; not author-facing in **colonist settings**.
- **Colonization time controls**: first release ships manual **epoch step** with default **epoch batch** 50 (author-adjustable 1–100); **continuous colonization run** deferred.
