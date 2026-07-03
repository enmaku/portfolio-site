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

Second product phase: user completes **colonization setup**, then **begin colonization** runs annual **epoch** ticks. Delivered in three product increments—**single-colony survival**, then **exploration and new settlements**, then **economy, politics, and history** together. Hands-off simulation after initial conditions: user sets geography and **colonist settings**, then the sim advances with minimal intervention—observe and **epoch step** (or later **epoch batch** controls); no mid-run outcome edits in v1. No fixed or terminal run endpoint—the user keeps stepping **epochs** as long as they like; “present day” for **campaign kit** export is a subjective call, not a sim state change. In `running` phase: left panel keeps **colonist settings** (read-only except permitted mid-run tweaks such as **epoch batch**); right panel shows **validation advisory** at **epoch** 0 only, then increment 2+ **sim status** ( **epoch**, **settlement** count, active **expeditions**, frontier exhaustion) plus a minimal **founding chronicle** listing **history log** entries—full **epoch scrubber** and filterable **event feed** arrive in increment 3. **Reset colonization** lives in persistent chrome, not the left panel. Terrain generation controls stay fully hidden; map overlay toggles remain for reading geography.

_Avoid_: “History sim” alone when founding, expansion, and present-day structure are all meant; restarting terrain pipeline silently mid-colonization; requiring user unlock for core **faction** / **trade route** behavior once thresholds fire; swapping the full panel layout again at increment 1; hiding read-only resource overlays during the run; auto-stop or terminal freeze on **equilibrium state**, **political equilibrium**, or **stop colonization** (scrubbed).

### Single-colony survival

First colonization increment: one **founding landing**, one growing **settlement**—no exploration, no additional **settlements**. Simulation tracks a **survival triad** within the founding **haul-shed** (**three-day haul distance** **travel time** budget from the pin): food ( **arable envelope** ), freshwater, and a fuel/shelter proxy from local biomes inside that zone—**salt**, metals, and inter-**settlement** trade deferred until increment 1 is proven (**strategic resource** preservation layer added before increment 1 is considered complete). **Population collapse** distributes bulk population across cells in the same **haul-shed**; **settlement tier** stays a single node at the pin. Territorial expansion is settlement size only, not map claim. No sim-detected endpoint—the user keeps stepping **epochs** indefinitely.

_Avoid_: “Phase 1 worldgen”; conflating with **terrain authoring**; multi-**settlement** maps in the first colonization test slice; full **resource profile** accounting before the survival triad works; **equilibrium state** as a completion gate (scrubbed).

### Epoch batch

Number of in-world years each **epoch step** advances—stored in **colonist settings**, editable mid-run. First release defaults to 1 (one year per step for causality debugging); target UX defaults to ~100 with author adjustment. Internal tick semantics stay annual—batching applies N sequential **epoch** ticks per control action.

_Avoid_: “Speed slider” that changes tick semantics; sub-year **epochs** unless explicitly modeled; **year cap** disguised as batch size.

### Exploration and new settlements

Second colonization increment: **exploration fog** overlay clears along **expedition** paths; additional **settlements** founded automatically when an **expedition** reaches a cell that is both a scored **logistics node** and locally viable under **survival triad** rules (freshwater hard gate + non-trivial arable on the site’s **provisional claim**—claims recomputed as if the new pin already exists). Paths may clear fog without founding if nodes fail viability. **Expeditions** dispatch automatically with stochastic timing from each **settlement** in one realm (not independent **city-states** yet). New **settlement** pins must differ from all existing pins; geometric **haul-shed** isochrones may overlap (a logistics link until increment 3 **supply-chain independence**), but **survival triad** and **population collapse** use exclusive nearest-pin cell claims—no shared calories. No hard cap on **settlement** count—founding stays automatic for every viable unscouted node—but dispatch rolls taper naturally once all scored **logistics nodes** are founded or exhausted (surveyed and failed viability). Still before full **trade route**, **faction**, and **history log** interdependence.

_Avoid_: “Expansion pack” naming; treating as optional when it is the planned second test gate; **city-state** independence before increment 3; requiring user confirmation per new **settlement** in hands-off mode; founding at high-scored nodes that fail freshwater or food viability; rejecting founding solely because **haul-shed** regions overlap another **settlement**; arbitrary maximum **settlement** count; auto-stop or terminal phase when the frontier is exhausted—**epoch step** and existing **settlement** growth continue.

### Colonize

User action that ends **terrain authoring** and opens **colonization setup**: place the **founding landing**, configure **colonist settings**, then **begin colonization** to start the clock. Available once a **landmass** exists to work with—not gated on **validation checks** passing. **Validation advisory** surfaces errors and warnings first; the user may proceed anyway. Colonization reads whatever geography layers exist and fills gaps with documented heuristics for the entire run—full **logistics pass** is not a hard gate at entry or later. Odd or crude politics on a warned map are on the author.

_Avoid_: “Generate world” when only people-layer simulation is starting; blocking **Colonize** until every check is green; hiding failed checks when the user opts in; silent failure when a layer is missing instead of heuristic fallback; a second completeness gate once `running` or at increment 3 latch.

### Colonization setup

Interactive step between **Colonize** and **begin colonization**: user places the **founding landing**, edits **colonist settings** (homeland flavor, era logistics), and reviews geography. Map time is frozen; no **settlements** or **epoch** ticks yet. **Terrain authoring** controls are fully hidden—not merely disabled; the left and right chrome panels show **colonist settings** and **validation advisory** (warnings/errors) respectively. **Begin colonization** enables once a valid **founding landing** exists—all **colonist settings** already hold defaults in the pane. User may return to **terrain authoring** until **begin colonization**—all setup progress is discarded on return (landing pin, settings edits); no partial-state resume.

_Avoid_: “Pre-sim” in UI copy; conflating with **terrain authoring** parameter panels; saving colonization setup drafts across a terrain return; indeterminate colonist controls; leaving terrain sliders visible in setup.

### Colonist settings

Configuration during **colonization setup** for the founding wave. Pane ships in **colonization setup** (#391): **three-day haul distance** (scale calibration), **homeland flavor** (preset list + optional notes for **landing culture snapshot**), **starting population**, **yield modifier** (marginal / typical / bountiful **arable envelope** interpretation), and **epoch batch** (years advanced per **epoch step**—default 1 in first release, target ~100 configurable in later UX). Every field has a concrete default—sliders and controls are never indeterminate. **Begin colonization** enables once a valid **founding landing** is placed; unset-looking controls still carry defaults. Trade, diplomacy, and expansion temperament knobs wait for later increments. No author-facing RNG seed—colonization reuses **geography seed**. No **year cap** or auto-stop—the user keeps stepping **epochs** indefinitely.

_Avoid_: “Civ picker” that implies pre-existing on-map peoples; “Difficulty” sliders without geographic meaning; indeterminate or empty UI state for colonist controls; a separate **history seed** or **simulation seed** in the setup pane; **year cap** as max **epochs** before auto-stop; settings that only apply to increment 3 **faction** play in the first test slice.

### Begin colonization

User action that commits **colonization setup** and enters the **colonization phase** `running` state—terrain hard-locked, **landing culture snapshot** written, **epoch** initialized (0), founding **settlement** created at the **founding landing**, founding **haul-shed** marked visited, and one founding **history log** entry (landing, **colonist settings** summary, founding **dynasty** when slice B lands). At commit, **survival triad** resolves once: **starting population** is clamped to **population ceiling**, freshwater failure marks non-sustain, and **population collapse** / tier reflect that honest **epoch** 0 state—marginal landings may already be at cap or in decline. Annual **epoch** ticks and **epoch step** arrive with increment 1; until then the UI stays in colonization mode with time controls inert, but the founding node is already real and inspectable. The run stays in `running` until **reset colonization**—no sim-detected endpoint, terminal freeze, or export gate.

_Avoid_: “Play” / “Run” without colonization context; auto-starting simulation when the **founding landing** is placed; silent terrain edits mid-run; auto-stop on **equilibrium state**, **political equilibrium**, or **year cap**; a fourth “ready” phase between setup and running; **`stopped`** phase that halts **epoch step** (scrubbed); deferring the founding **settlement** until the first **epoch step**; showing unclamped **starting population** at **epoch** 0 when the ceiling is lower; blocking **begin colonization** solely because the landing is marginal.

### Reset colonization

Explicit user action that abandons the colonization run entirely: wipes colonization state (**founding landing**, **colonist settings**, **epoch**, **settlements**, **history log**, …), returns phase to `terrain`, and unlocks geography editing. Always available once **begin colonization** has committed—including at **epoch** 0. One confirm step; no partial colonization resume. The only way back to **terrain authoring** from `running`.

_Avoid_: “New world” as the only escape hatch; preserving sim progress across a reset; different reset rules before vs after the first **epoch** tick; conflating with **campaign kit** export (export does not end the run).

### Founding landing

Map cell where the first colonizing boat makes shore—the seed **settlement** and expansion origin for one founding wave. Chosen by the user during **colonization setup**; must be **Sail overlay**-reachable coast or river mouth. Invalid cells (inland, non-sailable shore) are not selectable—the map shows a “no” cursor like other disabled controls, without error copy. During setup, a single persistent map marker shows the chosen cell, with a live **haul-shed** reach preview centered on the pin (**three-day haul distance** calibration—isochrone when **movement cost** exists, approximate circle under heuristics); the preview rescales as the slider moves. Clicking another valid cell moves the pin and preview. The marker and preview persist in `running` as read-only reference at the **founding landing**.

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

### Expedition

An outbound trek from a **settlement** that advances **exploration fog**, surveys **logistics nodes**, and may lead to a new **settlement** site. Dispatched automatically with stochastic timing per sending **settlement** each **epoch**—eligible from the first **epoch step** after **begin colonization** (no hard population or **settlement tier** gate). Dispatch probability may rise with population and food surplus but never blocks the first roll. At most **one active expedition per settlement**; a new dispatch roll applies only when that **settlement** has no trek in progress (one attempt per **settlement** per **epoch** while idle). An in-progress **expedition** persists across **epoch** steps, advancing by a **travel time** budget each **epoch** (weighted by **movement cost** along the route—uphill slower than downhill, **road** faster than wilderness) until it completes, founds, or fails at an exhausted node. Each dispatch picks a stochastic **exploration target** (direction bias toward an unscouted scored node)—not a blind commitment to found there. **Mode** follows geography: overland **expeditions** route across **movement cost** (terrain-hugging paths—not straight lines); each dispatch picks land vs **sail expedition** automatically by lowest **travel time** to the stochastic target (**Sail overlay** when boat is faster, overland when not, including mixed treks with portage). While moving, visit status extends along the routed path (one cell wide through previously unvisited cells). **Scored logistics nodes** in the path corridor (routed cell plus immediate neighbors) are evaluated for founding viability in **travel order**—first viable unscouted node wins. When a viable node is found overland, the **expedition** path persists as an initial **road** to the new **settlement**. When the party reaches a scored **logistics node** (en route or at terminus), that site clears a local patch (disc around the cell) whether or not founding succeeds—failed viability still records “we’ve surveyed here”; exhausted rejected nodes are not re-targeted while terrain remains locked.

_Avoid_: “Scout unit” as schema keys; player micro of every path in increment 2 unless a later mode adds it; a minimum-survival **epoch** count or tier threshold before any expedition can dispatch; wide corridor clearing that reveals whole regions per step; leaving a reached but rejected node visually unvisited; multiple concurrent treks from the same **settlement**; realm-wide expedition caps unrelated to per-site agency; destination-only founding checks that ignore viable **logistics nodes** along the march; return-home treks that discard en-route survey value; straight-line routing that ignores **movement cost**; overland-only dispatch when **Sail overlay** offers a shorter legal path; founding overland without recording the path as **road**.

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

### Homeland flavor

**Colonist settings** input describing where the founding wave came from before they met the **landmass**. Author picks one preset from a fixed list (e.g. maritime traders, highland clans, river-valley farmers) plus optional free-text notes. Default preset applies on entry; notes may be empty. Feeds the **landing culture snapshot** at **begin colonization** together with the **environmental pressure stack** at the **founding landing**—not a full **culture engine** run.

_Avoid_: “Civ picker” implying pre-existing on-map peoples; open-ended culture without a preset anchor; structured toggle mini-forms in v1 when presets + notes suffice.

### Landing culture snapshot

One-time **culture** output at **begin colonization**: compressed summary from **homeland flavor** (preset + notes) plus **environmental pressure stack** at the **founding landing**—readable flavor, not annual **WOAC** drift. Used in **single-colony survival**; full **culture engine** cycles deferred to later increments.

_Avoid_: “Culture sheet” checklist; treating the snapshot as the full **six culture layers** simulation; rerolling culture every **epoch** in increment 1.

### Culture engine

Causality-driven framework for generating **cultures**: **environmental pressures** and **five forces** run **WOAC cycles** that emit **culture layers**—not aesthetic-first trait picking. In **single-colony survival**, only a **landing culture snapshot** runs. In increment 3, **hybrid** mode—**WOAC** only on milestones: each **faction** emergence; the increment 3 latch **epoch** (once per nascent **logistics connectivity component**); major **history log** events (major-war outcomes, **vassal** defection, **city-state** founding). Embargo and routine **economic contest** do not reroll culture. Milestone output updates that **faction**’s culture summary for **campaign kit** **reverse-engineering culture** notes.

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

Region where delivery still pays after **ox paradox** and **movement cost**—not a geometric circle. For each **settlement**, the **haul-shed** is the terrain-aware reachable zone: cells whose **travel time** from the pin stays within the **three-day haul distance** budget from **colonist settings**, weighted by slope and surface (uphill costs more than downhill; **road** cells cost less than open wilderness). **Colonization setup** may show an approximate reach preview on the map (isochrone when **movement cost** exists; circle fallback under best-effort heuristics) so authors calibrate scale—simulation accounting uses the terrain-aware region. Local **survival triad**, **population collapse**, and visit status at founding use this boundary. Isochrones may overlap geometrically; for food, timber, **salt**, and other summed **survival triad** inputs, each cell is claimed by at most one **settlement**—the nearest pin by **travel time** (primary claim). Claims recompute every annual **epoch** from that year’s movement graph (including new **roads**, founding, and other network-changing **history log** events), so hinterland ownership can shift when corridors or pins change—including in silent years inside an **epoch batch**. Each **committed tip** (step boundaries and **history log** event years) carries that year’s claim map for **epoch scrubber** / **campaign kit**; scrubbing never paints present-day claims onto a past year.

_Avoid_: “Radius” in miles only without calibration; fixed pixels-per-day baked into the **landmass** without author-facing scale; treating the setup preview shape as the simulation boundary when **movement cost** is available; ignoring **road** travel bonuses inside the reachable zone; double-counting shared cells’ arable or timber into every overlapping **settlement**’s ceiling; freezing calorie ownership at founding while **roads** reshape **travel time**; scrubber tips that omit claim state for event years; showing present-day hinterland claims while viewing a past **epoch**.

### Three-day rule

Rule of thumb: beyond ~three days' **travel time** by cart, bulk food **haul** often fails economically—not tradition, arithmetic. In v1 the distance implied by “three days” is set in **colonist settings** (calibrated **haul-shed** anchor) because the **landmass** grid has no intrinsic real-world scale.

_Avoid_: Stating distances in miles/km alone for RPG prep; “two weeks north” without consistency; assuming one global real-world scale per grid cell without author calibration.

### Travel time

Primary spatial measure for play and simulation—“three days on horseback” beats raw distance.

_Avoid_: “Hexes” in domain language unless the product explicitly uses a hex grid.

### Movement cost

Energy or time to cross terrain (slope, swamp, surface quality); high cost → isolation, local self-sufficiency; low cost → **exchange** and blended **cultures**. Drives terrain-aware **haul-shed** isochrones, **expedition** routing, and **trade route** viability. Uphill segments cost more than downhill along the same path.

_Avoid_: “Difficult terrain” without graph weights; uniform plains with no connectivity story; Euclidean distance substituting for **travel time** in **haul-shed** or **expedition** pathing.

### Road

Persisted overland link on the **world document**—initial **colonization phase** roads come from successful overland **expedition** path segments when a new **settlement** is founded (the march becomes the first road to that site). **Sail expedition** legs do not create **roads**—they may seed increment 3 **trade route** / sea-lane geometry later. Portage: only the overland portion of a mixed trek persists as **road**. Later increments may add roads from **trade route** activation and logistics pressure. **Road** cells apply a **movement cost** multiplier (faster/easier **haul** than open wilderness) for **travel time**, **haul-shed** reach, and routing. Map-visible toggleable overlay when increment 2 ships **road** geometry.

_Avoid_: User-drawn roads in hands-off v1; decorative lines without **movement cost** effect; treating **trade route** sea lanes as **road**; erasing founding paths that did not result in a **settlement**; **road** segments from pure **Sail overlay** travel.

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

A persisted population node (hamlet to **drain city**) whose tier and role should be justified by **arable envelope**, **chokepoint**, **strategic resource**, or **trade route**—not random dots. Exposes tier label and population count on inspect; size constrained by local **population ceiling** in **single-colony survival**. The founding **settlement** is created at **begin colonization** (**epoch** 0) from **starting population** in **colonist settings**, then immediately resolved through **survival triad** (clamp to **population ceiling**, freshwater non-sustain)—not on the first **epoch step**, and not left as an impossible overshoot at commit. Population changes each later **epoch** from food surplus (production minus consumption)—growth when surplus is positive, stall at balance, decline when negative. Daughter **settlements** founded in increment 2 start at a fixed small outpost headcount (implementation-tuned constant, below founding `startingPopulation`) and use the same global **three-day haul distance** from **colonist settings** for their local **haul-shed**—centered on the new pin, not the **founding landing**. At population 0 the pin remains a **ruin**: no calorie claims, no **expeditions**, still visible for **history log** / **faction** memory; hinterland frees for living neighbors on the next claim recompute; active **trade routes** to the site deactivate (candidates may remain). A **history log** abandonment records the failure. Ruins are not fully removed and do not keep zombie claims.

_Avoid_: “City” / “town” labels without simulation backing; one capital per kingdom by default; tier without backing population accounting; fixed per-**epoch** headcount increments divorced from **survival triad** production; reusing full founding `startingPopulation` for every daughter site; per-**settlement** **three-day haul distance** knobs in increment 2; empty **settlements** at **epoch** 0 after commit; deleting failed sites with no map memory; zero-population pins that still own hinterland or dispatch **expeditions**.

### Settlement tier

RPG-facing size band for a **settlement** from **absolute population count**—hamlet, village, town, and higher bands use fixed headcount thresholds (concrete numbers tuned in implementation), not fractions of local **population ceiling**. A **town** is big in absolute terms; a newer **settlement** below its ceiling but above town threshold is still a town, not a **hamlet**. Primary label on the map; inspect pairs tier with raw population count. **Population ceiling** caps growth; tier reflects how large the **settlement** has actually become.

_Avoid_: “Level” in domain language; ceiling-relative tier (e.g. “60% of local cap = town”)—mislabels large young **settlements** smaller than older neighbors; tier divorced from population accounting.

### Population overlay

Map heatmap of where people actually are after each **epoch**'s **population collapse**—bulk population density, not just **settlement** pin dots. Each **settlement** runs a **core + hinterland** collapse on its claimed cells: a fixed fraction at the pin (urban cluster) and the remainder spread across claimed hinterland weighted by arable productivity. Because claims are exclusive (nearest pin by **travel time**), cells do not stack density from multiple **settlements**. Each pin’s total population still matches that **settlement**’s headcount. The pin carries **settlement tier** and total population; the overlay shows spatial spread.

_Avoid_: “People layer” when only **settlement** markers are shown; static density painted by hand; all population on one cell when **haul-shed** rural spread is intended; ceiling-relative density that ignores where arable lies; double-counting people on cells claimed by only one pin; realm-wide single collapse before increment 3 needs it.

### Bulk population

The vast majority of people not simulated as individuals—held as regional parameters (density, distribution constraints) until **population collapse** each **epoch**. In increment 1, total bulk count tracks the founding **settlement** population; **epoch** delta follows food surplus against **population ceiling** caps.

_Avoid_: “NPCs”; census lists for every farmer; agent simulation of every person in v1; population growth by fixed schedule ignoring **survival triad** surplus.

### Population collapse

Once per **epoch**, resolve bulk population parameters into a concrete spatial distribution for the **population overlay** and **settlement** totals—inspired by wavefunction-collapse-style constraint satisfaction (exact algorithm TBD). In increment 1, uses **core + hinterland** weighting inside the founding **haul-shed**. Deterministic from **geography seed** + **colonist settings** + **founding landing** + sim state. The canonical “where people are this year” observation.

_Avoid_: “Render pass” alone when simulation state is meant; collapsing mid-epoch for gameplay sub-ticks unless explicitly modeled; spatial output that disagrees with **settlement** pin population total.

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

_Avoid_: “Race = faction”; static good/evil teams; 1:1 **faction** ↔ single hamlet without territorial claims; land-only clustering that ignores sail ties between distant ports; one **faction** per **settlement** on the latch **epoch**; **road**-only graphs when **maritime reach** still links the **realm**; freezing exploration when increment 3 latches; maritime latch with no **faction** split while the **drain city** stays sail-linked.

### City-state

A **faction** whose capital **settlement** has reached sovereign town-tier or higher—an urban polity with its own **grain circle** or **maritime reach** dependence, not merely a fort on the frontier.

_Avoid_: “Kingdom” when only one city is sovereign; **city-state** before increment 3 independence; labeling every **settlement** a **city-state**.

### Rivalry

Directed political tension between **factions** with stored causes—for GM-readable hooks. Edges form sparsely when a concrete **obstacle** appears (embargo, **chokepoint** contest, succession claim)—not for every adjacent **faction** pair by default. Causes record on creation or intensification across: **resource** (monopoly, embargo), **logistics** (**chokepoint**, **grain circle**, sea-lane), **territory** (border, succession), **legacy** (war, treaty), and **belief** (legitimacy, schism). One cause type per creation/intensification event. Edges persist through peace; causes accumulate.

_Avoid_: “They hate each other”; **rivalry** without **legacy** or resource **obstacle**; logging every minor insult; auto-**rivalry** for every neighbor or active **trade route** alone.

### History log

Ordered **epochs** and events that feed **legacy** and reshape borders. Browsable in-app via **epoch scrubber** and filterable **event feed** that jumps to map locations. Each event year is a **committed tip** for scrubber and **campaign kit** (in addition to **epoch step** boundaries). **Epoch** 0: one founding entry at **begin colonization** (#391). Increment 2 (#393): one structured entry per daughter **settlement** founded (**epoch**, site, primary **logistics node** type, originating **settlement**)—no expedition lifecycle or rejected-site entries.

Increment 3 **event feed** catalog (structured fields, not prose): increment 3 latch; **faction** emergence; **faction** extinction; **city-state** founding; daughter **settlement** founding; **settlement** abandonment (population reached 0 → **ruin**); **vassal** defection; major war start/end; treaty/peace; embargo when it creates or intensifies **rivalry**. Feed filters map to these kinds. Do **not** log routine **economic contest** ticks, culture **WOAC** internals, or **expedition** lifecycle.

_Avoid_: “Timeline” as flavor-only; events that don’t touch **power centers**; export-only log with no in-app investigation; deferring the founding entry until the first **epoch step** when **epoch** 0 should record the commit; logging every **expedition** departure or failed-viability survey; per-**epoch** contest summaries or culture-cycle rows in the feed.

### Epoch scrubber

Increment 3 investigation control: the author selects a past **epoch** and the map / **faction territory** / **trade route** presentation shows a **read-only snapshot** of that year. Live sim state—“present day” / simulation tip—stays at the latest **epoch**; scrubbing does not rewind or discard future ticks. Paired with the filterable **event feed**: selecting an event jumps the scrubber to that **epoch** and may focus involved **settlements**. **Epoch step** and **reset colonization** always act on present day, not the scrubbed year. Replaces increment 2 **founding chronicle**. Session survival restores scrubber-reachable past **epochs**—refresh does not collapse investigation to present day only. Scrubber and **campaign kit** targets are **committed tips**: **epoch** 0 at **begin colonization**; each year that was present day after an **epoch step**; and any year that carries a **history log** event—not every silent annual tick inside an **epoch batch**. The **event feed** jumps to the event’s own **epoch** (always a tip). Each tip includes that year’s hinterland **primary claim** map (claims recompute every annual tick, so event years reflect network changes from that year’s events).

_Avoid_: Treating the scrubber as authoritative sim rewind; branching timelines from **epoch step** while scrubbed; conflating scrubbed year with present day when they differ; session restore that forgets past **epochs** the author had already simulated; requiring inspectable snapshots for every in-world year inside a multi-year **epoch batch**; feed jumps to a nearest tip that is not the event year; event-year tips without claim state when founding or **roads** changed that year.

### Epoch

Discrete simulation tick for **colonization phase** and **history log**—one in-world **year** per tick in v1 (harvest cycles, haul economics, and **history log** entries align to annual steps). First release advances one **epoch** per **epoch step**; target UX advances **epoch batch** years per step (~100 default). No auto-stop—the user keeps stepping indefinitely. **Present day** is the latest simulated **epoch** (simulation tip), not whichever year the **epoch scrubber** is displaying and not “whatever the map is showing” while scrubbed. Within each annual tick, order is fixed: **network** (**expeditions**, founding, **roads**) → hinterland **primary claim** recompute → **survival triad** / **population collapse** → politics (**supply-chain independence** latch, **factions**, **trade routes**, **conflict engine**). **History log** events for that year are written as their causes complete; the year’s **committed tip** (when retained) reflects the post-politics state.

_Avoid_: “Year 1042” precision without source events; real-time wall-clock simulation in v1 copy; conflating with **terrain authoring** (no **epochs** until **begin colonization**); generational or seasonal ticks unless explicitly switched in **colonist settings**; **equilibrium state** or **political equilibrium** as stop triggers (scrubbed); equating scrubber selection or map display with present day; evaluating latch on a pre-founding network; running survival before claims settle for new pins.

### Epoch step

Manual advance during **colonization phase**—applies **epoch batch** sequential annual ticks (1 in first release, configurable later). Primary time control for inspecting causality; no fixed endpoint. Always advances from present day, even if the **epoch scrubber** is on a past year.

_Avoid_: “Turn” in domain language when **epoch** is the persisted unit; sub-epoch micro-ticks in user-facing copy unless explicitly modeled; implying the sim should halt when resources or population stabilize; advancing from the scrubbed year and discarding the future.

### Founding chronicle

Minimal right-panel list during increment 2 **colonization phase** `running`: chronological **history log** entries (founding wave + each daughter **settlement** founding)—structured fields, not prose narrative. Paired with compact **sim status** (**epoch**, **settlement** count, active **expeditions**, frontier exhaustion). Replaced by full **epoch scrubber** and filterable **event feed** in increment 3—not a separate persisted artifact.

_Avoid_: “Event log” as schema keys; replaying validation advisory after **epoch** 0; building scrubber/filter UX in increment 2; user-facing prose paragraphs in the chronicle rows.

### Continuous colonization run

Optional future UX: simulation auto-applies **epoch batch** ticks with pause between batches—same annual tick semantics as **epoch step**, not a different time model. Deferred past increment 3 (#394)—increment 3 ships manual **epoch step** and editable **epoch batch** only; continuous run waits until stepping, **epoch scrubber**, and **campaign kit** export are proven.

_Avoid_: “Real-time strategy mode”; wall-clock tied to in-world days; auto-run as the only way to reach a sim-detected endpoint; requiring continuous run to deliver increment 3 politics and history.

### World document

Serializable snapshot: **geography seed**, stage parameters, geography **fields**, colonization state (**founding landing**, **colonist settings**, **settlements**, **factions**, **trade routes**, **history log**), derived **culture** summaries. Authoritative in-memory sim state during a session is always present day (latest **epoch**). **Campaign kit** export may derive from present day or a scrubbed past **epoch**—repeatable without ending the run. Session survival (page refresh) restores the full colonization run—not only setup fields: present day **and** enough temporal history that **epoch scrubber** and **campaign kit** can still target any past **epoch** reached before refresh. Extends the existing Pinia/localStorage pattern alongside generation settings; no separate colonization save/load UX.

_Avoid_: “Save file” in UI copy when the artifact is author-facing; PNG-only export as the whole **world**; a redundant **history seed** field; explicit save/load buttons for in-progress colonization; treating export as a terminal sim state; refresh that keeps phase/landing/settings but discards **settlements**, **history log**, or scrubber-reachable past **epochs**.

### Campaign kit

Primary GM deliverable: map layers, structured **world document** slice, brief for the chosen export **epoch** (**factions**, **rivalries** with causes, key **settlements**), story hooks (border friction, **strategic resource** pressure, **vassal** defection risk), **reverse-engineering culture** notes per **faction**, and per-**settlement** **trade profile** (what each place wants and supplies for table-side trade play). User-initiated export anytime during `running` once the control exists—including before increment 3 latches and as precaution snapshots before stepping further. Pre-latch kits omit or leave empty politics sections and emphasize **settlements**, founding **history log**, and whatever **trade profiles** exist. Repeatable; export never halts **epoch step**. Each export is a point-in-time snapshot (file download or equivalent)—not a live link back into the session. Exportable **epochs** match **epoch scrubber** committed tips (**epoch** 0, each post-**epoch step** present day, and any **history log** event year)—not arbitrary quiet intra-batch years.

When the **epoch scrubber** is on present day, export uses that tip with no extra prompt. When the scrubber is on a past **epoch**, export asks whether the kit should cover the **currently selected time** (scrubbed year) or **simulation end time** (present day / latest simulated **epoch**).

_Avoid_: “Lore dump” without causal hooks; politics-only export when economic trade opportunities are omitted; gating export on stability, **equilibrium state**, **political equilibrium**, **year cap**, or increment 3 latch (scrubbed); “final export” implying the run must end; single-export-only UX; silently exporting present day while the author is viewing a past year (or the reverse) without asking; exporting a year that was never a committed tip.

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
- **Bulk population → population collapse → population overlay**: each **epoch**, parameters resolve to density the map can show; **notable figures** stay tracked outside the bulk model.
- **Trade route + strategic resource → conflict engine**: scarcity creates **obstacles** between **power centers**; **exchange** force drives smuggling and alliance.
- **Supply-chain feudalism → political middle layer**: **vassals** hold nodes on **grain circle** and **trade route** graphs; **conditional loyalty** when logistics shift.
- **Maritime reach → logistics connectivity**: sail sea-lanes link distant **settlements** beyond land **haul-shed** radius—count for **supply-chain independence** negation, **faction** component grouping, and **trade route** proposal alike.
- **Five forces → conflict engine**: same **WOAC** machinery as **culture engine**; **belief** **legitimizes** **power**; **legacy** stores grudges as **rivalry**.
- **History log → legacy → rivalry**: wars and treaties rewrite borders and **faction** wants; present politics read from the log, not freehand borders.
- **Reverse-engineering culture ↔ export**: GM-facing tooltips trace rituals and borders to pressures for table use.
- **Campaign kit export**: brief for chosen export **epoch**, political hooks, per-**faction** culture notes, per-**settlement** **trade profile** (wants/supplies)—repeatable GM snapshot during `running` (including pre-latch); export never ends the sim. When **epoch scrubber** is off present day, ask **currently selected time** vs **simulation end time**. After latch, kit may name the colonial **realm** and its **factions**.
- **Realm → factions**: one **realm** per founding wave; after **supply-chain independence**, multiple **factions** may exist inside that **realm** without dissolving colonial origin.

## Example dialogue

- “This **drain city** isn’t impossible—the **maritime reach** from the delta feeds it; the **arable envelope** on the map is three days upstream.”
- “The pass **chokepoint** explains the **vassal** fort; if we add a lowland road, **conditional loyalty** breaks because the **grain circle** bypasses them.”
- “Run one **WOAC cycle** for the desert **environment** force before naming gods—wellkeepers are a **consequence**, not a aesthetic pick.”
- “**Rivalry** here is trade denial on **salt**, not ‘evil neighbors’—check the **strategic resource** layer.”
- “Change **homeland flavor** or **yield modifier** and **begin colonization** again—the delta’s still there; only the colony’s trajectory moves.”
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
- **Epoch scrubber**: resolved — read-only past snapshot; present day stays at simulation tip; **epoch step** always advances present day. **Campaign kit** export: no prompt on present day; if scrubber is on a past **epoch**, ask **currently selected time** vs **simulation end time**.
- **Increment 3 exploration**: resolved — **expeditions**, founding, **roads**, and **exploration fog** continue after latch; new sites join origin **faction** as **vassals**—politics and exploration concurrent, not a freeze.
- **Continuous colonization run**: resolved — deferred past increment 3; #394 ships manual **epoch step** + editable **epoch batch** only.
- **Increment 3 history log**: resolved — feed catalog: latch, **faction** emergence, **faction** extinction, **city-state** founding, daughter founding, **settlement** abandonment (**ruin**), **vassal** defection, major war start/end, treaty/peace, embargo-on-**rivalry**; no routine contest, culture **WOAC**, or **expedition** rows.
- **Settlement ruin**: resolved (epic cross-cut) — population 0 keeps the pin as a **ruin** (no claims, no **expeditions**, **history log** abandonment); hinterland frees for living neighbors; not full removal and not zombie claims.
- **Extinct polity**: resolved (epic cross-cut) — **faction** with no living members goes extinct (**history log**); **realm** with only **ruins** stays as colonial memory in `running` (scrub/export/**reset colonization** only—no auto-reset, no further exploration/politics progress).
- **Faction territory overlay**: resolved — pins + **haul-shed** fill; **vassals** under liege; contested overlaps; not visit-status claims.
- **Mid-run control**: observe-only for outcomes in v1; **epoch batch** editable mid-run; no rewriting **faction** borders or **history log** events by hand.
- **Population model**: **bulk population** parameters + per-**epoch** **population collapse** for **population overlay**; **notable figure** dynasties tracked outside the bulk model—WFC-style constraint satisfaction is inspiration, not a committed algorithm name in product copy.
- **Increment 2 exploration**: **exploration fog** overlay + auto-dispatched **expeditions**; new **settlements** founded automatically at logistics nodes—one **realm** as sole polity until increment 3.
- **Realm after latch**: resolved (epic cross-cut) — **realm** stays the colonial-origin umbrella (shared founding wave); **factions** are political bodies inside it. Not retired; not 1:1 with the origin **faction**.
- **Expedition dispatch gate**: resolved — eligible from first **epoch step**; per-**settlement** stochastic timing each **epoch**; optional surplus/population bias only, no hard tier or survival-streak prerequisite.
- **Automatic founding gate**: resolved — requires scored **logistics node** **and** local **survival triad** viability on a **provisional claim** (recompute exclusive nearest-pin ownership including the candidate pin; freshwater + non-trivial arable on cells that pin would own); fog may clear without founding when nodes fail viability.
- **Provisional claim at founding**: resolved (epic cross-cut) — daughter-site viability and post-founding claims use the same exclusive nearest-pin rule; do not found on geometric isochrone totals the new pin would lose when claims settle.
- **Annual epoch order**: resolved (epic cross-cut) — network (**expeditions**, founding, **roads**) → claim recompute → **survival triad** / **population collapse** → politics (latch, **factions**, **trade routes**, **conflict**). **Begin colonization** applies the survival leg once for **epoch** 0 without network/politics phases.
- **Exploration fog semantics**: resolved — visit-status tint only; geography and resource overlays stay readable; toggleable overlay during `running` (and absent during **terrain authoring**).
- **Initial visited territory**: resolved — founding **haul-shed** cleared at **begin colonization** (**epoch** 0); remainder unvisited until **expeditions** extend it.
- **Expedition fog clearing**: resolved — one-cell-wide routed path; terminus disc when a scored **logistics node** is reached (viability pass or fail).
- **Logistics node scoring**: resolved — multi-tag non-exclusive weights; primary type = highest contributor in inspect; five types (**chokepoint**, **haul junction**, **surplus basin**, **refinery**, **drain city**); **drain city** included in increment 2 founding mix when geography supports it.
- **Daughter settlement seed**: resolved — fixed small outpost headcount (implementation constant); global **three-day haul distance** **haul-shed** centered on each new pin.
- **Expedition concurrency**: resolved — one active **expedition** per **settlement**; one dispatch attempt per **settlement** per **epoch** while idle.
- **Settlement haul-shed overlap**: resolved — distinct pins required; geometric **haul-shed** isochrones may overlap in increment 2 (still a land-branch logistics link for **supply-chain independence**).
- **Shared hinterland claim**: resolved (epic cross-cut) — **survival triad** sums (food, timber, **salt**) and **population collapse** hinterland use exclusive cell ownership: nearest **settlement** pin by **travel time**. Geometric overlap does not invent regional calories; **population overlay** does not stack multi-pin density on one cell. Claims recompute every annual **epoch** (including silent years inside an **epoch batch** and **history log** event years)—not frozen at founding. Every **committed tip** stores that year’s claim map; **epoch scrubber** / **campaign kit** show the tip’s claims, never present-day claims on a past year.
- **Committed tips** (scrubber / export targets): resolved (epic cross-cut) — **epoch** 0 at **begin colonization**; each year that was present day after an **epoch step**; and any year with a **history log** event. Silent annual ticks with no event are not inspectable targets. **Event feed** jumps use the event’s own **epoch**. Tip state includes hinterland claims for that year.
- **Increment 2 history log**: resolved — daughter **settlement** founding entries only; no expedition or rejected-site events.
- **Increment 2 notable figures**: resolved — one dynasty per **settlement** at founding (geography heuristic + “Dynasty”); no **expedition** lead or **vassal** seats until increment 3.
- **Multi-settlement population overlay**: resolved — per-**settlement** **core + hinterland** collapse on claimed cells only; no stacked density from multiple pins on one cell.
- **Settlement count cap**: resolved — no hard cap; dispatch exhausts when all scored **logistics nodes** are founded or rejected; sim does not auto-stop.
- **Rejected logistics nodes**: resolved — once surveyed and failed **survival triad** viability, not re-targeted while terrain is locked.
- **En-route founding**: resolved — evaluate scored **logistics nodes** in path corridor (routed cell + immediate neighbors) in travel order; first viable unscouted node wins; stochastic target biases route only.
- **Daughter visit on founding**: resolved — full **haul-shed** becomes visited at automatic founding.
- **Haul-shed shape**: resolved — terrain-aware **travel time** isochrone from **movement cost** + **three-day haul distance** budget (not a circle); setup preview approximates reach for calibration.
- **Roads and exploration**: resolved — terrain-aware **haul-shed** in increment 1 / shared colonization seam (#392 or prerequisite); increment 2 (#393) adds **road** persistence from overland founding paths, **road** **movement cost** multiplier, toggleable **road** overlay, and automatic land vs **sail expedition** by lowest **travel time** (B2); sail legs do not create **roads**.
- **Expedition duration**: resolved — multi-**epoch** treks; **travel time** budget per **epoch** along precomputed terrain-hugging route; founding checks each step.
- **Increment 2 right panel**: resolved — **sim status** header + **founding chronicle** after **epoch** 0; **validation advisory** only at **epoch** 0.
- **Grid scale**: no intrinsic km-per-cell; **three-day haul distance** and related **travel time** metrics are author-calibrated in **colonist settings** until map scale is modeled.
- **Colonization phase states**: `terrain` → `setup` → `running` until **reset colonization** returns to `terrain`. No **`stopped`** phase (scrubbed). **Colonization setup** (#391) ships the full transition through `running` with document fields initialized; increment 1 (#392) plugs in **epoch** ticks without adding interim phases.
- **Founding settlement at commit**: resolved (epic cross-cut) — **begin colonization** creates the founding **settlement** at **epoch** 0 (visit status for founding **haul-shed**, founding **dynasty** when slice B lands) before any **epoch step**, and applies one **survival triad** resolve so **starting population** is clamped to ceiling / freshwater reality. Empty `settlements` is not a post-commit state; **epoch** 0 is an honest committed tip.
- **Colonization setup chrome**: terrain authoring panels fully hidden; left panel → **colonist settings**, right panel → **validation advisory** (warnings/errors). Same panel real estate as terrain phase, different content.
- **Colonization running chrome**: left panel → **colonist settings** (read-only except permitted mid-run edits such as **epoch batch**); right panel → **validation advisory** at **epoch** 0 only, then **sim status** + **founding chronicle** (increment 2) → full **epoch scrubber** / **event feed** (increment 3). **Campaign kit** export and **reset colonization** in persistent toolbar chrome. Terrain generation controls hidden; map overlay toggles remain for inspect.
- **Session persistence**: resolved (epic cross-cut) — refresh restores the full colonization run: phase, **founding landing**, **colonist settings**, present-day sim state (**epoch**, **settlements**, **history log**, **expeditions**, **roads**, **factions**, **trade routes**, …), **and** temporal history so **epoch scrubber** / **campaign kit** can still target past **committed tips** (including each tip’s hinterland claim map). Setup-only fields are not enough once `running`. Lives on the existing session-survival path alongside generation settings (silent **landmass** regen, then rehydrate)—not a separate colonization save/load UX. **Campaign kit** export remains user-initiated during `running`, repeatable, non-terminal.
- **Campaign kit pre-latch**: resolved (epic cross-cut) — export available anytime during `running` once the control exists, including before **supply-chain independence**; pre-latch kits omit or empty politics sections.
- **Colonization RNG**: no separate **history seed**—**geography seed** seeds colonization stochastic rolls; not author-facing in **colonist settings**.
- **Colonization time controls**: first release ships manual **epoch step** ( **epoch batch** = 1 ); target UX raises default **epoch batch** (~100) with author adjustment; **continuous colonization run** deferred.
