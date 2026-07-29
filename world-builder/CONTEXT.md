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

First product phase: generate and tune a **landmass** until the user is satisfied—regenerate, tweak parameters, inspect overlays (**Freshwater availability overlay**, resource rasters, **Sail overlay**, …), review **validation checks** (pass or fail). The generation Resources section includes mineral occurrence controls for copper, silver, gold, and diamond relative mix within a fixed deposit count. Ends when the user clicks **Colonize**; the user may return from **colonization setup** to edit geography again until **begin colonization**—returning discards in-progress colonization state (no draft resume).

_Avoid_: “Map editing phase” when **scalar fields** and pipeline stages are meant; conflating with **colonization phase** simulation; persisting partial setup across a return to terrain; putting mineral occurrence sliders in **colonist settings**.

### Colonization phase

Second product phase: user completes **colonization setup**, then **begin colonization** runs annual **epoch** ticks. Delivered in three product increments—**single-colony survival**, then **exploration and new settlements**, then **economy, politics, and history** together. Hands-off simulation after initial conditions: user sets geography and **colonist settings**, then the sim advances with minimal intervention—observe and **epoch step** (multi-year **epoch batch** controls deferred past increment 2); no mid-run outcome edits in v1. No fixed or terminal run endpoint—the user keeps stepping **epochs** as long as they like; “present day” for **campaign kit** export is a subjective call, not a sim state change. In `running` phase the side panels split by job: left is **realm economy** extremes (clickable commodity **local price** high/low, Highest/Lowest balances, Highest/Lowest **port toll** income among living ports, and Highest/Lowest net **faction tax**—value only, no placenames; politics when factions exist); right is **sim status** census (**epoch**, living and **ruin** counts, active **expeditions**, built **road** segment count, on-map **trade route** flow count, **off-map trade** count, total population, clickable population extremes, discrete **salt**/mineral pin claimed vs world with zero-total rows omitted). **Sim status** appears from **begin colonization** (**epoch** 0 onward); **validation advisory** sits above it only while `epoch === 0`. Extreme values place **settlement focus** (toggle off on second click or by clicking the map). Frontier-exhaustion flags stay internal for dispatch math—not author-facing chrome. No milestone / chronicle list in either sidebar—founding and abandonment narrative belongs in the **campaign kit**, not chrome. Settlement-level full detail stays on map inspect / **settlement trade tooltip**. A filterable **event feed** (increment 3) is the in-app investigation surface at **present day**. Terrain generation controls stay fully hidden; map overlay toggles remain for reading geography.

_Avoid_: “History sim” alone when founding, expansion, and present-day structure are all meant; restarting terrain pipeline silently mid-colonization; requiring user unlock for core **faction** / **trade route** behavior once thresholds fire; swapping the full panel layout again at increment 1; hiding read-only resource overlays during the run; auto-stop or terminal freeze on **equilibrium state**, **political equilibrium**, or **stop colonization** (scrubbed); keeping read-only **colonist settings** in the left panel during `running`; keeping the **generation report** into setup or `running`.

### Single-colony survival

First colonization increment: one **founding landing**, one growing **settlement**—no exploration, no additional **settlements**. Simulation establishes local food (**arable envelope** plus shore **fish**) and freshwater within the founding **haul-shed** (**three-day haul distance** **travel time** budget from the pin), then preservation **salt** completes the **survival triad** before increment 1 is considered complete. Timber and metals contribute to later **material prosperity**, not baseline survival. **Population collapse** distributes bulk population across cells in the same **haul-shed**; **settlement tier** stays a single node at the pin. Territorial expansion is settlement size only, not map claim. No sim-detected endpoint—the user keeps stepping **epochs** indefinitely.

_Avoid_: “Phase 1 worldgen”; conflating with **terrain authoring**; multi-**settlement** maps in the first colonization test slice; full **resource profile** accounting before the survival triad works; **equilibrium state** as a completion gate (scrubbed).

### Epoch batch

Number of in-world years each **epoch step** advances—planned **colonist settings** field, editable mid-run once multi-year stepping ships. **Deferred past increment 2** (#393): increment 2 advances exactly one annual **epoch** per **epoch step**; batch size control and mid-run editing land with increment 3 (#394) alongside editable batch UX. Target default 50 years per step (author-adjustable 1–100). Internal tick semantics stay annual—batching will apply N sequential **epoch** ticks per control action.

_Avoid_: “Speed slider” that changes tick semantics; sub-year **epochs** unless explicitly modeled; **year cap** disguised as batch size; implying **epoch batch** is live in increment 2 UI or schema.

### Exploration and new settlements

Second colonization increment: **exploration fog** overlay clears along **expedition** paths; additional **settlements** founded automatically when an **expedition** reaches a cell that is both a scored **logistics node** and locally viable under **survival triad** rules (freshwater hard gate + non-trivial food—*arable* and/or shore **fish*—on the site’s **provisional claim**—claims recomputed as if the new pin already exists). Paths may clear fog without founding if nodes fail viability. **Expedition** dispatch uses a **realm expedition budget** each **epoch**—not one automatic roll per **settlement**. New **settlement** pins must lie at least **one day’s haul** (**one-third** of **three-day haul distance** travel time) from every living **settlement** pin and must differ in cell coordinates; geometric **haul-shed** circles may still overlap beyond that minimum (a logistics link until increment 3 **supply-chain independence**), but **survival triad** and **population collapse** use exclusive nearest-pin cell claims—no shared calories. No hard cap on **settlement** count—founding stays automatic for every viable unscouted node—but dispatch capacity tapers as frontiers shrink and **logistics nodes** are founded or exhausted. Still before full **trade route**, **faction**, and **history log** interdependence.

_Avoid_: “Expansion pack” naming; treating as optional when it is the planned second test gate; **city-state** independence before increment 3; requiring user confirmation per new **settlement** in hands-off mode; founding at high-scored nodes that fail freshwater or food viability; rejecting founding solely because **haul-shed** regions overlap another **settlement**; arbitrary maximum **settlement** count; auto-stop or terminal phase when the frontier is exhausted—**epoch step** and existing **settlement** growth continue; tying dispatch attempt count directly to living **settlement** count.

### Colonize

User action that ends **terrain authoring** and opens **colonization setup**: place the **founding landing**, configure **colonist settings**, then **begin colonization** to start the clock. Available once a **landmass** exists to work with—not gated on **validation checks** passing. **Validation advisory** surfaces errors and warnings first; the user may proceed anyway. Colonization reads whatever geography layers exist and fills gaps with documented heuristics for the entire run—full **logistics pass** is not a hard gate at entry or later. Odd or crude politics on a warned map are on the author.

_Avoid_: “Generate world” when only people-layer simulation is starting; blocking **Colonize** until every check is green; hiding failed checks when the user opts in; silent failure when a layer is missing instead of heuristic fallback; a second completeness gate once `running` or at increment 3 latch.

### Colonization setup

Interactive step between **Colonize** and **begin colonization**: user places the **founding landing**, edits **colonist settings** (logistics and founding-wave parameters), and reviews geography. Map time is frozen; no **settlements** or **epoch** ticks yet. **Terrain authoring** controls are fully hidden—not merely disabled; the left and right chrome panels show **colonist settings** and **validation advisory** (warnings/errors) respectively. Entering setup clears the **generation report**—that hydrology/debug surface is **terrain authoring** only. **Begin colonization** enables once a valid **founding landing** exists—all **colonist settings** already hold defaults in the pane. User may return to **terrain authoring** until **begin colonization**—all setup progress is discarded on return (landing pin, settings edits); no partial-state resume.

_Avoid_: “Pre-sim” in UI copy; conflating with **terrain authoring** parameter panels; saving colonization setup drafts across a terrain return; indeterminate colonist controls; leaving terrain sliders visible in setup; keeping the **generation report** into setup or `running`.

### Colonist settings

Configuration during **colonization setup** for the founding wave. Pane ships in **colonization setup** (#391): **three-day haul distance** (scale calibration), **starting population**, **people per habitable cell** (landscape packing density for the land leg of **population ceiling**—default **10**, slider **1–50**), **yield modifier** (marginal / typical / bountiful **arable envelope** interpretation), **land expedition range** (max trek length as a multiple of **three-day haul distance**—default **2×**, slider **1×–4×**; also **strategic overstretch** reach for whether a founding joins as **vassal** or mints a peer **faction**), **inland sail expedition range** (default **3×**, slider **2×–6×**—rivers, lakes, sheltered coast), and **open-sea expedition range** (default **8×**, slider **4×–12×**—**port settlement** ocean voyages only; minimum stays above **inland sail expedition range** minimum), and **strategic overstretch** span (how many living member **settlements** a **faction** can hold before mid-run **strategic overstretch** peel—default **12**, slider **6–24**; locked at **begin colonization** with the other founding-wave knobs). **Strategic overstretch** reach for founding uses **land expedition range** (same slider)—not a separate control. Increment 3 locks baseline **off-map shipping cost** spreads (export half reference; import **2.5×** reference)—not a live symmetric slider in this baseline. **Epoch batch** (years per **epoch step**) is deferred past increment 2—no live field in increment 2 schema or UI. Every field has a concrete default—sliders and controls are never indeterminate. **Begin colonization** enables once a valid **founding landing** is placed; unset-looking controls still carry defaults. After **begin colonization**, founding-wave knobs are locked into the run and leave the left panel—`running` chrome shows **realm economy** instead. Mid-run **epoch batch** editing arrives with increment 3 (not as a return of the full colonist pane). Colonists are nameless and flavorless—no author-facing origin culture or homeland; the GM invents a past if they want one. Trade, diplomacy, and expansion temperament knobs wait for later increments. No author-facing RNG seed—colonization reuses **geography seed**. No **year cap** or auto-stop—the user keeps stepping **epochs** indefinitely.

_Avoid_: “Civ picker” that implies pre-existing on-map peoples; “Difficulty” sliders without geographic meaning; indeterminate or empty UI state for colonist controls; a separate **history seed** or **simulation seed** in the setup pane; **year cap** as max **epochs** before auto-stop; settings that only apply to increment 3 **faction** play in the first test slice; a single **sail expedition range** slider conflating inland and open-sea treks; mineral occurrence controls (those belong in **terrain authoring** Resources); keeping a read-only **colonist settings** pane in `running`.

### Begin colonization

User action that commits **colonization setup** and enters the **colonization phase** `running` state—terrain hard-locked, **epoch** initialized (0), founding **settlement** created at the **founding landing**, founding **haul-shed** marked visited, and one founding **history log** entry (landing, **colonist settings** summary, founding **dynasty** when slice B lands). At commit, the founding port performs one **off-map trade** clearing before its first **survival triad** resolve: local exports may earn external credit and fund same-commit food or salt imports. **Starting population** then resolves against delivered survival supply; freshwater failure still marks non-sustain, and **population collapse** / tier reflect that honest **epoch** 0 state. A landing with neither local subsistence nor export value may already fail. Annual **epoch** ticks and **epoch step** arrive with increment 1; until then the UI stays in colonization mode with time controls inert, but the founding node is already real and inspectable. The run stays in `running` until **reset colonization**—no sim-detected endpoint, terminal freeze, or export gate.

_Avoid_: “Play” / “Run” without colonization context; auto-starting simulation when the **founding landing** is placed; silent terrain edits mid-run; auto-stop on **equilibrium state**, **political equilibrium**, or **year cap**; a fourth “ready” phase between setup and running; **`stopped`** phase that halts **epoch step** (scrubbed); deferring the founding **settlement** until the first **epoch step**; blocking **begin colonization** solely because the landing is marginal.

### Reset colonization

Explicit user action that abandons the colonization run entirely: wipes colonization state (**founding landing**, **colonist settings**, **epoch**, **settlements**, **history log**, …), returns phase to `terrain`, and unlocks geography editing. Always available once **begin colonization** has committed—including at **epoch** 0. One confirm step; no partial colonization resume. The only way back to **terrain authoring** from `running`.

_Avoid_: “New world” as the only escape hatch; preserving sim progress across a reset; different reset rules before vs after the first **epoch** tick; conflating with **campaign kit** export (export does not end the run).

### Founding landing

Map cell where the first colonizing boat makes shore—the seed **settlement** and expansion origin for one founding wave. Chosen by the user during **colonization setup**; must be **Sail overlay**-reachable coast or river mouth on a connected **landmass** large enough to host a colony (tiny offshore sandbars and wisps stay on the map but are not selectable). Invalid cells (inland, non-sailable shore, undersized land bodies) are not selectable—the map shows a “no” cursor like other disabled controls, without error copy. During setup, a single persistent map marker shows the chosen cell, with a live **haul-shed** reach preview centered on the pin (**three-day haul distance** calibration—a circle of that cell radius); the preview rescales as the slider moves. Clicking another valid cell moves the pin and preview. The marker and preview persist in `running` as read-only reference at the **founding landing**.

_Avoid_: “Capital” before a **drain city** or political apex exists; random auto-placement without user intent; overland-only founding in v1; toast or modal explaining why a cell is invalid during placement; hover preview halos beyond the **haul-shed** preview; promising a terrain-cost isochrone preview.

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

Display and analysis layer for **traversable water** and sailing **validation checks**; toggled like other map overlays. v1 ships with tuned blur/high-pass so the mask includes connected waterways and a usable **waterfront sliver** for launch and landings—not deferred. Upstream vs downstream does **not** change sail **expedition** step cost; increment 3 **directional haul friction** may use **flow direction** along inland water links for trade and influence only.

_Avoid_: “Navigable river graph” as a stand-in for **Sail overlay**; using unblurred centerline masks; conflating overlay visibility with generation options; treating shoreline outline pixels on the base map as non-traversable when the overlay bridge connects them; storing a separate sail mask on the **world document** that can drift from the derive function used at validation time.

### Port settlement

Living **settlement** whose pin lies on **Sail overlay** (or adjacent to it) and whose river/lake water is connected to open ocean through the pre-blur water union (ocean + lakes + river corridors)—including pins a short way upstream of a mouth. Sail overlay blur alone does not grant port status. Also includes ocean-adjacent cells in the same class as a valid **founding landing** shore. May dispatch **open-sea expedition** and **inland sail expedition**; always retains the maritime slot guarantee when unvisited sail frontier remains. Distinct from economic **drain city** or **settlement tier**—dispatch class is geographic, not political.

_Avoid_: “Port city” as a tier label before simulation backs it; treating every **Sail overlay** pin as a **port settlement** (landlocked lakes and endoreic water stay inland); promoting near-coast lakes that only meet the sea through sail blur; requiring **drain city** logistics type for open-sea dispatch; denying port status to river-mouth towns that water-connect to the sea merely because the pin is a few cells upstream.

### Port toll

Baseline five-percent charge on a shipment’s transaction **gold-piece value** before tolls when goods load, unload, or transfer between maritime and inland **trade routes** at a **port settlement**. On-map value uses the importing settlement’s full **local price**, not the transport-netted goods obligation; off-map export value uses the actual discounted sale price. For on-map trade, the importing settlement pays every toll along its route through **bilateral obligations** to the collecting ports. A port charging itself has no net ledger effect. For **off-map trade**, the unseen buyer pays every **port toll** on the export path—including inland↔maritime transfers at intermediate **port settlements** and the final loading toll—into each collecting port’s **external trade account**; import unloading again nets to zero. Multi-stop relays therefore enrich successive ports. Later politics may change rates, grant exemptions, or impose embargoes. Distinct from **faction tax** (membership levy to the capital).

_Avoid_: Physical coins or goods retained by implication; taxing ships merely visible offshore; a fixed five-percent rate after politics explicitly changes it; exceptional wartime or monopoly rates as the peacetime baseline; collapsing a multi-port export path into a single exit toll; calling a **port toll** a **faction tax** or the reverse.

### Faction tax

Political membership levy inside a multi-settlement **faction**: each living non-capital member pays the capital **10%** of that member’s **prior-epoch realized on-map income**—the same creditor-side figure **credit limit** uses (net delivered on-map export credits plus collected on-map **port tolls**; not **external trade account** dump proceeds). Assessed amount is **floored** to whole copper pieces; zero results book nothing (no dust obligation). Booked as a **bilateral obligation** member → capital so **mutual credit** stays zero-sum. The full assessed amount always books—no insolvency haircut, no surplus-only payment, no tax-specific **credit limit** gate. **Credit limit** still gates purchases during **trade clearing**, not this levy; tax may deepen debt, freeze next-epoch discretionary spend, or push combined wealth into the emigration band. Capitals receive; they do not tax themselves. **Unaligned settlements** and singleton-capital **factions** pay nothing outward. Creditor-side **faction tax** receipts count in the capital’s next-epoch **realized on-map income** (and thus **credit limit**) alongside goods and **port toll** credits. Assessed and booked **after trade clearing, before survival triad**—same-epoch wealth for growth / debt / emigration includes the levy; membership events stay in the politics pass. Baseline rate is a fixed constant (same class as **port toll**’s five percent)—not a **colonist settings** slider.

This slice is **ledger and chrome only**: tax reshapes balances and credit—the material substrate for later capital annexation **Want** and member independence **Want**—but does **not** itself mint recorded **Want** / **obstacle** rows or **history log** tax entries. Those WOAC consumers land with rebellion / conquest.

Chrome: **settlement trade tooltip** and **realm economy** show last-**epoch** net **faction tax** as **gold-piece value**—positive when the site collected, negative when it paid. Tooltip row sits after **port tolls** (when that row exists; otherwise after balance) and before the commodity list separator; uses a percent-discount icon (Material `percent_discount` family) with accessible name “Faction tax”; value text green when positive, red when negative, neutral at zero. Every living settlement shows the row, including neutral **0** for **unaligned** sites and singleton capitals that neither pay nor collect. **Realm economy** adds clickable Highest/Lowest net **faction tax** among living settlements (same signed figure; value only, no placenames)—Highest is top collector, Lowest is largest outflow. **Campaign kit** living-settlement dossiers include the same signed last-**epoch** net as a structured present-day field (not rebellion prose); **ruins** omit it.

_Avoid_: Collapsing into **port toll**; taxing combined wealth or current balance; taxing gross production that never cleared trade; a faction treasury ledger separate from settlement accounts; taxing the capital’s own income to itself; charging **unaligned** sites; mid-run author rate knobs; wartime or monopoly rates as the peacetime baseline; forgiving or capping tax when the payer is already at or past its **credit limit**; excluding capital tax receipts from realized income; omitting the tax row for independents; netting tax into the tolls row; placing the tax row among commodities; booking tax in the politics pass after survival; assessing tax before the same epoch’s trade clear; emitting tax **Want** / **obstacle** / war / defection from the levy bookkeeping alone (consumers are separate WOAC); per-**epoch** **history log** tax rows; kit narrative that invents rebellion from tax alone; tax fields on **ruin** dossiers; fractional-cp tax obligations; round-to-nearest or ceiling that invents copper dust.

### Inland sail settlement

Living **settlement** whose pin lies on **Sail overlay** but is **not** a **port settlement**—river, lake, or sheltered water with no sail path to open ocean (endoreic / landlocked). May dispatch **inland sail expedition** only; no open-sea guarantee.

_Avoid_: “River town” as schema keys; conflating with **port settlement**; open-sea range multipliers on landlocked-water-only senders; treating ocean-connected river pins as inland sail.

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

Colonization map layer—primary political game board in increment 3. A toggleable **overlay** of color-coded territory swathes (same presentation family as the **wealth overlay**)—not faction badges or chrome on settlement pins. Fill shows **factional control** of each living **settlement**’s exclusive **primary claim** cells (same hinterland mask as **survival triad** / **population collapse** / **wealth overlay**)—not overlapping geometric **haul-shed** circles, and **not** membership alone. **Factional control** includes sticky membership (capital, ordinary member, **vassal**, **trade partner**) and sustained **soft power** over map-gray pins. Each living **faction** that **controls** **two or more** living **settlements** gets one solid distinct color from a fixed ColorBrewer qualitative Set3 of **12** slots (active roster capped at **12**). A **faction** that controls only one living **settlement** is map-**unaligned** for this overlay: it paints neutral gray, does not hold a territory color slot, and frees that slot if control shrinks back to a singleton—colors mark multi-pin control, not a solitary banner. Freestanding **unaligned settlements** with no dominant **soft power** also paint gray. Overlapping haul-sheds do not create shared political ownership; nearest-pin claim already assigns each cell to one **settlement**, hence one controlling **faction** hue (or gray). Membership and **conditional loyalty** do not shade the fill. Pin **size** carries membership band instead (capital largest among multi-control **factions**; ordinary members, **trade partners**, and **unaligned**—including singleton **faction** capitals—mid; **vassals** smallest). When a mint would exceed **12** living **factions**, join-first still wins when a neighbor target exists; otherwise the break goes **unaligned** and crystallizes when a slot frees. Visit-status alone does not paint territory. Thin claim perimeters separate abutting hinterlands of *different* colored **factions** (same-hue abutting claims share one silhouette; gray singleton claims keep per-pin silhouettes). Rationale: [ADR 0018](../docs/adr/0018-world-builder-faction-territory-primary-claim.md) (claim geometry); [ADR 0021](../docs/adr/0021-world-builder-faction-territory-control-not-membership-only.md) (control vs membership paint).

_Avoid_: Treating the overlay as membership-only chrome; “Borders” as hand-drawn lines without simulation claims; painting territory independent of **history log** / sustained control; pin-only faction badges or pin chrome instead of territory fill; claiming all visited cells as territory; capital-only fill that ignores **vassal** / **trade partner** / **soft power** geography; painting overlapping geometric **haul-shed** circles as co-owned political land; inventing rivalry partners for true gray sites; treating gray as a fake **faction** color in the legend; a continuous loyalty HUD unrelated to logistics or trade dependence; encoding capital / **vassal** / loyalty as opacity or shade variation on the territory fill (use pin size for membership band, not fill shade); giving singleton-control **factions** a ColorBrewer slot or capital-sized pin when they control only one living **settlement**.

### Wealth overlay

Colonization heatmap of each living settlement’s combined financial position—the same figure as the **settlement trade tooltip** wealth row: **settlement trade account** balance plus any nonnegative **external trade account** claim. Paint fills each living settlement’s exclusive **primary claim** cells (same hinterland geography as **survival triad** / **population collapse**)—not pin-cell markers and not overlapping geometric **haul-shed** circles—with a thin black claim perimeter so adjacent similar-wealth hinterlands stay separable. **Ruins** do not paint (no claims, no standing trade inspect). Positive balances appear green and debt red in a stained-glass HSB ramp—mild balances stay bright lime/scarlet, larger imbalances mix toward deep hunter green / deep red with higher saturation—so magnitude reads as shade, not wash; the ramp scales directly with that combined **gold-piece value**, stretched across living settlements so the richest and most indebted this epoch hit the dark ends; accounts at zero paint amber/orange (marginal, barely getting by), not a calm gray. Chrome membership matches the other colonization-only overlays (**population overlay**, settlements, **exploration fog**, **Routes overlay**): absent from the overlay bar during **terrain authoring**; listed once the phase leaves terrain. Those four turn on once when `running` begins; **wealth overlay** stays off until the user opts in, and later **epoch** steps keep whatever visibility the user chose. Must remain readable with settlement pins on.

_Avoid_: Showing the wealth checkbox during **terrain authoring**; a separate wealth-only visibility rule that diverges from settlements / fog / routes / population; pin-sized blobs co-located with settlement pins; painting **ruins**; encoding years-of-income or **credit limit** projected income when the tooltip balance is the intended signal; showing annual **material prosperity** instead of the balance sheet; color without a signed legend; interpreting green wealth as physical coin stored on the map; double-painting contested geometric circles; relying on wealth tint alone to separate abutting claims; reading zero balance as emotionally neutral gray.

### Settlement IDs overlay

Campaign-kit-only map layer that paints each **settlement**’s **settlement map number** beside the pin—yellow fill with a thin black outline—so PDF/kit maps can cross-reference sites without opaque internal ids. Shows living and **ruin** pins alike. Not part of the author overlay bar and never user-toggleable in-app; export enables it for kit generation only.

_Avoid_: An author-facing checkbox for this layer; painting internal coordinate-keyed settlement ids; renumbering living sites each **epoch**; recycling numbers from **ruins**; a kit numbering scheme that drifts from **settlement map number**.

### Settlement map number

Author-facing short ordinal (1, 2, 3…) assigned once when a **settlement** is founded—founding site is 1; each later foundation takes the next unused integer. Persists for the life of the pin, including after abandonment as a **ruin**; numbers are never reused. Distinct from the opaque internal settlement id used as a sim join key. Shared contract for the **Settlement IDs overlay** (campaign kit maps) and **campaign kit** settlement cross-references (map legend, per-settlement sections).

_Avoid_: Using internal ids in kit/PDF labels; shuffling numbers when sort order or living count changes; a second numbering scheme for the kit that drifts from the overlay; resetting numbers on **epoch step**; exposing map numbers as an interactive overlay toggle.

### Settlement focus

Temporary map pin highlighting one living **settlement** chosen from a clickable **sim status** or **realm economy** extreme value (price, balance, or population figure—not a placename label). One focus at a time; selecting another extreme moves it (even when that extreme names the same **settlement**); selecting the same extreme control again clears it. Clicking anywhere on the map also clears it. Marker shares the **founding landing** pin family but must read as distinct (not a second founding site). No **haul-shed** preview and no auto-pan/zoom. Clears on **epoch step**, **reset colonization**, or leaving `running`.

_Avoid_: Multiple concurrent focus pins; reusing the founding pin graphic unchanged; haul-shed circle on focus; forcing camera pan; persisting focus across reset; requiring a map click on the pin itself to clear (empty map clicks clear too); requiring settlement names in sidebar chrome to support focus; clearing focus merely because two different extremes share a settlement.

### Settlement trade tooltip

Hover detail on a living **settlement** pin during colonization `running` (and after the founding pin exists in setup): shows population, a single combined balance, last-**epoch** **port toll** income for **port settlements**, last-**epoch** net **faction tax**, and lists every simulated commodity’s current-**epoch** trade role. Appears whenever the pointer is over the pin—independent of the **wealth overlay** toggle. **Ruins** do not show this tooltip. Hover hit-testing uses a larger world-cell radius than the drawn pin so full-extent map views stay easy to target without enlarging the visible markers. The top row shows living population with a person icon. The displayed balance is the sum of the settlement’s realm **settlement trade account** and any **external trade account** credit (simulation ledgers stay separate; the tooltip does not show them as two rows). For **port settlements** only, a row after the balance shows last-**epoch** collected **port tolls**—on-map toll **bilateral obligations** plus off-map external toll credits—as one **gold-piece value**, including zero when nothing cleared or no tolls moved; non-ports omit the row. That figure is this-**epoch** earnings, not a balance breakdown and not net of tolls the port paid as an importer. The toll row uses a fixed partially filled pie icon (decorative, not a live chart) with accessible name “Port tolls”; value text is green when positive and neutral at zero. Immediately after tolls (or after balance when the tolls row is absent), before the commodity-list separator, every living settlement shows last-**epoch** net **faction tax**—signed **gold-piece value** collected minus paid—with a percent-discount icon and accessible name “Faction tax”; value text green when positive, red when negative, neutral at zero (including **unaligned** / singleton-capital **0**). The panel stays wholly inside the viewport: prefer a below-right offset from the pin, then flip above and/or left as needed, then clamp residual overflow with a small margin. The balance row uses a money-bag icon instead of a textual label, with an accessible name. Color the balance **value text** green when positive, red when negative, and neutral when zero—the icon keeps its intrinsic color. Population value text stays neutral. For each commodity, show a commodity icon at its intrinsic material color (not the textual name)—grain as wheat, fish as a fish, salt as a white powder pile, timber as a brown log, base metals / copper / silver / gold as appropriately colored ingots, diamonds as a blue-white gem—plus that settlement’s **local price**, and a direction mark that stays a fixed muted color: left arrow for imported, right arrow for exported, a horizontal double-headed arrow when both occurred, and a neutral dash for neither. Color only the **local price** text by whether it is meaningfully above or below that commodity’s **reference price**—not a live average of other settlements’ prices: green when local is more than **10%** above reference, red when more than **10%** below, and neutral inside that ±10% band (including exact equality). No row background tint. Trade role is conveyed by arrow shape alone. Commodity icons also carry accessible names. The same layout appears when nothing moved this epoch—population, combined balance, port tolls at zero for ports, **faction tax** at zero when none flowed, plus every commodity at **local price** with neutral dashes—not a collapsed or prose-only empty state.

_Avoid_: Gating the tooltip behind the **wealth overlay**; tooltips on **ruins**; “Cash” when no physical coin is simulated; reducing gross two-way trade to one net arrow; prose summaries instead of a compact commodity list; omitting commodities with no trade; hiding the commodity list when all directions are dash; listing **salt** / typed **mineral** commodities when the landmass has zero pins of that type; using color as the trade-direction cue; inventing a realm-wide average price for the comparison; presenting local production as an export when no goods moved; omitting **local price** from the commodity row; icon-only chrome with no accessible name; letting the panel clip off-screen at map edges; enlarging drawn pins merely to fix hover targeting; tinting commodity or account icons with the price/balance signal; painting a colored row background behind commodity lines; showing realm and off-map ledgers as separate tooltip rows; coloring mild near-reference price noise outside a ±10% deadzone; toll rows on inland or **inland sail** settlements; presenting toll income as a share of the combined balance; netting outbound tolls paid against collected tolls on this row; live pie-chart scaling; surfacing the baseline five-percent rate as chrome; folding **faction tax** into the tolls row; omitting the tax row for independents; placing tax after commodities; omitting **faction tax** from living **campaign kit** dossiers once the field exists; mirroring toll income into **campaign kit**, **sim status**, or **wealth overlay** without an explicit product decision.

### Progress chrome

Author-facing load/progress UI (pills, labels, counters, percentages) shown while World Builder work that can take noticeable wall time is running—terrain generation, **begin colonization**, **epoch step** (including trade clearing and politics), session rehydration on refresh, **campaign kit** export when capture/PDF work is noticeable, and any similar stage that already has a progress surface. Progress prefers named logical substeps; when a substep itself can take noticeable time, it also shows an item counter (`13/145`) or a percentage (`11%`) as fits the work. During **epoch step** Trade, substeps follow the clearing ladder: local prices → survival → comfort → prosperity → off-map residual. During **epoch step** Politics, substeps follow latch → membership → conflict → absorption → palette; Conflict adds an inner `n/m` while scoring conquest stakes. The UI must keep updating—not freeze on a static label—while that work runs. Rationale: [ADR 0016](../docs/adr/0016-world-builder-cooperative-progress-yielding.md).

_Avoid_: A multi-second frozen progress pill; silent long work with no chrome when a progress surface exists for that stage; progress that only advances between giant phases when the phase itself stalls the page; a Trade or Politics pill stuck on the phase name while clearing or conquest scoring runs as one opaque block.

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

An outbound trek from a **settlement** that advances **exploration fog**, surveys **logistics nodes**, and may lead to a new **settlement** site. Rationale: [ADR 0012](../docs/adr/0012-world-builder-bearing-based-expedition-routing.md), [ADR 0015](../docs/adr/0015-world-builder-expedition-budget-and-settlement-merge.md). Draws from the **realm expedition budget** each **epoch**; only **frontier-eligible** senders compete for slots. At most **one active expedition per settlement**. **Mode is fixed at dispatch** as **land expedition**, **inland sail expedition**, or **open-sea expedition**—no mixed treks or portage in increment 2. **Land expedition** serves overland frontier expansion. **Inland sail expedition** and **open-sea expedition** are separate maritime modes with different range multipliers in **colonist settings**; **port settlements** may always launch maritime **expeditions** when ocean or sheltered-water frontier remains. **Mode selection** at dispatch follows sender eligibility and pool assignment—not a flat per-site land/sail coin flip. If a coastal **land expedition** has no legal first step (bearing points straight to impassable water), skip dispatch that **epoch**—do not auto-convert to **sail expedition**. At dispatch the sim also rolls a **random bearing**—there is no pre-selected destination cell; explorers follow terrain in that general direction rather than pathfinding toward undiscovered coordinates. The bearing is **fixed for the trek’s lifetime** (intent only); each step picks the legal neighbor that best matches it while satisfying terrain-following rules—the path may curve along coasts or ridgelines without re-rolling bearing mid-trek. If no legal step aligns and terrain blocks further progress, the expedition ends as **blocked**. Each **epoch**, the trek spends a **travel time** budget on **local terrain-following steps** along the bearing. **Land expedition** spends the **three-day haul distance** budget on local steps (elevation climb bias—uphill slower than downhill; existing **land route** preferred over wilderness)—each step picks the legal **dry land** neighbor that best matches the fixed bearing, then lowest local step cost (valleys and **land route** cells over steep climbs), then unvisited over visited; no step may take a large elevation jump when a lower-climb aligned alternative exists. **Sail expedition** spends **3×** that budget at flat low cost on **Sail overlay** cells, favoring coast-hugging and river-mouth travel—each step prefers neighbors within **6 cells** of dry land (non-ocean); if no legal step both matches the bearing and keeps that shore proximity, the trek ends **blocked** (no open-ocean shortcuts in increment 2). **Land expedition** steps only on **dry land** (never ocean, **lakeMask**, or **riverCorridorMask**). **Sail expedition** steps only on **Sail overlay** cells—no dock-and-march inland yet. An expedition **ends** when any of: (1) automatic **founding** at a viable **logistics node** on the path, (2) **blocked**—no legal next step that satisfies mode terrain rules (physical barrier: sea for **land expedition**, land or open water for **sail expedition**), (3) **range cap**—path length from origin exceeds the **land expedition range** or **sail expedition range** multiplier (from **colonist settings**) times **three-day haul distance**, or (4) **survey complete**—legal next steps exist but every candidate enters already-visited cells (rejoined known territory with nowhere new to go). No return journey in increment 2. While moving, visit status extends along the routed path (one cell wide through previously unvisited cells). **Scored logistics nodes** in the path corridor (routed cell plus immediate neighbors) are evaluated for founding viability in **travel order**—first viable unscouted node wins. **Land expedition** founding may occur at any viable inland or coastal **logistics node** on the march; successful founding persists the marched path as a **land route**. **Sail expedition** founding is limited to viable **logistics nodes** whose pin cell is **Sail overlay**-reachable (same class as a valid **founding landing**); successful founding persists the sailed path as a **sail route**. When the party reaches a scored **logistics node** (en route or at terminus), that site clears a local patch (disc around the cell) whether or not founding succeeds—failed viability still records “we’ve surveyed here”; exhausted rejected nodes are not re-targeted while terrain remains locked.

_Avoid_: “Scout unit” as schema keys; player micro of every path in increment 2 unless a later mode adds it; a minimum-survival **epoch** count or tier threshold before any expedition can dispatch; wide corridor clearing that reveals whole regions per step; leaving a reached but rejected node visually unvisited; multiple concurrent treks from the same **settlement**; realm-wide expedition caps unrelated to per-site agency; destination-only founding checks that ignore viable **logistics nodes** along the march; return-home treks; pathfinding toward a specific undiscovered target cell; global A* or unbounded grid search during **epoch step**; mixed land/sail treks or portage in increment 2; sail founding at inland nodes without **Sail overlay** reach; founding without recording the path as a **route segment**; straight-line cuts through impassable water.

### Supply-chain independence

When the unified increment 2 **realm** no longer shares one viable bulk-food **grain circle** across all **settlements**—the increment 3 entry signal. Evaluated each **epoch**; latches increment 3 on the first qualifying **epoch** when **either** branch is true (both not required). Politics **emerge gradually** after latch—not an instant realm split on that **epoch**.

**Land branch:** at least two **settlements** whose geometric **haul-shed** circles share no cells **and** no **road** path connects them within the **three-day haul distance** budget **and** no viable **maritime reach** / sail sea-lane still economically links them (**Sail overlay**-reachable coast or river mouth to coast—extends far beyond land **haul-shed** radius). **Roads** and sea lanes can bridge gaps that overlap alone would miss.

**Maritime branch:** any **settlement** whose primary **logistics node** type at founding was **drain city**, at town-tier or higher, where local **arable envelope** inside its **haul-shed** covers less than half its food consumption—the remainder via **maritime reach** import dependence. Maritime latch (or ongoing maritime independence) triggers a **maritime peel**: that **drain city** becomes its own **faction** / **city-state** even when sail or land still reaches inland sites—import / sea-lane dependence is the political fracture, not land isolation. **Rivalry** cause: **logistics** (sea-lane / import).

_Avoid_: “Too far apart” without haul math; ignoring **drain city** import logic when judging whether politics should activate; pure **haul-shed** non-overlap alone when a **road** or sail sea-lane still ties sites; requiring both branches on the same **epoch**; retroactive **drain city** classification for sites that grew into ports without that founding tag; instant **faction** map on the latch **epoch**; treating land **haul-shed** radius as the only distance that matters when **maritime reach** links distant ports; treating maritime latch as a no-op for politics when the **drain city** remains sail-reachable.

### Logistics pass

World Builder–specific **landmass pipeline** stage after physical terrain: **maritime reach**, **arable envelope**, **strategic resource** placement, and **population ceiling** inputs—bulk haul economics the playlist defines and Dwarf Fortress does not model at macro scale. **Haul-shed** circles are colonization runtime geometry from **three-day haul distance**, not a logistics-pass raster.

_Avoid_: “Economy sim” for the whole **world**; conflating with **history log** or **conflict engine** ticks.

### Rejection sampling

Regenerate the candidate **landmass** when **validation checks** fail (missing haul corridors, **population ceiling** violation, impossible capital site)—same belt-and-braces pattern as Dwarf Fortress world rejection, but grounded in logistics constraints rather than biome quotas alone. Automatic during generation when enabled; distinct from **validation advisory**, which never blocks **Colonize** and may show a colonization-relevant subset (or superset) of checks rather than mirroring every rejection criterion.

_Avoid_: “Retry button” without logged reject reasons; conflating auto-reject during generation with a hard **Colonize** gate; assuming the right-panel advisory list is identical to the rejection-sampling criteria.

### Validation advisory

Pre-**Colonize** (and during **terrain authoring** / **colonization setup**) presentation of **validation checks** that matter for **colonization phase**—errors and warnings visible, never a hard block. The right-panel list is colonization-relevant only: omit checks that do not affect founding, survival, exploration, logistics, or politics; add checks when a geography gap would change colonization outcomes (e.g. weak **Sail overlay** for landing, no **well-viable** / surface freshwater bands). **Warnings** alone do not add friction. When any listed check is in **error** state, **Colonize** requires a lightweight confirm (“colonize anyway”) before **colonization setup** opens—proceeding on marginal geography is deliberate, not accidental. **Begin colonization** does not repeat the confirm; the author already accepted the map. Odd or crude politics on a warned map are on the author. Distinct from **rejection sampling**, which may discard candidates during generation. Do not warn for a missing per-cell travel-cost raster—**haul-shed** is intentionally a circle.

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

Bottom-up inputs that shape **culture** before institutions: **landscape** (elevation, hydrology, visibility, connectivity), **climate** (predictability, survival stress, resource cycling), **resource profile** (scarcity and abundance), and **natural threats** (predictability, frequency, defensibility).

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

Under any political surface (feudal, republic, tribal, …): **power centers** with wants, blockers, and actions—the machine that produces ongoing **rivalry**. Built from **WOAC cycles**, not throne furniture. Increment 3 uses a **pressure ladder**: routine inter-**faction** pressure resolves as **economic contest** each **epoch** (haul capacity, **strategic resource** stockpiles, **chokepoint** / toll control)—no **WOAC**, no war **history log** entry. When contest intensity crosses a threshold (implementation-tuned), one major-war **WOAC** cycle runs over a **contested settlement**, writes war/treaty **history log** entries, **blocks on-map trade** between the belligerent sides, and applies **war exhaustion**. Because trade clears before politics in each **epoch**, the block affects **subsequent** clearing passes until explicit peace/treaty—with at least one post-war **epoch** of refractory—not a rewind of the war year’s already-cleared caravans. Neutral third parties may still trade with either side unless a separate embargo says otherwise. A given **faction** participates in at most one major-war resolution per **epoch** (attacker, defender, or loyalist suppressor); other heated borders wait. Force comparison is deterministic (higher **projected might** wins; ties to defender). Peace does not erase **rivalry** edges. Multi-settlement campaigns are sequences of such contests. **Rebellion** uses the same force comparison inside one **faction**.

_Avoid_: “Factions” lists with static alignments; “everyone hates the evil king” without **obstacles**; tactical battle simulation; full **WOAC** for every skirmish; continuous **WOAC** noise in the **event feed**; resolving one war as a global strength comparison with no specific stake pin; RNG in the force comparison; blitzing every contested border in one **epoch** for the same **faction**; wartime trade continuing uninterrupted between belligerents; same-**epoch** trade rewind after politics decides a war.

### Contested settlement

The single living **settlement** whose membership is at stake in one major-war resolution—either another **faction**’s pin or an **unaligned** free town. Both sides compare force projected toward this pin. The side with greater total **projected might** (including **defender advantage** on the stake) wins outright; ties favor the defender—no RNG in the force comparison. Distinct from **settlement merge** / **administrative federation** (intra-**faction** pin absorption) and from peaceful **faction absorption**.

On attacker victory, that pin alone joins the victor’s **faction** (typically as a **vassal**); other living pins of a losing **faction** stay put. Whole-**faction absorption** via war only when that loss extinguishes the loser (no living members left, or no remaining capital-succession path)—not the default prize for taking a border town. Capital loss without extinction uses ordinary capital succession inside the surviving loser **faction**.

_Avoid_: “Battlefield hex”; multi-pin stakes resolved in one comparison; treating **ruin** pins as conquering targets; equating conquest with **administrative federation**; default whole-**faction** swallow on every major-war win; treating **unaligned** pins as unconquerable; dice or stochastic force outcomes.

### Conquest

Major-war resolution over a **contested settlement**, escalated from resource pressure (from **economic contest** when the stake is another **faction**’s, or direct resource **Want** when the stake is **unaligned**). Primary **Want** in this pass: **resource**—food surplus, **strategic resource** / **base metals**, wealth (including **port toll** or **faction tax** take), or corridor / **chokepoint** control at the stake. Honor, treachery, and belief wars deferred. Force comparison uses **projected might**; the attacker must have nonzero **projected might** to the stake (logistics corridor inside strategic reach)—no corridor, no contest. Aftermath applies **war exhaustion** and blocks on-map trade between belligerents on subsequent **epochs** until peace/treaty (minimum one post-war **epoch**; neutrals unaffected unless embargoed). Eligible stakes: living pins of rival **factions**, and **unaligned settlements**. **Unaligned** defenders have no allies—only the stake’s own **martial capacity** plus **defender advantage**—so free towns need exceptional local strength (or swift crystallization / re-absorption) to remain gray. Distinct from **rebellion** (internal) and from peaceful **faction absorption**.

_Avoid_: Honor/belief as required conquest drivers in this pass; tactical battle simulation; equating conquest with **administrative federation** or default whole-**faction** swallow; treating **unaligned** pins as unconquerable flavor; inventing fake ally **factions** for gray sites; wars against pins the attacker cannot project to; uninterrupted belligerent trade through a major war; rewriting the war year’s already-cleared trade.

### Martial capacity

A living **settlement**’s local ability to contribute to war—soldiers it can raise and equip from present economic and demographic state. **Population** is the primary scale (bodies under arms); other factors (food surplus, metals, wealth, defenses) modify that base rather than minting parallel armies from empty land. **Food surplus** (combined grain + fish above local survival demand—calories beyond feeding the locals, not grain alone) is the feed modifier that supports fielding and marching force. **Base metals** (iron/tin-class from **metals potential**, not copper/silver/gold/diamonds) are the armament modifier—precious minerals feed wealth/mercenary paths instead. Armament uses metals the settlement can actually use this **epoch**: local claim production plus delivered imports after trade clearing—not unclaimed **metals potential**, and not local production alone. Spendable wealth (same combined positive balance as the **settlement trade tooltip** / **wealth overlay**—realm account plus nonnegative **external trade account** credit) hires mercenaries that **offset** weak food/armament modifiers inside the population-scaled pool, with at most a modest top-up—not armies that dwarf local headcount. Computed at the source pin before distance attenuation. Distinct from the culture-engine **Power (force)**.

_Avoid_: “Power” alone when martial contribution is meant; persistent army agents or tactical units; stockpiled weapon inventories as a separate commodity layer in this pass; fielding force from wealth or resource stockpiles without regard to local headcount; grain-only feed rules that ignore fish-fed **drain cities** and ports; forging arms from precious minerals as if they were **base metals**; counting unclaimed **metals potential** as armament; ignoring delivered metal imports when measuring access; infinite sellsword stacks from a rich hamlet; treating debt or tax receipts alone as the mercenary purse.

### Projected might

**Martial capacity** after attenuation along the logistics graph from the contributing **settlement** to the **contested settlement**—built **route segments** and trade-candidate modes (**land route** / road, **inland sail**, **open sea**), including **directional haul friction** where those links already use it—not crow-flies cell distance and not a separate war-only pathfinder. No usable corridor means weak or zero projection even when pins look close on the map. Soft cutoff near existing strategic reach (**land expedition range** / mode-appropriate sail ranges). A **faction**’s strength in one major-war resolution is the sum of **projected might** from every living *taxed* member **settlement** (capital, ordinary member, **vassal**) toward that stake—same aggregation rule for attacker and defending **faction**. **Trade partners** and **unaligned** / soft-power-only pins do **not** add allied projection; a stake that is **unaligned**, soft-power-controlled, or itself a **trade partner** defends with that pin alone (plus **defender advantage** on the stake). Asymmetry comes from geography, the stake’s own zero-distance contribution, **defender advantage**, and whether the defender has taxed allies at all. Rationale: [ADR 0020](../docs/adr/0020-world-builder-projected-might-and-war-exhaustion.md).

_Avoid_: Attacker-only projection with defender local-only when the defender is a multi-settlement **faction** with taxed members; whole-**faction** strength independent of stake location; tactical battle simulation; crow-flies attenuation that ignores corridors; inventing a parallel war pathfinder beside the logistics graph; inventing ally contributors for **unaligned** defenders, soft-power-controlled free towns, or **trade partner** stakes; counting **trade partner** seats in the defending **faction**’s projection pool.

### Defender advantage

Defensive multiplier on the **contested settlement** for the side that holds the pin’s walls in that resolution. Scales mainly with **settlement tier** (urban fortification), with an extra bump when the pin is a **faction** capital (keep / political seat)—**unaligned** stakes get tier only, no capital bump. In inter-**faction** conquest that is the defending (current owner) **faction**; against an **unaligned** stake it is that pin alone; in **rebellion** it is the breakaway seat’s rebel side. Other contributors on that side still add ordinary **projected might** with no extra defender multiplier.

_Avoid_: Vague “importance” scores beside tier and capital; blanket defender bonuses on every contributing pin; fortification chrome without effect on the stake comparison; capital bumps on **unaligned** pins.

### War exhaustion

Aftermath of a major-war resolution (conquest or **rebellion**): participating contributors take a temporary penalty to **martial capacity** that decays over a stretch of **epochs** and refreshes if they fight again, **and** a lasting **population** loss among those contributors. Deaths fall on **every settlement that contributed projected might**, roughly in proportion to its contribution—**both sides**, winners included—with an extra local hit on the **contested settlement**. Because **population** is the martial scale base, deaths permanently weaken future **projected might**—so a faction that just seized a distant pin projects weakly home and is ripe for breakaway **rebellion**. Modest wealth burn for war spend may hitch on the same event; mass death is campaign loss, not a separate catastrophe system. No special “distant holdings” rule—fragility falls out of projection + exhaustion + headcount.

_Avoid_: Exhaustion with no demographic cost; population cull as the only lever with no temporary capacity fatigue; a bespoke distant-holding penalty beside ordinary projection; treating every skirmish/**economic contest** as war losses; loser-only body counts; stake-only deaths that spare projecting capitals; winner immunity to war dead.

### Rebellion

Armed internal contest inside one **faction**, resolved with the same **martial capacity** / **projected might** / **defender advantage** machinery as inter-**faction** conquest—not a second combat system. Distinct from quiet logistics fission (**conditional loyalty** defection, **strategic overstretch** peel, **maritime peel**): those fire when dependence or span breaks without a force comparison; **rebellion** fires when independence pressure meets resistance and sides fight over a **contested settlement**. Primary pressures in this pass: **faction tax** drain on non-capital members, recent conquest (a pin that joined by war, still resentful), and sustained rival trade dominance using the same on-map majority + **2×** margin + streak score as **soft power** (overlay still follows current membership until the fight resolves). Honor/belief revolts deferred. In this pass the stake is always the **breakaway seat** (not a capital coup / throne seizure). Rebel bloc = that seat alone; loyalists = every other *taxed* living member of the **faction**, projecting in (loyalists need nonzero projection to contest the breakaway—same reach rule as **conquest**; **trade partners** of the loyalist banner do not add projection). Rebel victory destination: when an opposing **faction**’s trade dominance is the decisive pressure, the seat **joins** that **faction** as a **trade partner** (paints under that banner; no **faction tax**; no banner shield); otherwise the same fork as **conditional loyalty** (join neighbor as **vassal**, spawn peer **faction**, or soft-**unaligned**). Loyalist victory: the pin stays; anti-churn refractory applies. If loyalists cannot project (no corridor), the breakaway succeeds without a force fight—same membership exit, no **war exhaustion** on a phantom battle. Armed resolutions apply the same belligerent trade block (breakaway ↔ loyalist **faction**) on subsequent **epochs** until peace/ refractory clears. Capital coups and multi-seat rebel coalitions deferred (cascade via later epochs instead).

_Avoid_: Renaming logistics peels as rebellion; a separate battle sim for civil wars; treating every **vassal** defection as armed rebellion; throne-war stakes in this pass; multi-pin rebel fronts in one resolution; inventing rebellion from tax chrome alone without a **Want** / resistance path; belief/honor as required drivers in this pass; uninterrupted trade between breakaway and loyalists through an armed revolt; sending a trade-backed rebel win into taxed **vassal** membership by default; recoloring a taxed member’s hinterland to a rival from trade scores alone before membership exits.

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

Owed allegiance with history and terms—not permanent unless the **supply chain** or coercion still holds. **Vassals** defect when liege-controlled **grain circle** / **chokepoint** economics stop mattering—alternate **road** or **maritime reach** paths, local surplus independence, or **directional haul friction** that makes liege projection uphill/upriver fragile—not from tier alone or idle RNG. Sustained **local** food independence (claim production feeds the pin without needing liege trade) can break loyalty **while road/sail still link** liege and **vassal**; leaving the liege’s **logistics connectivity component** remains a separate break path. Local surplus and loyalty pressure drive seat-level defection; they are **not** the primary mid-run path that splits a large **faction** into contiguous blocks—that is **strategic overstretch**.

_Avoid_: “Betrayal” without prior obligation logic; eternal fealty flags; loyalty decay rolls without a logistics break; auto-**rivalry** from elevation or river gradient alone.

### Great house

Apex **power center** competing for influence, territory, or succession—sits above the **political middle layer**.

_Avoid_: “Kingdom” when the house is the actor; family name without economic base.

### Vassal

**Middle-layer** holder of delegated authority (land, fort, toll)—**loyalty** tied to protection, profit, or habit. Increment 3: internal to a **faction** as **notable figure** dynasties with **conditional loyalty**—not separate **faction territory** until defection. Daughter **settlements** with `originSettlementId` begin as **vassals** under their component **faction**.

**Conditional loyalty** fails when the **vassal**’s **settlement** no longer needs the liege for **grain circle** protection or **chokepoint** access—e.g. an alternate **road** or **maritime reach** / sail path makes the liege’s toll optional, the **vassal**’s local surplus no longer depends on liege-controlled corridors (including when the **road** or sail link still exists), or **directional haul friction** makes uphill/upriver projection from the liege weak while downhill/downriver export from the **vassal** stays easy. Defection is a major **history log** event with cause-split destination: if the site still needs *some* neighbor’s corridors and another living **faction** already shares (or road/sail-adjoins) its **logistics connectivity component**, it **joins** that **faction** as a **vassal** (“switched allegiance”); if the break is full local surplus independence / own viable **grain circle** with no need for any neighbor liege **and** the site is **faction**-ready (town-tier+), it **spawns** a new **faction** (“declared independence”); if that independence break is real but the site is **not** yet **faction**-ready, it becomes **unaligned** (“soft independence”) and then crystallizes or re-absorbs under **unaligned settlement** rules. Record a **rivalry** cause (**logistics** or **legacy**) when a **faction** edge is involved, and update **faction territory**. No map-visible **vassal** borders before defection.

_Avoid_: “Lord” generically for every noble; vassal without a liege relationship; every **vassal** as an independent map **faction** in v1 increment 3; defection from tier/distance alone while **road** or sail still binds the liege and local surplus still depends on that liege; stochastic loyalty decay without a logistics break; treating elevation or river gradient alone as an automatic **rivalry** edge; always spawning a micro-**faction** on every defection when a join target exists; always forcing a liege-switch when the site no longer needs any liege.

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

Region where delivery still pays after **ox paradox**—a geometric circle of **three-day haul distance** (cell radius from **colonist settings**) centered on each **settlement** pin. **Roads** and sail do **not** reshape the circle; they are separate connectivity for latch, **faction** clustering, and **trade route** candidates. **Colonization setup** shows the same circle as the live reach preview so authors calibrate scale. Local production, **survival triad**, **population collapse**, and visit status at founding use this boundary. Circles may overlap geometrically; for food, timber, **salt**, and other summed production inputs, each cell is claimed by at most one **settlement**—the nearest pin by cell distance (primary claim). Claims recompute every annual **epoch** when pins or living membership change (including new founding and other network-changing **history log** events), so hinterland ownership can shift—including in silent years inside an **epoch batch**. Present-day **primary claim** is authoritative for map overlays; historical claim maps are not persisted ([ADR 0014](../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md)).

_Avoid_: “Radius” in miles only without calibration; fixed pixels-per-day baked into the **landmass** without author-facing scale; terrain-cost isochrones or a per-cell travel-cost raster for **haul-shed** shape; stretching the circle along **roads**; double-counting shared cells’ arable or timber into every overlapping **settlement**’s ceiling; freezing calorie ownership at founding while the pin set changes.

### Three-day rule

Rule of thumb: beyond ~three days' **travel time** by cart, bulk food **haul** often fails economically—not tradition, arithmetic. In v1 the distance implied by “three days” is set in **colonist settings** (calibrated **haul-shed** circle radius) because the **landmass** grid has no intrinsic real-world scale.

_Avoid_: Stating distances in miles/km alone for RPG prep; “two weeks north” without consistency; assuming one global real-world scale per grid cell without author calibration.

### Travel time

Primary spatial measure for play and simulation—“three days on horseback” beats raw distance. For **haul-shed** and primary claim in v1, the practical measure is cell distance inside the calibrated circle; **expedition** marches still speak in **travel time** budgets per **epoch**.

_Avoid_: “Hexes” in domain language unless the product explicitly uses a hex grid; a per-cell **movement cost** field as the haul geometry source of truth.

### Directional haul friction

Increment 3 asymmetry on an existing link between **settlements**: downhill/downriver flow is easier than uphill/upriver. Prefer **flow direction** along shared inland water / **inland sail** corridors when present; otherwise use elevation delta on **land** / **road** links. Cost interpolates from `0.75×` downhill/downriver through `1×` neutral to `1.5×` uphill/upriver; **open-sea** links remain `1×`. First-class for **trade** strength and **conditional loyalty** / influence (lowland liege over highland **vassal** is fragile; highland export downhill is easy)—not for reshaping **haul-shed**, latch connectivity, candidate **trade route** existence, or **expedition** step costs. Gradient alone does not create **rivalry**; **rivalry** still needs a concrete break (defection, embargo, contested corridor).

_Avoid_: “Movement cost” as an alias; per-cell travel-cost rasters; using gradient alone to extend an ordinary overland candidate beyond **three-day haul distance**; applying upriver/downriver costs to exploration sail steps; auto-**rivalry** from elevation or river gradient alone.

### Route segment

Persisted path geometry on the **world document** linking two **settlements** after a successful founding **expedition**—the **built corridor** between parent and daughter pins, not the bearing **expedition** trace. At founding the sim computes an A→B corridor appropriate to mode; **exploration fog** clears along that corridor. Each segment records its mode (**land route**, **inland sail route**, or **open-sea route**) and the connected **settlement** ids. Later increments may add segments from **trade route** activation and logistics pressure—not only founding marches. Segments remain when an endpoint later becomes a **ruin** (historical connectivity).

_Avoid_: “Road” alone when land and maritime founding paths are meant; user-drawn paths in hands-off v1; decorative lines without simulation effect; erasing founding paths that did not result in a **settlement**; treating the marched **expedition** route as the persisted **route segment** geometry; deleting segments when a **settlement** merges or is abandoned.

### Land route

**Route segment** from a successful **land expedition** founding. Terrain-following corridor on dry land. **Land route** / **road** segments are logistics connectivity and increment 3 **trade route** candidates—they do not stretch the geometric **haul-shed** circle. **Routes overlay** draws terrain-following geometry in gray cobblestone.

_Avoid_: “Road” in UI overlay names when **routes overlay** is meant; treating **land route** cells as sail-traversable; segments that cut through ocean, **lakeMask**, or **riverCorridorMask** cells; assuming **roads** reshape **haul-shed** reach.

### Inland sail route

**Route segment** from a successful **inland sail expedition** founding—shore- and river-hugging path on the **Sail overlay** between **settlements**. May seed increment 3 **trade route** / sea-lane candidates; **directional haul friction** may use **flow direction** along the corridor. Persisted for founding history and logistics connectivity; **Routes overlay** does not draw it (river corridors already read from hydrology / **Sail overlay** chrome).

_Avoid_: Conflating **inland sail route** with **trade route** (commodity activation waits for increment 3); drawing through non-**Sail overlay** cells; open-ocean chord geometry for river legs; painting **inland sail route** geometry on **Routes overlay**.

### Open-sea route

**Route segment** from a successful **open-sea expedition** founding—long-range ocean link between **port settlements**. May cross open ocean on the **Sail overlay**. Persisted for founding history and logistics connectivity; **Routes overlay** does not draw it (port ocean commerce is **off-map trade**, so on-map sweeping curves would misread as active sea lanes).

_Avoid_: “Sea lane” in schema keys before increment 3 **trade route** activation; painting **open-sea route** geometry on **Routes overlay**; conflating **open-sea route** with **inland sail route**; expecting on-map ocean curves to represent current port-to-port commodity flow.

### Sail route

Legacy umbrella for persisted maritime **route segment** geometry—prefer **inland sail route** or **open-sea route** when mode matters.

_Avoid_: Single sail presentation style for both sheltered water and open ocean; expecting **sail route** to shorten overland **haul-shed** reach inland; drawing maritime **route segment** modes on **Routes overlay**.

### Routes overlay

Colonization map layer (toggle like **exploration fog** and **Sail overlay**) showing persisted **land route** segments from **successful founding**—terrain-following gray cobblestone. **Inland sail route** and **open-sea route** segments remain on the **world document** but are omitted from this layer. Segments to **ruin** endpoints remain visible as historical connectivity when drawn. Failed, rejected, or completed-without-founding **expeditions** do not appear here (**exploration fog** records where the realm has traveled). Read-only inspection of founding land corridors; not a separate persisted mask. Candidate **trade route** edges and current-**epoch** commodity flows stay internal economy state—they do not get a second map layer. When a later politics pass blocks or embargos corridors, that chrome belongs on this overlay (or inspect), not a dedicated trade-flow layer.

_Avoid_: “Roads overlay”; painting maritime founding corridors here; showing scouting paths that did not found; drawing **open-sea route** or **inland sail route** curves as if they were active trade lanes; a separate **trade route overlay** that redraws the same corridors by flow volume; treating the overlay as the authoritative visit map; erasing segments when an endpoint becomes a **ruin**.

### Maritime reach

Where sea **haul cost** (~order-of-magnitude cheaper than land) extends feeding and **trade** beyond **haul-shed**—enables **drain cities** and empire-scale flows.

_Avoid_: Ports that are decorative; continents fed entirely by ox cart from one capital.

### Drain city

**Settlement** that concentrates flow (often port or river hub)—imports surplus from a wide **arable envelope** or **maritime reach**, not local subsistence alone. **Parasite city** pattern: grows beyond what local food production could support through sea-fed calories; foreign policy becomes sea-lane control.

_Avoid_: “Capital” with arbitrary population; metropolis in a food desert without import logic; treating as a normal inland **settlement** for **haul-shed** fracture.

### Population ceiling

Maximum population a **settlement** can support this **epoch**: the lesser of effective available food after trade and habitable claimed land packing. Food leg: local cropland and shore **fish**, plus imports, minus exports and preservation loss from inadequate **salt**—imports raise this leg only. Land leg: count of dry claimed cells that can host people (same habitability as **population collapse**) times **people per habitable cell**. Both legs scale with **population density**. Freshwater remains a hard local gate (zeros the ceiling). **Material prosperity** and account wealth do not increase population without food. Timber does not cap population until a later climate, construction, or industry mechanic explicitly requires it.

_Avoid_: “100k city” by aesthetic; ignoring imported food when a real **trade route** supplies it; counting promised imports that route capacity or credit cannot deliver; letting fish or imports ignore island land mass; timber as a hidden hard cap before a mechanic consumes it; ceilings that double-count cells also claimed by a neighbor; using urban built-up density for the whole claim when landscape packing is meant.

### Population density

Author scale in **colonist settings** on how densely people pack and how much edible yield a productivity unit produces (**0.5–2**, default **1**). Multiplies feeding capacity (people per arable/fish productivity unit), **people per habitable cell**, and matching grain/fish lb production so trade and survival stay in lockstep. Does not change surplus growth rate. Locked after **begin colonization**.

_Avoid_: Treating as **yield modifier** (that changes crop productivity before packing); using it to speed or slow demographic growth; scaling timber, metals, or salt the same way.

### People per habitable cell

Landscape packing density in **colonist settings**: how many people may live on one dry claimed cell for the land leg of **population ceiling**. Default **10** matches feeding density (one full arable productivity unit feeds about that many at **population density** 1). Author-adjustable **1–50**; further scaled by **population density**; locked after **begin colonization**. Not urban built-up density—later **settlement tier** multipliers may raise packing for towns and cities.

_Avoid_: Conflating with **yield modifier** or **population density**; treating as arable-only when rocky shore cells still house people; applying walled-town people-per-hectare figures to every hinterland cell.

### Arable envelope

Land that can sustainably feed a **settlement** or **drain city** given era-appropriate yields and **haul**—typically many times the built area for pre-industrial density. Per **settlement**, summed arable productivity on claimed **haul-shed** cells (arable raster × **yield modifier**) is the cropland portion of local food production and **population ceiling** input—shore **fish** adds separately and can sustain coastal or island sites with weak cropland.

_Avoid_: Farmland drawn only as map texture; farm percentage ignored (~80–95% rural in pre-industrial models); single-cell arable bottleneck when claimed-cell sum is the accounting unit; counting the same cell’s arable toward every overlapping **settlement**; treating arable as the sole food source when shore fish is available.

### Survival triad

Minimum survival accounting for food, freshwater, and preservation **salt**. Food production comes from cropland (**sum** arable productivity × **yield modifier**) plus shore **fish** (claimed land cells with cardinal-adjacent ocean, lake, or river corridor; ocean > lake > river productivity; **yield modifier** does not apply to fish). Trade then adds imports and subtracts exports before food supports population. Freshwater is a hard local gate: at least one **Freshwater availability overlay** cell must exist among claimed cells. **Salt fulfillment**, whether local or imported, controls preservation loss on available food. With multiple **settlements**, claimed cells remain exclusive; geometric **haul-shed** overlap does not duplicate local production. Timber contributes to **material prosperity**, not baseline survival, until another mechanic consumes it.

_Avoid_: “Needs bars” UI jargon; treating the triad as the full **economy** model; freshwater imports; freshwater from **Sail overlay** alone (sailing ≠ drinking); divergent well rules between overlay and colonization tick; bottleneck-only food from a single worst cell when the claimed-cell sum is the cap; timber as a survival gate before climate or industry requires it; **salt** as a duplicate calorie source or direct population cap; independent full-circle sums that invent regional production; a persisted **fish** raster when shore adjacency is enough; treating wells as fishing access.

### Strategic resource

Geographically sparse necessity (salt for preservation, metals, timber above treeline gaps)—controls **trade routes**, **rivalry**, and who taxes whom. In increment 1 slice B, **salt** access in the founding **haul-shed** applies a **spoilage tax** on effective food surplus—not a calorie source.

_Avoid_: “Rare ore” with no logistics effect; salt as flavor text; **salt** as a duplicate **population ceiling** cap when spoilage-on-surplus is meant.

### Salt fulfillment

Share of a **settlement**’s annual preservation demand supplied after trade. Baseline demand is five pounds per person per **epoch**, plus any **fish curing** input. Each claimed salt pin produces `score × 10,000` lb per epoch; unclaimed pins produce nothing. The constant is tunable so a score-1 deposit covers about 2,000 people at the household rate. Effective food is multiplied by `0.35 + 0.65 × fulfillment`, capped at full supply; zero salt therefore retains 35% of food rather than causing direct death.

_Avoid_: Local salt access as a binary flag once trade exists; counting fish-curing salt toward household demand; fulfillment above 100% improving preservation further; salt as calories; free output from salt pins outside a living settlement’s claim.

### Metals potential

Continuous resource raster representing a broad smear of low-value, commonly worked metals such as iron and tin. Stronger potential supports more baseline metal production but does not identify a specific precious-metal deposit. Each claimed productivity unit yields 800 lb of base metals per **epoch** (tunable: 80 person-equivalents × 10 lb for a 1 gp prosperity target at 1 sp/lb).

_Avoid_: Reading the raster as copper, silver, gold, or diamond extent; one pin per positive raster cell; treating all metal production as one commodity once trade begins; free output from unclaimed cells.

### Timber productivity

Continuous resource raster of forest yield on claimed cells. Each claimed productivity unit yields 16,000 lb of timber per **epoch** (tunable: 80 person-equivalents × 200 lb for a 1 gp prosperity target at 0.5 cp/lb). Timber feeds **material prosperity** and trade, not **population ceiling**.

_Avoid_: Using timber as a hidden population cap; free output from unclaimed cells; exposing raster scores instead of pounds in trade UI.

### Mineral deposit

Discrete **strategic resource** pin at a local maximum of **metals potential**, classified as copper, silver, gold, or diamond. Each claimed deposit produces one annual haul per **epoch**; unclaimed deposits produce nothing. Hauls are fixed constants tuned against founding-era grain hinterland export value by rarity: copper **85,000 lb** (~median farm dump), silver **12,500 lb** (~p60), gold **1,500 lb** (~top-quartile), diamonds **25** whole gems (~**1.5×** a gold mine’s dump)—so a working mine can feed local prosperity and still export rather than yielding a token pound. Catalog **reference prices** stay Fifth Edition anchors (0.5 gp/lb copper, 5 gp/lb silver, 50 gp/lb gold, 5,000 gp/gem diamonds); diamonds use 0.1 lb cargo each. Author-facing mineral occurrence controls live in the **terrain authoring** generation Resources section and set relative weights within a fixed total deposit count: copper, silver, and gold defaults preserve inverse 100:10:1 rarity; diamond defaults to zero and appears only when enabled. Raising a rare mineral’s weight replaces common deposits rather than increasing total deposit density; a map need not contain every enabled type.

_Avoid_: A generic untyped “metal” pin; independent sliders that increase total deposit count; guaranteeing every enabled mineral; diamonds by default; platinum as ordinary generated geology; interpreting a deposit pin as coined money or a mint; free output from deposits outside a living settlement’s claim; inventing separate cargo masses that break the price-per-pound anchors.

### Chokepoint

Pass, strait, ford, or toll segment where geography forces traffic—natural fort and **trade** leverage. One **logistics node** type for automatic **settlement** founding in increment 2. Scored from existing geography (narrow land between water/impassable cells, elevation saddles, river crossing constrictions)—not from a per-cell travel-cost raster.

_Avoid_: “Border” lines without funnel geography; castles off the corridor; requiring a **movement cost** field to recognize funnels.

### Logistics node

Geography-scored candidate cell where a **settlement** plausibly anchors—choke, **haul junction**, **surplus basin**, **refinery**, or **drain city** pressure. Increment 2 founding scores cells with **multi-tag** weights (non-exclusive—a river mouth may score junction + **drain city** + **surplus basin**); inspect shows a primary type (highest-weight contributor) plus secondary tags. An **expedition** must reach a scored node above threshold and pass **founding viability** before automatic founding.

_Avoid_: Mutually exclusive single-type assignment when several roles overlap; founding on type score alone without **founding viability**; random dots without logistics justification; founding on geometric **haul-shed** sums the new pin will not keep after claims settle.

### Founding viability

A candidate **settlement** must pass a hard check on its **provisional claim** for the outpost starting population: local freshwater exists, and either local food and **salt** cover survival, or exportable surplus over the guaranteed founding connection can buy the shortfall after **transport cost** and **port tolls**. Exportable surplus is production remaining after local survival floors are reserved. Daughter-site checks value the shortfall and surplus at the parent settlement’s current **local prices**. The founding port at **begin colonization** may also use **epoch** 0 **off-map trade** capacity, valued at **reference price** with the **off-map shipping cost** multiplier. Timber is not a baseline survival need.

_Avoid_: Local food or timber as an unconditional founding gate; founding a freshwater site with no production or exportable surplus to cover imports; counting resources the candidate would lose when **primary claim** settles; borrowing against food or salt still needed locally; inventing local prices for a site not yet in the market; assuming projected imports remove the need for a founding connection; soft “plausible” language without the hard shortfall test.

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

Graph edge or corridor where moved goods still pay after **haul decay**—ordinary overland haul, rivers, roads, sea lanes, **salt roads**—often explains **settlements** and **political middle layer** placement. Trade begins as soon as a **realm** has two living **settlements**; automatic founding guarantees the daughter is linked to its origin by a **land route**, **inland sail route**, or **open-sea route**. The candidate graph extends as later **settlements** and routes appear. Geography also proposes ordinary overland candidates between pins within one **three-day haul distance** without per-cell wilderness pathfinding. Built **road** segments create road candidates between any living settlements joined by a continuous built road path of any length; **transport cost** and capacity still decide whether flow pays. When a road candidate exists between a pair, it replaces the ordinary overland candidate so capacity is not double-counted; inland-water and open-sea candidates remain separate competing edges. **Trade clearing** chooses among available modes by delivered cost, including **port tolls**, so river or sea shipping wins when it is cheaper after the five-percent tariff and capacity remains. Two settlements receive a direct inland-water candidate when a sheltered **Sail overlay** path connects them within the configured **inland sail expedition range**; longer sheltered networks remain connected through **transshipment**. Every pair of living **port settlements** has an open-sea candidate connection regardless of land **haul-shed** distance. A candidate activates whenever **trade clearing** assigns it positive flow, whether for endpoint exchange or transshipment. Active route strength and influence may apply **directional haul friction**. Later politics may let **faction** relations and **history log** events (war, embargo, treaty) tax, block, or reopen active routes; the baseline trade pass does not implement those blocks. Dormant candidates remain visible as geography-proposed potential.

_Avoid_: “Trade route” as a line on art without volume or commodity; every road equal; requiring a built road for local exchange within **three-day haul distance**; user-drawn routes in hands-off mode; land-only candidates when **maritime reach** links distant ports; gating sail corridors behind maritime-branch latch alone; vanishing corridors when economics pause (block/embargo, do not erase geography); inventing overland candidates from a per-cell **movement cost** field; suppressing river or sea candidates merely because a road exists.

### Transshipment

Same-**epoch** movement of goods through an intermediate **settlement** that neither produces nor consumes them. The onward leg consumes route cargo capacity; transfer between maritime and inland links at a **port settlement** incurs a **port toll**. No commodity inventory is created at the intermediate site, and the intermediate does not buy or resell the cargo. Used for on-map delivery to a consuming importer and for residual **off-map trade** relays in both directions—inland surplus to an exit port for the overseas dump, and overseas goods from an entry port inland to a shortfall settlement. On-map, the goods **bilateral obligation** runs from final importer to origin exporter at net delivered value over the whole path; intermediate ports collect tolls only. For residual overseas export, the origin keeps the discounted dump proceeds while ports along the path collect tolls only.

_Avoid_: Requiring every intermediate settlement to want the commodity; free pass-through without capacity use; treating same-epoch transfer as a stockpile; tolling ordinary inland transfer without a controlling mechanic; inventing intermediate purchase/resale ledgers for pass-through cargo; forcing a port to fake local demand before inland surplus can reach the pier.

### Route cargo capacity

Finite physical quantity a **trade route** can carry during one **epoch**, shared across all commodities and both directions. Baseline capacity is `365 lb × sqrt(endpoint population A × endpoint population B)`, then multiplied by mode: ordinary overland `1×`, built road `2×`, inland water `4×`, and open sea `10×`. Distance and **directional haul friction** affect transport cost rather than creating extra capacity.

_Avoid_: Unlimited flow on a minor route; separate capacity reserved for each commodity or direction; measuring capacity only in **gold-piece value**; letting high prices create physical shipping space.

### Transport cost

Deadweight logistics friction used by **trade clearing** to prefer efficient routes and reject moves whose importer–exporter **local price** gap no longer covers haul and tolls. Ordinary overland haul costs 1 cp per pound per **three-day haul distance**, scaled by actual distance. Route-mode multipliers are ordinary overland `1`, built road `0.5`, inland water `0.25`, and open sea `0.1`; **directional haul friction** modifies the first three where applicable. A move pays only when `importer local price − exporter local price > transport + port tolls`. On-map goods obligations use net delivered value—the **importer’s local price** minus per-unit transport cost—so long hauls shrink what the importer owes the exporter while mutual credit stays zero-sum. Transport cost never becomes a settlement ledger credit to a carrier. World Builder does not model individual merchants or a carrier sector.

_Avoid_: Inventing a freight-income recipient; merchant agents; adding transport cost to the money supply; debiting transport without reducing the matching export credit; conflating deadweight haul friction with a collectible **port toll**.

### Trade clearing

Prioritized minimum-cost multi-commodity flow over active **trade routes**. Each epoch allocates shared capacity and credit in order: max-min **survival allocation**, max-min **survival comfort**, max-min **material prosperity** toward hard per-commodity targets, then residual **off-map trade** (including inland-to-port **transshipment** into the overseas dump). Delivered cost includes **transport cost**, **directional haul friction**, and **port tolls**, so inland-water or open-sea legs beat road when the tariff-inclusive math still saves money and capacity remains. When a cheaper edge fills, overflow may use the next paying mode that still has capacity. Account limits and commodity-specific constraints such as **fish curing** apply throughout.

_Avoid_: Bilateral-only matching; optimizer iteration order deciding survival; one unconstrained solve that lets prosperity outbid food; off-map trade before reachable internal demand; separate route capacity magically available to each allocation tier; forcing road when cheaper water capacity exists; abandoning remaining demand when a preferred mode saturates but another paying mode has capacity.

### Gold-piece value

Common fantasy-game unit of account used to compare unlike commodities in **settlement trade accounts**, expressed in copper pieces (cp), silver pieces (sp), and gold pieces (gp). Reference values begin with the Fifth Edition SRD Trade Goods catalog; unlisted commodities derive a compatible reference from listed staples. Account balances may persist without implying that physical coin moves or exists as a simulated commodity. **Bilateral obligation** amounts, realm balances, and **external trade account** balances are whole copper pieces—the lowest denomination does not subdivide. Unit prices may still be fractional cp per catalog unit before a trade’s total is rounded.

_Avoid_: Requiring coins to accompany exchange; assuming persistent balances answer who issues credit or sets its limits; presenting SRD reference prices as historically realistic; leaving fish, timber, or other unlisted commodities valueless; fractional copper-piece ledger balances or “−0 cp” dust from floating-point clearing.

### Commodity catalog

Baseline set of goods available to production, demand, trade, tooltips, and **settlement trade profiles**: grain, fish, **salt**, timber, base metals, copper, silver, gold, and diamonds. Base metals are the generic iron/tin output of **metals potential**; copper, silver, gold, and diamonds come from typed **mineral deposits**.

_Avoid_: One generic “metals” commodity after typed deposits exist; finished manufactured goods without production chains; commodity keys that appear in trade but not profiles and tooltips; splitting iron from tin before geography can support the distinction.

### Commodity unit

Concrete quantity used to price and move a catalog good, matching Fifth Edition conventions where available. Grain, fish, salt, timber, and metals are displayed and valued by weight; diamonds are indivisible whole gemstones valued at 5,000 gp each and assigned 0.1 lb nominal cargo weight. Simulation productivity converts into these units so GM-facing **local prices** never expose abstract resource scores.

_Avoid_: “Resource units” in tooltips or **campaign kit** output; fractional diamonds; pricing a pound and a gemstone as equivalent cargo; exposing raster scores as sale quantities.

### Food supply

Normalized edible quantity from grain and fish. Survival demand is 365 pounds per person per **epoch**, following the Fifth Edition one-pound-per-day convention. Each existing food-productivity unit converts to 36,500 pounds per epoch, preserving its current 100-person carrying capacity. Either commodity satisfies survival and **survival comfort** demand after delivery. Dietary variety between grain and fish is not a baseline **material prosperity** target.

_Avoid_: Separate starvation bars for grain and fish; forcing fish imports when grain already covers survival; erasing commodity identity from prices, routes, or tooltips; inventing food-variety prosperity demand before a later mechanic requires it.

### Fish curing

Preservation input required only when fish leaves its producing **settlement**. Exporting three pounds of fish consumes one pound of **salt** at origin; insufficient salt proportionally limits the shipment. Locally consumed fish needs no curing salt, and delivered cured fish becomes ordinary **food supply**.

_Avoid_: Shipping fresh fish without preservation; charging curing salt again at every **transshipment**; creating a persistent salted-fish inventory; consuming salt for fish that stays local.

### Reference price

Average **gold-piece value** around which a commodity’s **local price** fluctuates. Baseline catalog: grain 1 cp/lb, fish 2 cp/lb, salt 5 cp/lb, timber 0.5 cp/lb, base metals 1 sp/lb, copper 5 sp/lb, silver 5 gp/lb, gold 50 gp/lb, and diamonds 5,000 gp/gem. Grain, salt, and metal values follow Fifth Edition references; fish and timber are explicit World Builder conventions.

_Avoid_: Presenting fish or timber values as official Fifth Edition prices; local scarcity permanently rewriting the reference catalog; copying proprietary descriptions when the CC-licensed SRD values suffice.

### Settlement trade account

A **settlement**’s persistent net position from its **bilateral obligations**, measured by **gold-piece value**. Exports, toll income, and **faction tax** receipts add to the balance; imports, paid tolls, and **faction tax** outflows reduce it. The balance carries between **epochs**, allowing a settlement to save purchasing power or owe future value.

_Avoid_: Treating an accounting credit as a transported commodity; unbounded negative balances; silently creating positive balances without equal debt or explicit issuance; assuming persistence resolves trust, default, or enforcement.

### Mutual credit

Realm-wide accounting convention behind **settlement trade accounts**. Every account begins at zero; each purchase creates an equal **bilateral obligation**, so all balances always sum to zero. The effective money supply is the total outstanding positive credit created by trade, not coins issued by a mint.

_Avoid_: Initial coin grants; positive balances without matching obligations; treating total ledger entries as net realm wealth; assuming mutual credit removes the need for credit limits, trust, default, or enforcement.

### Bilateral obligation

Directed debt edge from one **settlement** to another created beneath multilateral **trade clearing**. An importer owes the origin exporter net delivered value—the importer’s **local price** minus per-unit **transport cost** over the whole path—for delivered goods, and separately owes each **port settlement** collecting a toll along the route; self-obligations are omitted. **Transshipment** intermediates do not become goods counterparties. Opposing obligations between the same pair net against each other as they arise, but third-party chains are not reassigned or transitively cleared. A settlement’s displayed realm balance is the net of all incident obligations. Baseline obligations accrue no interest. When a settlement becomes a **ruin**, every incident edge is deleted, simultaneously cancelling its debt or credit and the matching counterparty claim or obligation.

_Avoid_: Interest before political trust and enforcement exist; storing only net balances when counterparty identity matters; redundant two-way edges between one pair; silently assigning a third party’s debt to another creditor; zeroing a ruined account while leaving unmatched claims; carrying obligations against people who no longer exist; showing every debt edge on the default map; recording full local price when transport has already consumed part of the delivered value; valuing on-map goods at the exporter’s local price when the importer’s scarcity price is the delivered contract.

### Credit limit

Lowest balance a **settlement trade account** may reach through new **survival** purchases (food floors and household **salt**). At each **epoch** it equals the greater of the previous epoch’s realized on-map income or the current epoch’s physically exportable on-map surplus valued at **local prices** and bounded by available route cargo capacity. Realized on-map income is net delivered export credits plus collected **port tolls** plus creditor-side **faction tax** receipts. Exportable surplus is production remaining after local survival floors are reserved; comfort and **material prosperity** demand do not reserve against collateral. The baseline **credit limit** does not feed the **wealth overlay**; that overlay paints the same combined balance as the **settlement trade tooltip**. This collateral-like second term gives a new resource settlement immediate survival credit without requiring circular assumptions about buyer spending or future toll flow. Survival demand receives first claim on available credit, but harvest-horizon caps still bind: new survival borrowing may not deepen debt past one annual staple basket (grain + household salt valued at the **local price** ceiling) or past two years of that collateral—whichever binds first. Comfort and **material prosperity** never borrow against the **credit limit**: they spend only a nonnegative realm balance (saved credit or same-epoch earnings that have already put the account into surplus). If the account opens the **epoch** in debt, non-survival purchases stay frozen for that epoch even when staple exports later restore a surplus—those earnings may pay debt down or fund survival only. If falling income leaves existing debt below the recalculated limit, the same freeze applies and same-epoch earnings may fund survival only without deepening the debt. When pairwise trade does not run (fewer than two living **settlements**), existing **settlement trade accounts**, the last clearing inspect payload, and remembered prior realized income are left unchanged—skipped clearing does not forgive debt or erase credit memory.

_Avoid_: Unlimited survival borrowing; forgiving debt when projected income falls; discretionary imports on the credit line, while the account opens the epoch in debt, or while the account exceeds its limit; treating the baseline limit as a substitute for later political trust, default, and enforcement; wiping mutual-credit ledgers merely because pairwise trade is inactive for an epoch; letting grain-export earnings unlock prosperity spending while the settlement remains in debt from the epoch open; letting a **port settlement** spend its **external trade account** on comfort or prosperity while realm credit room forbids those tiers; funding endless headcount growth by rolling staple debt past one harvest year.

### Off-map trade

Exchange between the realm and the unseen world beyond the generated map, always mediated by a **port settlement**. It is available to the founding port during **epoch** 0; exports clear before imports so same-commit external earnings may fund initial survival. In later epochs internal trade clears first, then residual **off-map trade** runs both ways through ports. **Exports:** a **port settlement** dumps its own leftover goods, and inland sites that can reach a port move surplus there by **transshipment** (the port need not want the commodity) before the same unlimited dump sale; when several exits work, pick the cheapest **transport cost** path that still clears the worth-it check. A residual export pays only when the half-reference dump price covers **transport cost** to the exit port. Residual exports ignore **off-map cargo capacity**. The overseas payment credits the exit port’s **external trade account**; the port owes the origin the sale on **settlement trade accounts** (port net enrichment from the goods leg is **port tolls**). **Imports:** after on-map supply is exhausted, ports and inland sites may buy overseas goods through a mediating port as a last line—**2.5×** reference, plus inland haul and **port tolls**, still gated by **off-map cargo capacity** at the pier. The mediating port spends its **external trade account** for the overseas purchase; the inland buyer owes that port on **settlement trade accounts** at pass-through overseas unit cost (**2.5×** reference), net of ordinary **transport cost** on port→inland legs—the port’s relay enrichment is **port tolls**, not a goods markup. A port filling its own unmet demand from overseas still spends external credit at the pier, but comfort and **material prosperity** own-needs imports also require positive realm **credit** room under the same no-borrow / open-debt rules as on-map discretionary trade—survival and household **salt** own-needs may use the external purse without that discretionary gate. When capacity or external credit is scarce, the port fills its own unmet demand first (survival, then comfort, then prosperity), then mediates hinterland imports with what remains. Among ports that can fund and land the goods, the inland buyer uses the cheapest port→inland **transport cost** path; ties break deterministically. Export proceeds stay with the origin; path **port tolls** accrue to collecting ports’ **external trade accounts**.

_Avoid_: “International trade” before political borders exist; letting inland sites trade overseas without a mediating **port settlement**; off-map import prices at or below the **local price** ceiling; unlimited imports that erase geographic scarcity; requiring the exit port to consume or purchase residual export cargo for its own demand; forcing money-losing staple export hauls to the pier just because a path exists; preferring longer multi-toll paths when a cheaper port still pays; a mediating port starving itself to feed hinterland last-line imports while its own survival is unmet; overseas luxury shopping from the external purse while the port’s realm account is in debt or otherwise barred from discretionary imports.

### Off-map shipping cost

Baseline punitive spreads for **off-map trade**, asymmetric on purpose: residual exports earn **half** **reference price**; overseas imports cost **2.5×** reference—strictly above the **local price** ceiling (2×) so on-map supply wins whenever it can reach the buyer. Not a single symmetric multiplier; the two sides do not share one colonist slider in this baseline.

_Avoid_: Symmetric import/export markup that either softens the import last-line or further punishes the export dump; a multiplier below one on either side; applying these spreads to on-map trade; changing physical route distance or **maritime reach**; mid-run edits that revalue accumulated **external trade accounts**; presenting 2.5× import as competitive with ordinary scarcity prices on the map.

### Off-map cargo capacity

Import-only throttle on how much bulk a **port settlement** may bring in from the unseen world during one **epoch**. It uses open-sea **route cargo capacity** with the port population as both endpoints: `365 lb × port population × 10`. Commodity bulk consumes capacity rather than **gold-piece value**, so grain and timber constrain shipping far more than an equally valuable quantity of diamonds. Residual **off-map trade** exports are not limited by this capacity—the overseas dump buys any surplus that reaches the port.

_Avoid_: Capacity measured only in gp; unlimited food imports for a wealthy but tiny port; applying the same bulk cap to residual overseas exports; separate arbitrary import and export caps; diamonds consuming the same cargo space as equal-value grain.

### External trade account

Persistent ledger of **gold-piece value** a **port settlement** holds with the off-map market. Overseas dump payments for goods that exit through the port—including inland surplus that reached the pier by **transshipment**—credit this account with the discounted sale, and **port tolls** on the path credit collecting ports the same way. The exit port then owes the origin exporter the sale on **settlement trade accounts**, so inland origins hold dump proceeds as mutual-credit purchasing power while the port’s net enrichment from the goods leg is tolls. Overseas purchases spend the external claim; the balance cannot fall below zero in the baseline economy. When inland sites take last-line overseas imports through a port, the port spends its own external claim at the pier; the inland buyer then owes that port on **settlement trade accounts** at pass-through cost. Inland sites do not hold or share the external purse. The ledger is separate from realm **mutual credit**, allowing internal settlement balances to continue summing to zero while combined on-map and off-map accounting remains balanced.

_Avoid_: External borrowing before diplomacy and politics define it; adding external sales directly to the internal ledger without a counterparty; one invisible shared treasury for all ports; giving inland sites their own **external trade account**; treating the off-map market as another visible **settlement**; free overseas calories for hinterlands that never settle with the mediating port; ports skimming a goods markup on mediated overseas imports instead of earning through **port tolls**; mediated dump sales that credit inland without the exit port booking the overseas claim.

### Local price

Current-**epoch** **gold-piece value** of a commodity at one living **settlement**, computed once before **trade clearing** from that site’s own pre-trade production (supply) and population-scaled demand targets (demand): `clamp(sqrt(demand / supply), 0.5, 2)` against **reference price**. Demand for price formation includes survival, **survival comfort**, and **material prosperity** targets; allocation priority still clears those tiers in order. No supply with positive demand uses the upper bound, no demand with positive supply uses the lower bound, and neither supply nor demand leaves the reference unchanged. Clearing does not recompute prices mid-epoch. Candidate **trade route** links do not pool sites into a shared sticker price—surplus and deficit regions keep distinct **local prices** so goods move when the importer–exporter gap still exceeds **transport cost** and **port tolls**. On-map goods obligations use the importer’s **local price** minus per-unit **transport cost**; **port tolls** are assessed on the importer’s full **local price**.

_Avoid_: One realm-wide sticker price merely because candidate routes connect sites; division-by-zero or `0/0` behavior left implicit; unbounded scarcity spikes; persistent price history in the baseline economy; allowing luxury demand to outbid food required for survival; feeding post-trade quantities back into the same epoch’s price; using survival-only demand for prices while prosperity still wants the good; requiring prior flow before geography can carry trade; implementing embargo or war route blocks inside the baseline trade pass.

### Settlement

A persisted population node (hamlet to **drain city**) whose tier and role should be justified by **arable envelope**, **chokepoint**, **strategic resource**, or **trade route**—not random dots. Exposes tier label and population count on inspect; size constrained by local **population ceiling** in **single-colony survival**. Carries a **settlement map number** (1…N, assigned at founding) for overlay and **campaign kit** cross-reference, separate from the opaque internal id. The founding **settlement** is created at **begin colonization** (**epoch** 0) from **starting population** in **colonist settings**—not on the first **epoch step**. **Survival triad** resolve (clamp to **population ceiling**, freshwater non-sustain) is deferred to increment 1 (#392); until then **epoch** 0 records the configured headcount. Population changes each later **epoch** from food surplus: **growth** only when local production (after salt spoilage) exceeds consumption **and** the combined **settlement trade tooltip** wealth (realm balance plus nonnegative **external trade account**) is nonnegative; imported food—including credit-financed staples—may hold headcount and slow die-off when deliveries fall short, but does not create growth surplus. Stall at local balance, while indebted, or when local production merely covers the current headcount; decline when delivered food is below consumption. After that food pass, any living **settlement** whose combined wealth is at or below zero (the **wealth overlay** orange/red band) loses the larger of **50%** of its headcount or **five** people to off-map emigration—those people leave the realm and are not assigned to another pin. Daughter **settlements** founded in increment 2 start at a fixed small outpost headcount (implementation-tuned constant, below founding `startingPopulation`) and use the same global **three-day haul distance** from **colonist settings** for their local **haul-shed**—centered on the new pin, not the **founding landing**. Living **settlements** may **merge** only via **administrative federation** in increment 3 (see **settlement merge**). When headcount falls to **10** or fewer, the remaining people leave the map and the pin becomes a **ruin**: no calorie claims, no **expeditions**, still visible for **history log** / **faction** memory; hinterland frees for living neighbors on the next claim recompute; active **trade routes** to the site deactivate (candidates may remain). A **history log** abandonment (or later federation merge) records the outcome. Ruins are not fully removed and do not keep zombie claims.

_Avoid_: “City” / “town” labels without simulation backing; one capital per kingdom by default; tier without backing population accounting; fixed per-**epoch** headcount increments divorced from **survival triad** production; reusing full founding `startingPopulation` for every daughter site; per-**settlement** **three-day haul distance** knobs in increment 2; empty **settlements** at **epoch** 0 after commit; deleting failed sites with no map memory; zero-population pins that still own hinterland or dispatch **expeditions**; merge purely because **haul-shed** regions overlap; growing headcount from credit-financed food imports; growing headcount while the settlement’s combined wealth is negative; tracking emigrants as transfers to another on-map **settlement**; keeping a living pin with a vestigial handful of residents below the abandonment floor.

### Settlement merge

Absorption of one living **settlement** into another: population transfers to the surviving pin; the absorbed pin becomes a **ruin**; a **history log** entry records the event. Because the people remain, all **bilateral obligations** and external credit transfer to the surviving settlement and duplicate counterparty edges net together rather than being cancelled. The only merge path is **administrative federation** in increment 3 ([#394](https://github.com/enmaku/portfolio-site/issues/394))—social, logistics, and politics amalgamation of town-tier+ urban cores. Increment 2 does not absorb **settlements**; cluster density is controlled by founding spacing and the **realm expedition budget** ([ADR 0015](../docs/adr/0015-world-builder-expedition-budget-and-settlement-merge.md)).

_Avoid_: “Annexation” without political or infrastructure cause; instant merge on proximity alone; logistics-only outpost reabsorption or living-sphere consolidation as product mechanics; cancelling balances when population transfers; deleting absorbed pins with no **ruin** memory; merge without **history log** row; **administrative federation** before increment 3 latch.

### Settlement tier

RPG-facing size band for a **settlement** from **absolute population count**—hamlet, village, town, and higher bands use fixed headcount thresholds (concrete numbers tuned in implementation), not fractions of local **population ceiling**. A **town** is big in absolute terms; a newer **settlement** below its ceiling but above town threshold is still a town, not a **hamlet**. Primary label on the map; inspect pairs tier with raw population count. **Population ceiling** caps growth; tier reflects how large the **settlement** has actually become.

_Avoid_: “Level” in domain language; ceiling-relative tier (e.g. “60% of local cap = town”)—mislabels large young **settlements** smaller than older neighbors; tier divorced from population accounting.

### Population overlay

Map heatmap of where people actually are after each **epoch**'s **population collapse**—bulk population density, not just **settlement** pin dots. Each **settlement** runs a **core + hinterland** collapse on its claimed cells: a fixed fraction at the pin (urban cluster) and the remainder spread across claimed hinterland weighted by food access (arable productivity, with a floor on shore **fish** cells). Because claims are exclusive (nearest pin by cell distance), cells do not stack density from multiple **settlements**. Each pin’s total population still matches that **settlement**’s headcount. The pin carries **settlement tier** and total population; the overlay shows spatial spread.

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

Colonial origin umbrella for one founding wave: all **settlements** that descend from the same **founding landing** share one **realm** (shared empty-continent arrival story). From **begin colonization**, the **founding faction** is the realm’s first political body; after latch, the **realm** remains as cultural/colonial origin while additional **factions** may carry politics, **rivalry**, and **faction territory**—a **realm** may contain multiple **factions**. **Campaign kit** may describe “colonial **realm**, N **factions**” after fracture. If every **settlement** is a **ruin**, the **realm** remains as colonial memory only—no **expeditions**, no further latch/politics progress—but the run stays in `running` for scrub/export/**reset colonization** (no auto-reset).

_Avoid_: Equating **realm** with a single **faction** after latch; calling the pre-latch **realm** a **faction**; retiring **realm** when politics emerge; treating **realm** as map-drawn borders separate from founding lineage; forcing **reset colonization** when the colony fails; “polity” as a synonym for **realm** or **faction**.

### Realm economy

Left-panel **realm** extremes board during `running`: for each present-on-map **commodity catalog** good (always grain, fish, timber, base metals; **salt** and typed **mineral deposits** only when the landmass has pins—same presence rule as **sim status** resource claims), clickable Highest and Lowest **local price** this **epoch** as compact **gold-piece value** per catalog unit (e.g. `5 cp/lb`, diamonds as `/gem`—value only, no settlement name or coordinates in the row); plus clickable Highest and Lowest living balances (value only, no per-unit suffix) using the same combined figure as the **settlement trade tooltip** / **wealth overlay** (**settlement trade account** plus nonnegative **external trade account** credit); plus clickable Highest and Lowest last-**epoch** **port toll** income among living **port settlements** (same collected-toll figure as the tooltip tolls row—on-map toll **bilateral obligations** plus off-map external toll credits; omitted when the realm has no living ports); plus clickable Highest and Lowest last-**epoch** net **faction tax** among living settlements (same signed figure as the tooltip tax row—positive collected, negative paid; value only). Activating a value places **settlement focus** on the responsible living **settlement**. When only one living **settlement** exists, or several tie, both Highest and Lowest still show (same value if tied); focus uses a deterministic tie-break so the pin does not jitter across **epochs**. Politics content joins this panel when **factions** exist; until then the panel is economy-only. Settlement-level full commodity lists stay on **settlement trade tooltip** / **campaign kit**.

_Avoid_: Replaying read-only **colonist settings** here; dumping clearing debug payloads; ranking commodities by production volume or surplus when **local price** is meant; ranking wealth on realm ledger alone while ignoring off-map credit; including **ruins** in the lowest-balance extreme; inventing placenames in chrome; collapsing Highest/Lowest into one control when values match; listing salt/mineral commodities with zero world pins; competing with the right-panel census for population totals; labeling wealth extremes “wealthiest” / “poorest” in chrome; omitting catalog units from price extremes; ranking inland settlements into **port toll** extremes; inventing toll income for non-ports; folding **faction tax** into the **port toll** extremes; omitting signed tax outflow from the Lowest extreme.

### Faction

Simulated **power center** or aligned group with territory claims across one or more **settlements**, economic wants, and **rivalry** edges. At most **12** living (**active**) **factions** at once (ColorBrewer territory palette); further mints prefer join-first when applicable, otherwise stay **unaligned** until a slot frees. The **founding landing** mints one **founding faction** at **begin colonization** so the colonial banner exists from the first running **epoch**—not only after **supply-chain independence**. Later **strategic overstretch**, latch fracture, **maritime peel**, defection, and absorption split or reassign membership; the colonial-origin **realm** remains the umbrella. A **city-state** is a **faction** whose capital **settlement** has reached sovereign town-tier or higher.

**Between factions** relations are flat: **rivalry**, trade, embargo, war, and **faction absorption**—never liege–vassal nesting of one living **faction** under another. **Inside** a **faction**, capital / apex house and **vassal** seats are real structure (**conditional loyalty**, defection risk)—the playlist **political middle layer**, not map-drawn borders until defection.

**Membership is sticky:** a **settlement** stays in its **faction** (including as **vassal** or **trade partner**) until an explicit political event—**strategic overstretch**, **vassal** defection, **maritime peel**, **faction absorption**, latch **fracture** into staggered mint queues, trade-backed **rebellion** join/peel, **trade partner** peel, or **faction** extinction / **settlement** abandonment. Out-of-reach founding mints a **faction** at the daughter in the same founding commit (not a later silent recolor). Shifts in **logistics connectivity**, **trade routes**, or **haul-shed** overlap raise pressure toward those events; they do **not** silently re-partition **faction** membership each **epoch**. **Soft power** may change **factional control** paint on the **faction territory overlay** without changing membership.

**Anti-churn:** inverse membership events (defect then re-absorb, peel then reunify, and the reverse) require the underlying cause to **clear and re-arm**—the condition must have been false for a stretch of **epochs** before it can fire again—and a short refractory floor so the same subject cannot flip on consecutive **epochs** even when the cause looks clean. Threshold oscillation alone does not rewrite banners. Rationale: [ADR 0019](../docs/adr/0019-world-builder-sticky-faction-membership.md).

After increment 3 latches, additional **factions** may form from **logistics connectivity components** that are *not* the senior/**founding faction**’s component: living **settlements** (population > 0) linked by shared **haul-shed** overlap, **road** paths within **three-day haul distance** budget, or **maritime reach** / sail sea-lanes between **Sail overlay**-reachable sites (sea links extend much farther than land **haul-shed**). Those detached components become **unaligned** and mint over staggered **epochs** (**history log** emergence entries)—not an instant full remap on the latch **epoch**. Hamlets and villages inherit their component’s **faction** once that **faction** exists. Until a component’s emergence fires, its living pins may sit as **unaligned settlements**—short-term independence is allowed and useful as a story hook. The capital is the highest-tier living **settlement** in the component; if the capital becomes a **ruin**, capital passes to the next highest-tier living member. Daughter sites with `originSettlementId` founded inside **strategic overstretch** reach begin as **vassal** dynasties under the origin’s **faction** until **conditional loyalty** breaks; out-of-reach foundings mint their own peer **faction** instead. **Ruins** may remain listed as legacy seats in **faction** memory without owning territory fill or claims. A **faction** with no living members becomes extinct (**history log** records extinction)—not an empty territory holder.

**Maritime peel:** when the maritime branch of **supply-chain independence** is true, the founding-type **drain city** is removed from inland components and forms its own **faction** / **city-state** even if sail or land still reaches inland sites. Land-branch clustering still counts sail as a unifying link; maritime independence is the exception that peels the port.

**Expeditions**, automatic founding, **roads**, and **exploration fog** continue after latch—politics and exploration are concurrent layers, not a freeze. New **settlements** founded inside the dispatching seat’s **strategic overstretch** reach join the origin **settlement**’s **faction** as **vassals** until **conditional loyalty** breaks. Foundings outside that reach mint a new peer **faction** at the daughter (apoikia-style)—including typical long **open-sea expedition** landings beyond administrative reach. Shared colonial kinship after a split lives on the **realm** (and **legacy** **rivalry** causes). If the origin is temporarily **unaligned** (post-latch fracture waiting on staggered mint), an in-reach daughter starts **unaligned** with its origin cohort rather than inventing a banner early; an out-of-reach founding still mints its own **faction**.

### Unaligned settlement

Living **settlement** with no current **faction** membership—short-term political independence inside the **realm**, not a map **faction** and not a **city-state**. Not a permanent third political tier beside **faction**. Useful **campaign kit** hook (“free town for now”). Kit and politics chrome list them under the **realm** as unaligned / free towns with crystallize-or-reabsorb risk—no **rivalry** edges (they are not **rivalry** actors). On the **faction territory overlay** they paint gray only when no **faction** holds **factional control** over them; sustained **soft power** from a multi-control **faction** paints that **faction**’s hue while membership stays **unaligned** (no **faction tax**). They **are** eligible **conquest** stakes: defense is only local **martial capacity** + tier **defender advantage**—the soft-power **faction** does not project in—so remaining free for long requires exceptional strength or a fast crystallize / voluntary re-absorb before a neighbor’s resource **Want** lands.

**Entry paths (baseline v1):** staggered post-latch wait before a component mints; daughters of still-**unaligned** origins; **soft independence**—a **conditional loyalty** break that would otherwise **spawn** a new **faction**, but the site is not yet **faction**-ready (below town-tier, or dependence/independence still ambiguous). Join-first defections (still corridor-dependent on a neighbor **faction**) still **join** that **faction** as **vassals**—they do not go **unaligned**. **Maritime peel**, clear town-tier independence spawns, out-of-reach founding mints, war **faction absorption**, and dependence **faction absorption** still assign **faction** membership immediately. Catastrophe orphans (all town-tier+ members ruined while lesser pins live) are **out of v1**—existing capital-succession / extinction rules stay.

**Outcome fork (hybrid):**
- **Cohort waiting on staggered mint:** when that component’s emergence event fires, still-**unaligned** living pins in the component **crystallize** together as the new **faction**.
- **Lone / mid-run unaligned** (not queued on a pending component mint): after a sustained stretch of **epochs**, if the site meets the new-**faction** bar (at least one town-tier+ living pin in its unaligned cohort and no asymmetric survival dependence on an existing **faction**’s corridors), it **crystallizes** into a new **faction**; if survival / corridor dependence on a neighbor **faction** asserts first, it is **re-absorbed** as a **vassal** (absorption-family causes; no prior banner to extinguish); if sustained **soft power** (commercial dominance) asserts first without that survival dependence, it **joins** that **faction** as a **trade partner** (peaceful commercial affiliation—**history log** event, not silent recolor).
- **Conquest:** a neighboring **faction** wins a major-war resolution over the pin → joins the victor as a **vassal** (recent-conquest resentment applies like any conquered seat).

_Avoid_: Leaving most of the map **unaligned** as the steady state; treating **unaligned** as a full **faction** in rivalry/territory chrome; permanent unaffiliated status with no crystallize-or-reabsorb-or-conquer pressure; equating **unaligned** with **ruin**; racing every stagger delay through the lone viability clock instead of component emergence; routing join-first defections through **unaligned**; v1 catastrophe-orphan → **unaligned** cascades; shielding free pins from **conquest**; treating **soft power** paint as sticky membership or **faction tax** liability.

### Factional control

Who the **faction territory overlay** attributes a living **settlement**’s **primary claim** to. Broader than sticky membership: includes capital / member / **vassal** / **trade partner** seats of a **faction**, and map-gray pins under that **faction**’s sustained **soft power**. Membership changes only on explicit events; **soft power** control may shift with trade dominance under anti-churn without rewriting banners. Rationale: [ADR 0021](../docs/adr/0021-world-builder-faction-territory-control-not-membership-only.md).

_Avoid_: Equating control with membership; treating overlay hue as proof of **faction tax** or **rivalry** actor status.

### Soft power

Non-membership **factional control** earned when a map-gray pin (**unaligned settlement** or singleton/**map-unaligned** **faction** capital) sustains dominant on-map trade with one living multi-control **faction** over rivals—commercial pull, not **faction tax** or liege obligation. Each **epoch**, score the pin’s on-map trade **gold-piece value** with each **faction** (goods **bilateral obligations** to/from that banner’s taxed members and **trade partners**). Dominance arms for **faction** F when F holds a clear majority of that pin’s on-map trade (**>50%**) **and** at least **2×** the next **faction**’s share (or the runner-up is ~0). Same score, two streak lengths (anti-churn family; exact counts stay tuning): a shorter streak arms **faction territory overlay** paint and taxed-member trade-backed **rebellion** pressure; a longer clear hold after paint is already true may fire a peaceful **history log** join into that **faction** as a **trade partner**—still no levy and no banner shield. Pure **off-map trade** does not count. If the joining pin was the last living member of a singleton/**map-unaligned** **faction**, that old **faction** extinguishes in the same event (ordinary extinction / absorption-family **history log**)—no empty banner, no nested living **faction**. Does **not** enlist that **faction** as a defender or ally in **conquest**—**faction tax** (sticky taxed membership) buys projected defense; **soft power** does not. Not whole-**faction absorption** from commerce alone.

_Avoid_: “Trade alliance” as a second polity type; silent membership recolor from trade volume; **soft power** over pins that already hold sticky membership in another **faction** (membership wins for paint; trade pull may still pressure **rebellion**); counting off-map-only commerce as on-map dominance; inventing ally contributors for soft-power-controlled free towns; skipping the **history log** when commercial affiliation becomes sticky; arming from plurality without majority or from a thin lead over a near-peer rival; single-**epoch** flicker without streak / clear-and-re-arm; sticky peaceful join on the same short streak that only meant to paint a free town.

### Trade partner

Sticky intra-**faction** membership band: a living **settlement** under a **faction**’s banner that does **not** pay **faction tax** and is **not** a **vassal** (no liege / **conditional loyalty** peel). Entry: trade-backed **rebellion** win toward the dominant trading **faction**, or peaceful sustained-**soft power** join from a map-gray pin (**history log**)—including a singleton capital, whose prior **faction** extinguishes in that commit. Paints that **faction**’s color on the **faction territory overlay**; pin size matches ordinary member / **unaligned**. In **conquest** (as stake or contributor), defends or contributes **alone**—own **martial capacity** only; the banner does **not** add allied **projected might**. Exit (explicit events only): commercial dominance for that banner **clears and re-arms** for a sustained stretch → soft-**unaligned** (residual **soft power** paint may remain without membership); **conquest** by another **faction** → **vassal** of the victor; survival / corridor dependence on the host (or another) **faction** → upgrade/switch into taxed **vassal**; host **faction** extinction. No auto-promote to taxed member from high trade alone; no one-step peel into a rival’s **trade partner**—affiliation ends first, then rival **soft power** / peaceful join may fire later. No armed **rebellion** from **trade partner** status—commercial peel (or **conquest**) only. Distinct from **soft power** (no membership) and from taxed capital/member/**vassal** seats (those buy **faction** projection).

_Avoid_: Calling **trade partners** **vassals**; charging them **faction tax**; nesting them as a separate map **faction**; using **trade partner** for whole-**faction absorption**; granting them taxed-member defense while they skip the levy; silent commercial join or peel without a **history log** event; flickering affiliation from single-**epoch** trade noise; leaping from one banner’s **trade partner** to another’s in one event; staging **rebellion** for seats that already skip the levy.

### Strategic overstretch

Condition where a **faction**’s geographic and territorial commitments—living member **settlements** and corridors under its capital—surpass the economic and administrative capacity that capital can hold together (Kennedy’s sense, adapted to colonial **supply-chain feudalism**). Primary mid-run fission path: an explicit sticky political event peels a **contiguous** hinterland into a new **faction**. In baseline v1, capacity is a flat living-membership count: the author **strategic overstretch** span in **colonist settings** (default **12**, slider **6–24**, locked at **begin colonization**). Commitments are living membership under that capital. Capital wealth / strength modulating the threshold is deferred. Arms whenever active **factions** exist—including pre-latch—alongside **vassal** membership events; does not wait for **supply-chain independence**. Latch fracture and **maritime peel** remain separate triggers. When armed after **3 consecutive epochs** above span: seed is the farthest town-tier+ living member from the capital (**road** / short-haul land graph hops only—**open-sea** sail does not count as an administrative hop); peel that seat plus every living member closer to it than to the capital on that same land graph, as one contiguous block; mint a new peer **faction** with capital = the seed seat (peeled members join that banner—not as **vassals** of the parent); open a **legacy** **rivalry** edge between parent and peeled **faction**. Skip peels that would mint a singleton **faction** or empty the parent. Same clear-and-re-arm and refractory anti-churn as other membership flips. Distinct from **vassal** **conditional loyalty** (seat-level allegiance break), **maritime peel**, post-latch **fracture**, and **administrative federation** (which merges pins *inside* one **faction**).

**Founding beyond reach:** **strategic overstretch** reach is the dispatching seat’s **land expedition range** (same **colonist settings** slider—default **2×** **three-day haul distance**), measured on the land/short-haul graph from that sender—not from the **faction** capital, and not the membership **span**. When an **expedition** founds a daughter **settlement** outside that reach, that pin mints a new peer **faction** immediately (capital = the new seat)—it does **not** join the sender’s **faction** as a **vassal**. Emit a **history log** emergence (overstretch / apoikia cause) and open a **legacy** **rivalry** edge between parent and new **faction** (kinship split)—not war, not embargo; sail trade may continue. Early open-sea exploration therefore tends to seed multiple coastal **factions** that then expand inland. Foundings inside that reach still join the origin’s **faction** as **vassals** until a later political event. The membership **span** slider stays separate (mid-run shed only).

_Avoid_: Admin span, overstretch peel, imperial overstretch as product language; using **strategic overstretch** for every **vassal** defection; silent recolor of the whole map when size grows; peels that shatter into singleton **settlements**; equating overstretch with war defeat or **faction absorption**; treating bare local food surplus as the primary mid-run fission path; weighting the v1 threshold by capital population or wealth; peeling by hop-ring alone without a town-tier seed seat; a second mid-run hop-cluster “peripheral peel” cadence beside overstretch in baseline v1 (deferred); counting **open-sea** sail hops when choosing overstretch peel seeds or hinterlands; forcing every long-range daughter into the sender’s **faction** as a **vassal** when the founding sits outside **strategic overstretch** reach; treating the membership **span** number as a map radius; measuring founding reach from the **faction** capital instead of the expedition sender; a third colonist slider for reach when **land expedition range** already defines it.

### Faction absorption

Event where one living **faction** ceases and its member **settlements** join a surviving **faction**. Counterpart to fission (**strategic overstretch**, **vassal** defection, **maritime peel**, connectivity split). Does not create nested **faction**-over-**faction** hierarchy—the absorbed body ends; members sit under the survivor (typically as **vassals** until **conditional loyalty** restabilizes). Distinct from **administrative federation**, which merges **settlement** pins inside one **faction**.

Impetus classes in baseline v1 (same **history log** kind; cause differs):

- **Asymmetric survival dependence:** one **faction** cannot meet **survival triad** / bulk-food / critical **strategic resource** needs without the other’s controlled **trade routes** or **chokepoints** for a sustained stretch of **epochs**, while the stronger side remains viable without the weaker—weaker is absorbed (**resource** / **logistics** cause). Primary expected peaceful path. Survivor = the viable / stronger **faction**.
- **Mutual re-integration:** two **factions**’ settlement graphs reconverge into one **logistics connectivity component** (**haul-shed** overlap, **road**, or **maritime reach** / sail) *and* trade dependence is high both ways—a temporary peel that economics healed (**logistics** / **legacy** reunification cause). Survivor = the senior **faction** (earlier emergence **epoch**; if tied, the line that still holds the **realm** founding capital when present, else higher-tier capital / larger living population).
- **Conflict:** major-war **WOAC** extinguishes the loser only when conquest leaves no living members (or no capital-succession path)—then remaining ruins/memory fold into the victor (**legacy** cause). Survivor = the victor. Ordinary conquest transfers only the **contested settlement**; it does not absorb the whole losing **faction** by default.

Whichever trigger hits first may fire; heavy trade alone without A or B does **not** absorb—persistent commerce between separate **factions** can remain **rivalry** or ordinary exchange. Paired with **strategic overstretch** as the baseline mid-run fission/fusion story: overstretch sheds contiguous hinterlands; asymmetric dependence reabsorbs bodies that cannot stand alone. No separate size-only “tiny **faction**” absorb threshold in v1.

Emits a **history log** absorption row; **rivalry** edges involving the absorbed **faction** close or transfer as **legacy** causes on the survivor.

_Avoid_: Empire→kingdom nesting that keeps both **factions** alive under a liege link; absorbing without a recorded cause; treating **administrative federation** as inter-**faction** annexation; requiring war for every fusion when trade dependence already binds the pair; absorbing solely because two **factions** trade a lot while each stays independently viable and connectivity-separate; always keeping the stronger banner on peaceful reunification (erases senior-lineage story); always keeping the older banner on dependence annexation (erases conquest story); a size-only “tiny **faction**” absorb gate beside asymmetric dependence; treating every successful conquest as whole-**faction absorption**.

### Administrative federation

Increment 3 ([#394](https://github.com/enmaku/portfolio-site/issues/394)) **settlement**-pin merge path: separate town-tier+ urban cores in the same **logistics connectivity component** federate when shared **road** / **trade route** infrastructure and governance pressure make a single **faction** capital inadequate—historical amalgamation of adjacent pottery towns or suburban cores. Emits a **history log** **settlement merge** row; surviving pin keeps or inherits capital status within the **faction**. Not the path that merges two **factions**—that is **faction absorption**.

_Avoid_: **Administrative federation** before increment 3 latch; federating hamlets that never reached town-tier; federation without **road** or **trade route** ties; instant federation on increment 3 latch **epoch**; logistics-only outpost reabsorption or living-sphere consolidation as separate merge paths; using federation language for whole-**faction** annexation.

_Avoid_: “Polity” as a second map-visible grouping unit beside **faction**; “race = faction”; static good/evil teams; 1:1 **faction** ↔ single hamlet without territorial claims; land-only clustering that ignores sail ties between distant ports; one **faction** per **settlement** on the latch **epoch**; **road**-only graphs when **maritime reach** still links the **realm**; freezing exploration when increment 3 latches; maritime latch with no **faction** split while the **drain city** stays sail-linked; liege–vassal trees between living **factions**; kit copy that ranks one **faction** as subordinate kingdom of another; forcing every daughter founding into the sender’s **faction** as a **vassal** when the site sits outside **strategic overstretch** reach; silent per-**epoch** recolor of **faction** membership from connectivity alone; year-to-year banner flip-flops from threshold flicker without clear-and-re-arm and refractory.

**Baseline v1 non-goals (polity):** nested living **faction**-over-**faction**; silent connectivity recolor of membership; treating *in-reach* daughters as day-one apoikia (skipping the **vassal** step); catastrophe orphans → **unaligned**; overlapping **haul-shed** as co-owned political fill; **faction absorption** from heavy trade alone while both sides stay viable and connectivity-separate; **unaligned** as **rivalry** actors or fake **faction** legend entries.

### City-state

A **faction** whose capital **settlement** has reached sovereign town-tier or higher—an urban polity with its own **grain circle** or **maritime reach** dependence, not merely a fort on the frontier.

_Avoid_: “Kingdom” when only one city is sovereign; **city-state** before increment 3 independence; labeling every **settlement** a **city-state**.

### Rivalry

Directed political tension between **factions** with stored causes—for GM-readable hooks. Edges form sparsely when a concrete **obstacle** appears (embargo, **chokepoint** contest, succession claim)—not for every adjacent **faction** pair by default. Causes record on creation or intensification across: **resource** (monopoly, embargo), **logistics** (**chokepoint**, **grain circle**, sea-lane), **territory** (border, succession), **legacy** (war, treaty, kinship split from out-of-reach founding / apoikia), and **belief** (legitimacy, schism). One cause type per creation/intensification event. Edges persist through peace; causes accumulate. Out-of-reach founding always opens a **legacy** edge between parent and new **faction**; mid-run **strategic overstretch** peel likewise opens **legacy** rivalry between parent and peeled **faction**.

_Avoid_: “They hate each other”; **rivalry** without **legacy** or resource **obstacle**; logging every minor insult; auto-**rivalry** for every neighbor or active **trade route** alone; inventing a separate “colonial daughter” relation type beside **legacy** **rivalry**.

### History log

Ordered **epochs** and events that feed **legacy** and reshape borders. Browsable in-app via filterable **event feed** (increment 3) that lists structured entries and may focus involved **settlements** on the **present-day** map—not historical map rewind. **Epoch** 0: one founding entry at **begin colonization** (#391). Increment 2 (#393): one structured entry per daughter **settlement** founded (**epoch**, site, primary **logistics node** type, originating **settlement**) and per **settlement** abandonment—no expedition lifecycle, rejected-site, or merge entries.

Increment 3 **event feed** catalog (structured fields, not prose): increment 3 latch; **faction** emergence (including out-of-reach founding mint and mid-run **strategic overstretch** peel); **faction** extinction; **faction absorption**; **city-state** founding; daughter **settlement** founding; **settlement** abandonment (headcount at or below the abandonment floor → **ruin**); **settlement merge** via **administrative federation**; **vassal** defection; major war start/end; **rebellion** start/end; treaty/peace; embargo when it creates or intensifies **rivalry**. Feed filters map to these kinds. Do **not** log routine **economic contest** ticks, culture **WOAC** internals, or **expedition** lifecycle.

_Avoid_: “Timeline” as flavor-only; events that don’t touch **power centers**; export-only log with no in-app investigation; deferring the founding entry until the first **epoch step** when **epoch** 0 should record the commit; logging every **expedition** departure or failed-viability survey; per-**epoch** contest summaries or culture-cycle rows in the feed.

### Epoch scrubber

**Cut** from v1 scope ([ADR 0014](../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md)). Past-**epoch** map rewind and per-year snapshot storage (`committedTips`) were removed for session size and refresh performance. Increment 3 investigation uses **event feed** + **present-day** map focus instead.

_Avoid_: “Epoch scrubber”, “scrubbed year”, or “committed tip” when the product means **event feed**, **history log**, or **present day** inspect only; implying refresh restores historical map states beyond **`historyLog`** entries.

### Epoch

Discrete simulation tick for **colonization phase** and **history log**—one in-world **year** per tick in v1 (harvest cycles, haul economics, and **history log** entries align to annual steps). Increment 2 advances one **epoch** per **epoch step**; multi-year **epoch batch** stepping is deferred to increment 3 (#394). No auto-stop—the user keeps stepping indefinitely. **Present day** is the latest simulated **epoch** only. Within each annual tick, order is fixed: **network** (**expeditions**, founding, **roads**) → hinterland **primary claim** recompute → production and trade clearing → **survival triad** / **population collapse** → politics (**supply-chain independence** latch, **factions**, **conflict engine**). Trade clears before survival so current-year imports can prevent decline or **ruin**. Major-war trade blocks decided in politics apply to later **epochs**’ clearing, not a rewrite of the same year’s already-cleared flows. **History log** events for that year are written as their causes complete.

_Avoid_: “Year 1042” precision without source events; real-time wall-clock simulation in v1 copy; conflating with **terrain authoring** (no **epochs** until **begin colonization**); generational or seasonal ticks unless explicitly switched in **colonist settings**; **equilibrium state** or **political equilibrium** as stop triggers; evaluating latch on a pre-founding network; running survival before claims settle for new pins.

### Epoch step

Manual advance during **colonization phase**—in increment 2, advances exactly one annual **epoch** tick per action. Multi-year **epoch batch** stepping (N sequential annual ticks per control action) is deferred to increment 3 (#394). Primary time control for inspecting causality; no fixed endpoint. Always advances **present day**.

_Avoid_: “Turn” in domain language when **epoch** is the persisted unit; sub-epoch micro-ticks in user-facing copy unless explicitly modeled; implying the sim should halt when resources or population stabilize.

### Sim status

Right-panel **realm** census during **colonization phase** `running`, shown from **begin colonization** (**epoch** 0) onward: present-day **epoch**, living **settlement** count, **ruin** count, active **expedition** count, built **road** segment count, active on-map **trade route** flow count for the current **epoch**, current-**epoch** **off-map trade** volume as compact **gold-piece value** (gross import+export goods value at off-map unit prices), total living population, Settlement Population Highest/Lowest figures as clickable values (no settlement names—activating places **settlement focus**), and a compact **resource claim** table for discrete extractable pins—**salt** and typed **mineral deposits** (copper, silver, gold, diamonds)—as claimed / world totals. Rows whose world total is zero are omitted (e.g. diamonds disabled in terrain generation). “Claimed” means inside some living settlement’s exclusive **primary claim**. Compact counters and extremes only—no milestone list, chronicle, placenames, continuous-raster cell tallies (timber, metals potential, arable, fish), realm money-supply aggregates, exploration-percent chrome, tier histograms, or ceiling-pressure rows. Does not surface **frontierExhausted** or other rarely-true dispatch internals. Plain counts and the off-map volume figure (**epoch**, living, ruins, expeditions, roads, on-map flows, off-map volume, totals) are not clickable; only extreme values are.

_Avoid_: Waiting for the first **epoch step** before showing the census; author-facing “frontier open/exhausted” chrome; hydrology **generation report** fields; founding / abandonment event lists in the sidebar; counting continuous resource smears as pin rows; showing empty pin types with zero world deposits; duplicating **realm economy** price/wealth extremes here; putting mutual-credit money supply in this panel; showing a raw off-map trade *count* instead of commerce volume.

### Founding chronicle

Scrubbed sidebar surface. Founding-wave and settlement milestone narrative is not shown in either chrome panel; that detail belongs in the **campaign kit** (and later the filterable **event feed** at **present day**). Prefer **sim status** for the **realm** census.

_Avoid_: Reviving a right-panel chronicle or milestone list under another name; dumping `historyLog` rows into sidebars.

### Continuous colonization run

Optional future UX: simulation auto-applies **epoch batch** ticks with pause between batches—same annual tick semantics as **epoch step**, not a different time model. Deferred past increment 3 (#394)—increment 3 ships manual **epoch step** and editable **epoch batch** only; continuous run waits until stepping, **event feed**, and **campaign kit** export are proven.

_Avoid_: “Real-time strategy mode”; wall-clock tied to in-world days; auto-run as the only way to reach a sim-detected endpoint; requiring continuous run to deliver increment 3 politics and history.

### World document

Serializable snapshot: **geography seed**, stage parameters, geography **fields**, colonization state (**founding landing**, **colonist settings**, **settlements**, **factions**, **trade routes**, **history log**), derived **culture** summaries. Authoritative in-memory sim state during a session is always **present day** (latest **epoch**). **Campaign kit** export derives from **present day**—repeatable without ending the run. Session survival (page refresh) restores present-day colonization state and **`historyLog`**—not per-epoch snapshot arrays. Extends the existing Pinia/localStorage pattern alongside generation settings; no separate colonization save/load UX.

_Avoid_: “Save file” in UI copy when the artifact is author-facing; PNG-only export as the whole **world**; a redundant **history seed** field; explicit save/load buttons for in-progress colonization; treating export as a terminal sim state; refresh that keeps phase/landing/settings but discards **settlements** or **history log**.

### Campaign kit

Primary GM deliverable: map layers, structured **world document** slice, brief for **present day** (**factions**, **rivalries** with causes, key **settlements**), story hooks (border friction, **strategic resource** pressure, **vassal** defection risk), **reverse-engineering culture** notes per **faction**, and per-**settlement** **trade profile** (what each place wants and supplies for table-side trade play). Includes founding and abandonment narrative from the **history log**—detail that does not belong in sidebar chrome. Settlement entries and any kit map that labels pins use the same **settlement map number** as the **Settlement IDs overlay** (not opaque internal ids). Living-settlement dossiers include last-**epoch** net **faction tax** (same signed **gold-piece value** as the **settlement trade tooltip**—collected positive, paid negative, independent **0**) as a structured present-day field, not rebellion prose; **ruins** omit it. User-initiated export anytime during `running` once the control exists—including before increment 3 latches and as precaution snapshots before stepping further. Pre-latch kits omit or leave empty politics sections and emphasize **settlements**, founding **history log**, and whatever **trade profiles** exist. The first shippable export is a **partial kit**: a short **present-day** realm header, settlement/routes and resource map pages, plus numbered per-**settlement** dossiers from present-day sim data already available—not a redefinition of the finished kit. Politics, culture, and fuller history land in later passes if those systems hold. Dual job: primary audience is LLM/context ingest (structured tables, stable **settlement map number** cross-refs, dense present-day facts); human skim-readability is a layout constraint on the same PDF, not a second artifact. Settlement dossiers omit neighbor lists (read connectivity from the settlements/routes map) and follow the living-vs-**ruin** field cut recorded under Flagged ambiguities. Repeatable; export never halts **epoch step**. Each export is a point-in-time snapshot (file download or equivalent)—not a live link back into the session.

_Avoid_: “GM kit” as a second product name; “Lore dump” without causal hooks; politics-only export when economic trade opportunities are omitted; gating export on stability, **equilibrium state**, **political equilibrium**, **year cap**, or increment 3 latch; “final export” implying the run must end; single-export-only UX; past-**epoch** export or **epoch scrubber** time-choice prompts ([ADR 0014](../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md)); putting **campaign kit** narrative density into the sidebars; kit numbering that diverges from **settlement map number** / the **Settlement IDs overlay**; treating the first partial PDF as the permanent ceiling of kit scope; a v1 sidecar JSON/machine-only twin of the PDF; optimizing prose narrative over structured tables when the two conflict; inventing rebellion copy from **faction tax** alone; **faction tax** fields on **ruin** dossiers.

### Settlement trade profile

Per-**settlement** synopsis of wanted vs supplied commodities—structured pre-trade surplus/deficit for every good in the **commodity catalog**, comparing local production to population-scaled demand targets, with triad-style headlines in the **campaign kit** UI. Distinct from the hover tooltip’s realized import/export flows and **local prices**. Derived from local **resource profile**, **haul-shed**, and demand targets.

_Avoid_: Static flavor text without supply/demand backing; narrative-only profiles without structured fields; duplicating full **economy** simulation in the export blurb; conflating structural surplus/deficit with realized trade arrows.

### Material prosperity

Per-**epoch** benefit a **settlement** gains from commodities beyond its survival floors. Once **survival comfort** clears, timber, base metals, copper, silver, and gold each receive a hard baseline target of 1 gp per person per epoch valued at **reference price**; diamonds use a thinner 0.5 gp per-person target so mines export more often. Within the prosperity tier, max-min fairness raises every settlement’s lowest unmet prosperity-commodity fulfillment before any receives more; demand stops at each target. Settlements pay for traded units at the importer’s **local price** net of **transport cost** (and **port tolls** where due). Commodity satisfaction does not accumulate, though the **settlement trade account** may carry purchasing power or obligations between **epochs**. Later mechanics may replace equal weights with a concrete use such as firewood or smelting.

_Avoid_: Equal physical quantities across cheap and precious goods; scarcity inflation shrinking the physical target; continuous marginal-utility curves beyond the hard cap; unlimited demand; a persistent stockpile by implication; treating metals or excess timber as survival necessities before a mechanic requires them; permanent wealth accumulated from the same goods every **epoch**.

### Annual commodity flow

Commodity production available during one **epoch**. Goods are locally consumed, traded, or lost by the epoch boundary; no physical commodity inventory carries forward in the baseline economy. **Settlement trade account** balances persist independently of the goods whose exchange created them.

_Avoid_: Implicit grain, timber, or metal stockpiles; spending the same unsold surplus again next **epoch**; treating durable and perishable goods differently before commodity-specific storage exists.

### Survival allocation

Max-min fair distribution of scarce traded survival goods within a connected market. Trade raises every **settlement**’s fulfillment ratio toward its population-scaled survival floor before any settlement receives comfort or **material prosperity** goods, subject to routes, cargo capacity, and available credit. Freshwater remains local and does not enter allocation.

_Avoid_: Letting optimizer iteration order choose who starves; satisfying one settlement comfortably while a peer remains below its survival floor; allowing discretionary demand to consume capacity or credit needed for reachable survival demand.

### Survival comfort

Second allocation tier after every reachable **settlement** reaches its survival floor. Food may rise to 120% of annual survival demand while salt remains at 100%; this represents dietary quality and within-year resilience, not a physical stockpile. Within the comfort tier, max-min fairness raises every reachable settlement’s population-scaled comfort fulfillment together before any receives **material prosperity**.

_Avoid_: Comfort before all reachable survival floors clear; treating 120% food as stored surplus; salt comfort above the survival floor; letting one settlement take comfort while peers remain at bare survival; skipping comfort fairness on the way to prosperity; extra salt with no curing or production use; serving prosperity while reachable comfort demand remains and capacity, goods, and credit are available.

## Relationships

- **Landmass pipeline → fields before labels**: **scalar fields** (elevation, rainfall, temperature, drainage, salinity) overlap into **biomes** and **resource rasters**; hydrology is derived (erosion, river graph)—not painted first (Dwarf Fortress pattern; see research notes).
- **Landmass → hydrology → Sail overlay**: rivers, lakes, and coast on the final map feed **traversable water**; **meander refine** bridges must appear in **Sail overlay** connectivity, not only in presentation paint ignored by metrics.
- **Landmass → Freshwater availability overlay**: rivers, lakes, coast, and **well-viable** cells share one derive function for **terrain authoring** inspect and colonization **survival triad** freshwater—aligned with **Sail overlay**’s on-demand derivation pattern.
- **Landmass pipeline → logistics pass**: after physical terrain, **ox paradox**, **arable envelope**, **maritime reach**, and **strategic resource** nodes apply—World Builder’s layer on top of DF-style geography.
- **Terrain authoring → Colonize → colonization setup → begin colonization**: user finishes tuning geography, places **founding landing**, sets **colonist settings**, then starts the **colonization phase** clock on a fixed **landmass**.
- **Rejection sampling → validation checks**: failed **population ceiling**, haul corridor, or node presence → regenerate candidate **landmass**; reject reasons inform tuning.
- **Geography seed → world document**: one seed drives terrain generation and colonization RNG; same seed + params + **colonist settings** + **founding landing** → reproducible full run. **Founding landing** is independent of **geography seed** placement on the grid.
- **Named region → culture engine**: **exchange** and **connectivity** pressures often differ by contiguous region cluster, not single-tile **biome**.
- **Landmass → environmental pressure stack**: elevation, hydrology, and **climate** produce visibility, connectivity, predictability, survival stress, and **resource profile** inputs.
- **Environmental pressure stack → culture engine**: pressures run **WOAC cycles** that fill **six culture layers** per people; **exchange** modulates isolation vs synthesis.
- **Culture engine → settlement simulation**: **survival strategy** and **resource profile** bias where people cluster (water, arable land, defensible **chokepoints**, junctions).
- **Ox paradox + three-day haul distance → haul-shed**: caps land **trade** as a calibrated circle; explains **three-day rule** and spacing of **baronies** along **grain circle** routes.
- **Directional haul friction → trade / conditional loyalty**: downhill/downriver easier than uphill/upriver on existing links; does not reshape **haul-shed** or invent corridors.
- **Maritime reach → drain city**: sea **haul cost** enables large **population ceiling** off-site; **strategic resource** ports become **power centers**.
- **Settlement + haul → trade route**: routes are viable edges on the movement graph; **chokepoints** attract toll **vassals** and forts.
- **Bulk population → population collapse → population overlay**: each **epoch**, compact parameters (headcounts, claims, weights) resolve on observation to density the map can show; collapse raster is derived, not persisted; **notable figures** and **expeditions** stay tracked outside the bulk model ([ADR 0011](../docs/adr/0011-world-builder-bulk-population-wavefunction-collapse.md)).
- **Trade route + strategic resource → conflict engine**: scarcity creates **obstacles** between **power centers**; **exchange** force drives smuggling and alliance.
- **Supply-chain feudalism → political middle layer**: **vassals** hold nodes on **grain circle** and **trade route** graphs; **conditional loyalty** when logistics shift.
- **Maritime reach → logistics connectivity**: sail sea-lanes link distant **settlements** beyond land **haul-shed** radius—count for **supply-chain independence** negation, **faction** component grouping, and **trade route** proposal alike.
- **Five forces → conflict engine**: same **WOAC** machinery as **culture engine**; **belief** **legitimizes** **power**; **legacy** stores grudges as **rivalry**.
- **History log → legacy → rivalry**: wars and treaties rewrite borders and **faction** wants; present politics read from the log, not freehand borders.
- **Reverse-engineering culture ↔ export**: GM-facing tooltips trace rituals and borders to pressures for table use.
- **Campaign kit export**: brief for **present day**, political hooks, per-**faction** culture notes, per-**settlement** **trade profile** (wants/supplies)—repeatable GM snapshot during `running` (including pre-latch); export never ends the sim. After latch, kit may name the colonial **realm** and its **factions**. Settlement labels share **settlement map number** with the **Settlement IDs overlay**. First shippable PDF is a **partial kit** (header → two captioned map pages → numbered dossiers); fuller politics/culture/history fill later passes.
- **Settlement map number → Settlement IDs overlay / campaign kit**: founding assigns 1…N once; overlay and kit cite the same ordinal; internal settlement ids stay opaque join keys.
- **Realm → factions**: one **realm** per founding wave; after **supply-chain independence**, multiple **factions** may exist inside that **realm** without dissolving colonial origin.

## Example dialogue

- “This **drain city** isn’t impossible—the **maritime reach** from the delta feeds it; the **arable envelope** on the map is three days upstream.”
- “The pass **chokepoint** explains the **vassal** fort; if we add a lowland road, **conditional loyalty** breaks because the **grain circle** bypasses them.”
- “Run one **WOAC cycle** for the desert **environment** force before naming gods—wellkeepers are a **consequence**, not a aesthetic pick.”
- “**Rivalry** here is trade denial on **salt**, not ‘evil neighbors’—check the **strategic resource** layer.”
- “The salt pin exports through the **port settlement**; **trade clearing** bought grain before **survival triad**, and the port’s **port toll** credit shows on the **wealth overlay**.”
- “Change **yield modifier** or **founding landing** and **begin colonization** again—the delta’s still there; only the colony’s trajectory moves.”
- “**Rejection sampling** dropped that map: capital over **population ceiling** with no **maritime reach**.”
- “**Colonize** at the delta mouth—set **three-day haul distance** in **colonist settings**, then **begin colonization**.”
- “Bump diamond occurrence in Resources before regenerating—defaults keep diamonds off so the economy isn’t flooded with 5,000 gp gems.”
- “That free town still pays no **faction tax**, but **soft power** from the coastal **faction** paints it on the **faction territory overlay**—**factional control**, not membership. Taxes buy defense; soft paint does not.”
- “Tax plus rival trade pull armed a **rebellion**; the breakaway joined as a **trade partner**, not a taxed **vassal**—hue without the levy, and without the banner’s shield.”
- “The free town’s caravans ran coastal for years—**soft power** paint first, then a peaceful **trade partner** join when the streak held; a grain-chokepoint bind would have made it a **vassal** instead.”
- “**Soft power** needs majority on-map trade and a double lead over the next banner—off-map dumps don’t paint the map.”
- “That taxed inland seat still wore its liege’s color, but coastal caravans cleared majority + margin for years—trade pull armed **rebellion** toward the port **faction**.”
- “The lone hill **faction** faded when its capital took a peaceful **trade partner** join under the coastal banner—old roster extinct, no empty flag.”
- “That coastal **trade partner** drifted inland commercially—peel to free town first; no affiliate **rebellion** straight into the rival banner.”
- “Paint showed coastal **soft power** for a while before the free town’s peaceful **trade partner** join—pressure and hue before sticky affiliation.”

## Landmass constraints (simulation inputs)

Geography is not decorative: **landmass pipeline** stages must emit fields the **culture engine**, **settlement** placement, and **conflict engine** consume. Logistics-first worldbuilding (playlist #05, #15–#18, #13); field-first terrain and rejection pattern informed by [Dwarf Fortress terrain research](./research/dwarf-fortress-terrain-notes.md).

### Pipeline stages (canonical order)

1. **Scalar fields** — elevation, temperature, rainfall (with rain shadow), drainage, salinity.
2. **Derived geography** — **biomes**, erosion, river graph, lakes, coast navigability, mineral and **strategic resource** nodes.
3. **Logistics pass** — visibility, connectivity, **arable envelope**, **maritime reach**, natural threat zones.
4. **Rejection sampling** — **validation checks**; regenerate on failure.

**Colonization phase** (after **begin colonization**), three increments:

1. **Single-colony survival** — one **settlement**, local resource exploitation within founding **haul-shed**; settlement size growth only.
2. **Exploration and new settlements** — territory expansion, additional **settlements** at logistics nodes.
3. **Economy, politics, and history** — economy activates as soon as the **realm** has two living **settlements**; **factions**, **city-states**, and **rivalry** enter automatically when **supply-chain independence** fires (land **haul-shed** split and/or **drain city** **maritime reach** branch)—either branch sufficient alone. **Trade routes** and **settlement trade profiles** therefore exist before the political latch and become inputs to it.

Within each increment, **culture engine** pressure may apply when regions are engaged; full **WOAC** visibility arrives with increment 3 unless earlier increments prove partial cycles.

Physical **landmass** and **logistics pass** complete during **terrain authoring**; **colonization phase** reuses **geography seed** for simulation RNG.

### Required geographic outputs

- **Haul-shed geometry** — circle of **three-day haul distance** at colonization runtime; not a logistics-pass raster.
- **Visibility / cover** — open vs enclosed terrain; drives defensive culture (mobility vs ambush vs **chokepoint** holding).
- **Connectivity** — valleys vs plains vs sealed basins; isolated **cultures** vs harbor **exchange**; **roads** and sail as separate link types.
- **Hydrology** — rivers (haul edges, flood predictability, **flow direction** for **directional haul friction**), lakes, coast; floodplains tie to **climate** predictability and bureaucracy vs neighbor-trust.
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
- **Border friction** — abutting **primary claim** hinterlands between **factions** (trade denial, **rivalry**).
- **Legacy anchors** — defensible positions whose logistics later failed (ruined fort, ghost **settlement** on a bypassed road).

### Validation checks (world feels “read,” not invented)

Used by **rejection sampling** and **validation advisory**; same role as Dwarf Fortress biome and feature quotas, but logistics-grounded. **Validation advisory** (right panel during **terrain authoring** and setup) shows only colonization-relevant checks—those whose failure would change founding, survival, exploration, logistics, or politics—and may include new rows beyond generation-only quotas. Hydrology sailing checks measure **Sail overlay** connectivity using sail-native report labels—**Sailable water**, **Coastal river access**, **Coast-to-interior sailing path**—not pre-refine graph edge counts or “navigable” wording.

_Avoid_: Rejecting or accepting worlds based on `riverGraph` edge counts when **Sail overlay** shows different connectivity; validation metrics that ignore **meander refine** bridges visible on the final map; legacy “navigable edge” language in user-facing validation rows.

**UI vs schema:** validation and generation-control **labels** use sail-native names (**Sailable water**, **Coastal river access**, **Coast-to-interior sailing path**); internal `enforce*` option keys (e.g. `enforceNavigableRiverQuota`) stay stable for saved settings.

- No **population ceiling** violation: urban nodes fit their **arable envelope** and **haul** mode.
- No impossible capitals: apex **settlements** sit on sea, river, or rich hinterland—not isolated peaks without **maritime reach**.
- **Trade routes** follow **roads** and sail corridors; long bulk hauls respect **ox paradox** unless **maritime reach** applies; **directional haul friction** modulates strength on land and inland-water links.
- Viable haul corridors exist between arable zones and **drain city** candidates where params expect them.
- **Political middle layer** aligns with **supply-chain feudalism** nodes, not random castles.
- **Strategic resource** scarcity produces explainable **conflict engine** wants (salt wars, timber monopolies).
- Resource-mismatch zones present where params expect interesting friction (fertile delta beside scarcity, rain-shadow dry belt).

**Generation report (hydrology):** user-facing stats use **Sail overlay** metrics (**Sailable water**, **Coastal river access**, **Coast-to-interior sailing path**); legacy graph-edge counts (navigable edges, mouth count, navigable km from centerline graph) drop from the default report.

## Flagged ambiguities

- **Soft power / trade partner** (this session): resolved — **faction territory overlay** paints **factional control** (membership + **soft power**); map-gray pins only for non-membership paint; on-map trade gp share majority **>50%** + **≥2×** runner-up; shorter streak → paint + taxed-member **rebellion** pressure; longer hold → peaceful **trade partner** join; off-map excluded; taxes buy defense (**trade partners** and soft-power free towns defend alone); singleton’s old banner extinguishes on commercial join; trade-backed **rebellion** win → **trade partner**; **trade partners** switch only via commercial peel then re-join (or **conquest**)—no affiliate **rebellion**; peel via clear-and-re-arm (no one-step rival hop); survival dependence still → taxed **vassal**.
- **Conquest / rebellion / projected might** (updated this session): resolved product rules — one **contested settlement** per resolution; symmetric **projected might** aggregation along logistics graph; **martial capacity** from population × food surplus / base-metals access / wealth offset / **defender advantage**; resource-driven **conquest** (incl. **unaligned** stakes); **rebellion** as armed breakaway (tax + recent conquest + trade/**soft power** pull); trade-backed rebel win → **trade partner** of the dominant trading **faction**; **war exhaustion** (temp martial penalty + proportional population deaths both sides); deterministic comparison; nonzero projection to contest; at most one major-war involvement per **faction** per **epoch**; belligerent on-map trade blocked from subsequent epochs until peace/treaty (min one post-war **epoch**; neutrals ok; same for rebellion breakaway ↔ loyalists). Exact decay curves, death fractions, exhaustion duration, and contest-intensity thresholds remain implementation tuning.
- **Simulation vs presentation hydrology (#358, #365):** resolved by [ADR 0010](../docs/adr/0010-world-builder-sail-overlay-traversability.md)—**Sail overlay** is traversability source of truth; simulation graph demoted for sailing checks.
- **WOAC** spelling: canonical is **WOAC cycle** (**Want** → **obstacle** → **action** → **consequence**). Playlist may say “WAC”; never **WAAC**.
- **Fantasy races** vs **culture**: playlist #14 argues species should diverge in cognition/biology; v1 **culture engine** may assume human-norm peoples unless a separate species layer is added later.
- **Magic / industrial exceptions**: **ox paradox** and **population ceiling** assume pre-industrial logistics; teleportation, flying mounts, or preservation magic need explicit overrides or they break **supply-chain feudalism**.
- **Map-first vs story-first**: playlist #05 warns against pretty maps before need; World Builder generates geography-first for simulation, but export should still answer “why is this port valuable?” like a journey-driven story map.
- **Dwarf Fortress depth vs v1 scope**: DF history is full agent simulation; v1 **history log** may use lighter **epoch** ticks with stored **rivalry** causes—same “simulation log, not authored timeline” pattern, not necessarily DF agent count.
- **DF research vs implementation**: terrain notes are conceptual inspiration for **fields before labels**, hydrology-as-derived-graph, and rejection *pattern*—not a mandate to match DF algorithms (e.g. midpoint-displacement elevation), biomes, fantasy layers (good/evil, savagery), or rejection UX (hundreds of silent retries). **`world-builder/core`** ships in JavaScript with JSDoc (portfolio repo convention), not a separate TypeScript toolchain.
- **User-gated colonization vs DF auto-civ-placement**: DF places civilizations after terrain verification without a player-chosen landing; World Builder uses **colonization setup** (**founding landing** + **colonist settings**) then **begin colonization**. v1 continent is empty until the founding wave (no indigenous peoples).
- **Colonization geography inputs**: resolved (epic cross-cut; updated 2026-07-10) — **best-effort** for the full run, not only entry. **Colonize** when the author is satisfied; **validation advisory** informs but does not gate; no second hard gate at **begin colonization**, **epoch step**, or increment 3 latch. Missing optional layers (e.g. **maritime reach** completeness) use heuristics throughout. A per-cell travel-cost / **movement cost** raster is **not** a planned logistics input—**haul-shed** is a circle. Crude or odd **faction** / latch outcomes on marginal maps are acceptable author risk—and can be interesting—not a product failure.
- **Validation advisory scope**: resolved (epic cross-cut) — right-panel checks during **terrain authoring** (and setup) are colonization-relevant only; drop rows that never affect colonization; add rows when a geography gap would change colonization outcomes. Confirm-on-**error** still applies only to that colonization-relevant list.
- **Well-viable thresholds**: rainfall, **drainage**, **salinity**, and biome exclusion cutoffs are implementation tuning—shared between **Freshwater availability overlay** and colonization freshwater accounting; not author sliders in v1.
- **Settlement tier thresholds**: absolute population bands (hamlet / village / town / …)—implementation tuning; comparable across **settlements** on one map regardless of local **population ceiling** or age.
- **Population collapse core fraction**: share of **settlement** population pinned at **founding landing** vs arable-weighted hinterland in **haul-shed**—implementation tuning for increment 1 **core + hinterland** model.
- **Notable figure naming**: **landing geography heuristic** + “Dynasty” in v1; **named region** labels when that stage exists may replace or enrich house names.
- **Named regions**: glossary term for planned **derived geography** (contiguous cluster labels)—**not implemented** in the landmass pipeline today; do not depend on region strings for slice B dynasty naming.
- **Terrain lock**: geography hard-frozen at **begin colonization**; **reset colonization** is the only way back to editable terrain—no in-place geography edits while colonization state exists.
- **Increment 3 entry**: resolved — latch on first **epoch** when **supply-chain independence** fires (**land branch**: ≥2 **settlements** with no **haul-shed** overlap, no **road** within **three-day haul distance** budget, and no **maritime reach** / sail sea-lane link; **maritime branch**: founding-type **drain city** at town-tier+ with <50% local **arable envelope** food)—either branch alone; politics emerge gradually after latch.
- **Increment 3 politics**: resolved (updated this session) — **factions** emerge from **logistics connectivity components** (**haul-shed** overlap, **road**, or sail links) over staggered **epochs** after latch; town-tier+ capitals; daughter **vassal** dynasties until **conditional loyalty** breaks. **Maritime peel:** founding-type **drain city** becomes its own **faction** even when still sail/land-reachable inland—not an instant full-realm split on the latch **epoch**. Flat between **factions** (no liege nesting); sticky membership until explicit events; **faction territory overlay** paints **factional control** (membership + **soft power**); **trade partner** band (no **faction tax**) for trade-backed rebel joins; temporary **unaligned settlements** (stagger wait, unaligned daughters, soft independence) crystallize, re-absorb, or fall to **conquest**; **faction absorption** via asymmetric dependence, mutual re-integration, or war-extinction; anti-churn clear-and-re-arm + refractory; defection join / spawn / soft-unaligned by cause. Catastrophe orphans → **unaligned** deferred past v1.
- **Maritime peel**: resolved — maritime independence peels the **drain city** into its own **faction** / **city-state**; land-branch clustering still treats sail as a unifying link.
- **Faction absorption**: resolved — peaceful (asymmetric survival dependence or mutual re-integration) or conflict (major-war outcome); survivor by impetus (stronger/victor vs senior lineage on reunification); absorbed members become **vassals** of survivor; not nested living **factions**.
- **Simulation length**: no terminal state—user keeps **epoch step**ping in `running` until **reset colonization**; no **equilibrium state**, **political equilibrium**, or **year cap** auto-stop (scrubbed).
- **Increment 3 overlays**: resolved (updated this session) — **faction territory** = exclusive **primary claim** hinterland swathes showing **factional control** (membership + **soft power**; one hue per controlling **faction**; **vassals** / **trade partners** under banner; true gray only with no controller; not pin chrome; not overlapping **haul-shed** co-ownership). No user-facing **trade route overlay**—candidate edges and active commodity flows remain internal economy state; founding corridors stay on **Routes overlay**; future embargo/block chrome lands there or on inspect, not a second route layer. **Wealth overlay** is a colonization-only chrome member with **population overlay**, settlements, **exploration fog**, and **Routes overlay** (hidden in **terrain authoring**; listed after leaving terrain; the other four auto-enable once when `running` begins, wealth stays off until opted in; later epochs preserve user visibility). It paints exclusive **primary claim** hinterland cells for living settlements only with the same combined realm balance plus off-map claim as the **settlement trade tooltip**, scaled across living settlements as a stained-glass brightness ramp (lime→hunter, bright→deep); thin black claim perimeters separate abutting hinterlands—not pin markers under settlement pins; **ruins** do not paint. **Settlement IDs overlay** is campaign-kit-only (not an author checkbox): paints each pin’s **settlement map number** (yellow, thin black outline) when kit export enables the layer. **Settlement trade tooltips** on living pins only (not **ruins**); itemize realm balance and, for ports, separate off-map credit, then show every commodity with **local price** and icon-plus-color export/import/both/neither state. **Settlement trade profiles** keep structural pre-trade surplus/deficit for campaign-kit copy. **Strategic resource** layers reuse terrain; **rivalry** heat remains deferred to inspect/debug.
- **Faction territory vs hinterland claim**: resolved (epic cross-cut; updated this session) — **faction territory overlay** and **wealth overlay** share exclusive nearest-pin **primary claim** cells; overlapping geometric **haul-shed** circles are logistics geometry only, not co-owned political land.
- **Increment 3 trade routes**: resolved (updated 2026-07-15) — economy activates as soon as the **realm** has two living **settlements**, before the political latch; founding guarantees the initial parent–daughter connection. The candidate graph extends as later sites and routes appear. Ordinary overland candidates directly connect pins within one **three-day haul distance** without wilderness pathfinding. Continuous built **roads** create road candidates of any path length and replace ordinary overland for that pair so capacity is not double-counted; inland-water and open-sea modes remain separate competing edges. Clearing chooses among modes by delivered cost including **port tolls**, so water wins when the tariff-inclusive math is cheaper and capacity remains; overflow may spill to the next paying mode when a preferred edge fills. Sheltered **Sail overlay** paths create direct inland-water candidates up to **inland sail expedition range**; longer water networks use **transshipment**. Every pair of living **port settlements** receives an open-sea candidate regardless of overland distance. Candidates activate whenever clearing assigns positive endpoint or transshipment flow; **directional haul friction** applies on land and inland-water links; political block from major war (belligerent pairs) and later tax/reopen of routes must not erase geography-proposed potential when blocked—edges stay candidates, clearing skips or zeros flow while the block holds. Every active edge shares annual capacity `365 lb × sqrt(endpoint populations)` across commodities and directions, multiplied `1/2/4/10×` for ordinary overland/road/inland water/open sea.
- **Increment 3 transshipment**: resolved (updated 2026-07-15) — goods may cross intermediate settlements within one epoch even when those sites neither produce nor consume the commodity. Every onward leg consumes cargo capacity; maritime↔inland transfer at a port incurs the baseline **port toll**; no intermediate stockpile or buy/resell ledger is created. The goods obligation runs from final importer to origin exporter at path-netted delivered value; intermediates collect tolls only.
- **Increment 3 trade clearing**: resolved (updated 2026-07-15) — canonical economy solve is prioritized minimum-cost multi-commodity flow: max-min survival, max-min comfort, max-min prosperity toward hard per-commodity targets, then residual off-map exchange. Delivered cost includes transport, direction, and **port tolls**, so river/sea can beat road when cheaper after the five-percent tariff. When a preferred edge saturates, overflow may use the next paying mode with remaining capacity. All tiers share route capacity and obey credit and commodity-input constraints.
- **Increment 3 transport cost**: resolved (updated 2026-07-18) — ordinary overland costs 1 cp/lb per **three-day haul distance**, scaled by distance; road, inland water, and open sea apply `0.5/0.25/0.1×`, then direction modifies applicable links. Moves pay only when the importer–exporter **local price** gap still exceeds transport plus **port tolls**. Cost is deadweight: on-map goods obligations use net delivered value (`importer local price − transport`), keeping mutual credit zero-sum without a carrier recipient. Only explicit tolls credit settlements. Merchant and carrier agents are a deliberate non-goal, not deferred scope.
- **Increment 3 trade accounting**: partially resolved (updated 2026-07-19) — unlike commodities use **gold-piece value** expressed in familiar cp/sp/gp denominations without simulating coin as a commodity. Reference prices begin with the Fifth Edition SRD Trade Goods catalog; unlisted commodities derive compatible references. Each living **settlement** computes bounded **local prices** from its own pre-trade supply and demand so surplus and deficit regions differ. Persistent **settlement trade accounts** use **mutual credit**: all begin at zero; every purchase creates an interest-free **bilateral obligation** at net delivered value (`importer local price − transport`), displayed balances are net positions, realm-wide balances sum to zero, and effective money supply is total outstanding positive credit. Opposite obligations between the same pair net; third-party chains retain their counterparties. When a settlement becomes a ruin, deleting all incident obligations zeros its balance and adjusts counterparties automatically. At each epoch the baseline **credit limit** is the greater of the previous epoch’s realized on-map income—net delivered export credits plus collected **port tolls** plus creditor-side **faction tax** receipts—or current physically exportable on-map surplus valued locally and bounded by route capacity. Exportable surplus reserves local survival floors first; comfort and prosperity do not. The **wealth overlay** paints the same combined balance as the **settlement trade tooltip**, not this projected-income figure. This bootstraps new resource settlements without speculative buyer-income or toll projections. Survival uses available credit first, while accounts pushed past a recalculated limit by falling income retain debt and freeze non-survival purchases. Separate **external trade accounts** belong to individual ports; overseas dump payments (including mediated inland surplus) and path **port tolls** credit them, and imports spend them, but baseline balances cannot go negative. Mediated inland dump sales: exit port books the overseas claim, then owes the origin the sale on **settlement trade accounts**—port net goods enrichment is tolls. Last-line overseas imports may relay inland: port spends external credit first for its own unmet demand, then hinterland at pass-through **2.5×** reference with inland buyers owing the port on-map; no goods markup beyond tolls. Internal trade clears first. Baseline **off-map shipping cost** is asymmetric—exports earn half reference, imports cost **2.5×** (above the **local price** ceiling)—not a live symmetric colonist slider. **Off-map cargo capacity** limits import bulk only per port and **epoch**; residual exports are an unlimited dump once they reach a pier and clear the transport worth-it check. Inland residual export/import uses **transshipment** through the cheapest viable port path; multi-port paths collect every transfer toll. **Open gap:** political trust, interest, default, enforcement, and external borrowing remain unresolved; do not allow unlimited debt implicitly.
- **Increment 3 port toll**: resolved (updated 2026-07-19) — a **port settlement** receives five percent of shipment transaction **gold-piece value** before tolls when goods load, unload, or transfer between maritime and inland routes. On-map value uses the importer’s full **local price**, not the transport-netted goods obligation; off-map exports use their actual discounted sale price. For on-map trade, the importer pays each toll through a separate **bilateral obligation** to the collecting port; self-tolls net to zero and create no obligation. For **off-map trade**, the unseen counterparty pays every **port toll** on the export or import relay path—including intermediate inland↔maritime transfers—into each collecting port’s **external trade account**; off-map import unloading at the pier nets to zero as a self-toll. Multi-stop relays enrich successive ports. Politics may later alter rates, exemptions, or embargoes. Distinct from **faction tax**.
- **Faction tax**: resolved — prior-epoch realized on-map income × **10%**, floored to whole cp (skip zero); non-capital → capital **bilateral obligation**; full book; receipts in realized income / **credit limit**; after clearing / before survival; tooltip + **realm economy** + living **campaign kit** signed chrome (percent-discount icon; independent **0**). Ledger/chrome only—tax is substrate for independence / annexation **Want**s; it does not itself emit war or rebellion rows.
- **Increment 3 commodity demand**: resolved (updated 2026-07-20) — survival floors receive priority, followed by **survival comfort**. Timber, base metals, copper, silver, and gold then each receive a hard 1 gp per-person, per-epoch target valued at **reference price**; diamonds use a thinner 0.5 gp per-person target so mines export more often; within the prosperity tier, max-min fairness raises the lowest unmet prosperity-commodity fulfillment before any receives more, and demand stops at each target. Traded units still clear at **local price**. Baseline prosperity does not imply inventory carried between **epochs**. Future concrete uses such as firewood and smelting replace equal weights without changing the priority structure. The **metals potential** raster supplies low-value iron/tin production. Discrete **mineral deposits** yield fixed annual hauls tuned against founding-era grain hinterland export value by rarity (copper **85,000 lb**, silver **12,500 lb**, gold **1,500 lb**, diamonds **25** gems), so mines can clear local targets and still export. Mineral occurrence controls in **terrain authoring** Resources change their relative mix within a fixed deposit count; defaults preserve inverse 100:10:1 copper/silver/gold rarity and disable diamonds.
- **Increment 3 commodity catalog**: resolved (2026-07-15) — baseline goods are grain, fish, **salt**, timber, base metals, copper, silver, gold, and diamonds. Base metals combine generic iron/tin raster production; typed deposits provide the four high-value minerals. Finished goods and finer geology distinctions remain future production-chain work.
- **Increment 3 reference prices**: resolved (2026-07-15) — grain 1 cp/lb; fish 2 cp/lb; salt 5 cp/lb; timber 0.5 cp/lb; base metals 1 sp/lb; copper 5 sp/lb; silver 5 gp/lb; gold 50 gp/lb; diamonds 5,000 gp/gem. Fish and timber are project conventions; the others use Fifth Edition anchors.
- **Increment 3 diamond units**: resolved (updated 2026-07-20) — diamonds are integer whole-gem flows at 5,000 gp each, never fractional commodity quantities. Each gem uses 0.1 lb nominal cargo weight for capacity and transport. Claimed copper deposits yield **85,000 lb** per epoch; silver **12,500 lb**; gold **1,500 lb**; diamonds **25** whole gems (about **1.5×** a gold mine’s dump value)—a rarity ladder against grain hinterland export wealth, not token pounds. Settlements unable to justify a whole gem through remaining prosperity demand leave it for larger cities or off-map export.
- **Increment 3 food substitution**: resolved (2026-07-15) — delivered grain and fish satisfy the same normalized survival demand. Fish shipped out of its producing settlement consumes salt at a 3:1 fish-to-salt weight ratio; local fish does not. Curing is charged once at origin, not again during transshipment.
- **Increment 3 food demand**: resolved (updated 2026-07-15) — each person requires 365 lb of combined grain and fish per annual epoch. Either food satisfies the same survival and comfort floors after delivery. Dietary variety between grain and fish is deferred; baseline **material prosperity** covers timber and metals only.
- **Increment 3 food production conversion**: resolved (2026-07-15) — one existing crop/fish productivity unit becomes 36,500 lb per epoch, preserving the current 100-person carrying capacity while exposing concrete commodity quantities.
- **Increment 3 timber and base-metals conversion**: resolved (2026-07-15) — one claimed timber productivity unit yields 16,000 lb/epoch; one claimed **metals potential** unit yields 800 lb of base metals/epoch. Both constants are tunable and preserve the old 80 person-equivalent scale against 1 gp prosperity targets.
- **Increment 3 trade-supported population**: resolved (2026-07-15) — population responds to total post-trade effective food, including imports and excluding exports before salt preservation loss. Imported food may support growth above local production capacity; wealth and prosperity alone may not.
- **Increment 3 salt demand**: resolved (updated 2026-07-15) — baseline preservation demand is 5 lb per person and epoch, separate from fish-curing input. Each claimed salt pin produces `score × 10,000` lb per epoch (tunable; score-1 ≈ 2,000 person-years). Local and imported salt both count. Effective food uses multiplier `0.35 + 0.65 × salt fulfillment`, capped at one, preserving the existing 35% no-salt floor without treating salt as calories.
- **Increment 3 local prices**: resolved (updated 2026-07-15) — each connected market is the candidate-route component among living settlements (dormant candidates count). Political edge blocks (embargo, war) are deferred to a later politics pass. Each market computes `clamp(sqrt(demand / supply), 0.5, 2)` once before clearing from pre-trade local production and population-scaled demand targets spanning survival, comfort, and prosperity. Zero supply with demand uses 2×; zero demand with supply uses 0.5×; neither leaves 1×. Clearing pays those fixed prices without mid-epoch recomputation. **Material prosperity** targets stay anchored to reference value so scarcity cannot shrink the physical need; payment still uses local price. Internal **survival allocation** remains lexicographically prior to comfort and prosperity fulfillment.
- **Increment 3 commodity storage**: resolved for baseline (2026-07-15) — commodities are **annual flows**, not inventories: each epoch’s production is consumed, traded, or lost before the next. Only ledger balances persist. Commodity-specific storage and spoilage differences between food, timber, and metals remain a deliberate future economy extension.
- **Increment 3 survival allocation**: resolved (2026-07-15) — connected settlements share scarce survival goods using max-min fairness over population-scaled fulfillment ratios. All reachable settlements advance toward their survival floors before any receives comfort or **material prosperity** goods. Political favoritism, coercion, and embargo may override this neutral baseline later.
- **Increment 3 survival comfort**: resolved (updated 2026-07-15) — after all reachable survival floors clear, food demand may rise to 120% while salt remains at 100%. Comfort uses the same max-min fairness as survival floors, clears before broader **material prosperity**, and does not create inventory.
- **Increment 3 food variety**: resolved (2026-07-15) — grain and fish remain interchangeable for survival and comfort; no separate dietary-mix prosperity demand in the baseline economy.
- **Increment 3 directional haul friction**: resolved (updated 2026-07-15) — cost interpolates from `0.75×` downhill/downriver through `1×` neutral to `1.5×` uphill/upriver; **flow direction** governs inland water when available, elevation delta governs land/**road**, and open sea remains neutral. It affects trade strength and **conditional loyalty** / influence, not **haul-shed** shape, latch connectivity, candidate existence, **expedition** travel, or automatic rivalry.
- **Increment 3 conflict**: resolved — **pressure ladder**: **rivalry** on concrete **obstacles** (sparse causes); routine **economic contest** per **epoch**; major-war **WOAC** only past intensity threshold; war/treaty entries and **trade route** block/reopen; **rivalry** edges survive peace.
- **Increment 3 vassals**: resolved — **conditional loyalty** fails on logistics break (alternate **road** / **maritime reach**, or surplus independence from liege corridors); defection = major **history log** event; join adjacent **faction** when still corridor-dependent, else spawn new **faction**; **rivalry** cause; no map-visible **vassal** territory before defection.
- **Increment 3 culture**: resolved — hybrid **WOAC** on milestones only (**faction** emergence, increment 3 latch per component, major-war / **vassal** defection / **city-state** founding); not per-**epoch**, not on embargo or routine **economic contest**.
- **Epoch scrubber**: cut — [ADR 0014](../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md). Increment 3 uses **event feed** at **present day**; **campaign kit** export is **present day** only.
- **Progress chrome / cooperative yielding**: resolved (2026-07-17; politics substeps 2026-07-29) — [ADR 0016](../docs/adr/0016-world-builder-cooperative-progress-yielding.md). Every World Builder stage with a progress pill that can take noticeable wall time (generation, **begin colonization**, **epoch step** including trade and politics, rehydration, …) must yield and update chrome; prefer logical substeps; long substeps add `n/m` or `%` as appropriate. Trade phase substeps follow the clearing ladder (local prices → survival → comfort → prosperity → off-map). Politics phase substeps follow latch → membership → conflict → absorption → palette, with Conflict scoring conquest stakes under an inner counter. Test wall times are the practical signal for where yields are most needed. Multi-second frozen monoliths are out of bounds.
- **Increment 3 exploration**: resolved — **expeditions**, founding, **roads**, and **exploration fog** continue after latch; new sites join origin **faction** as **vassals**—politics and exploration concurrent, not a freeze.
- **Continuous colonization run**: resolved — deferred past increment 3; #394 ships manual **epoch step** + editable **epoch batch** only.
- **Increment 3 history log**: resolved — feed catalog: latch, **faction** emergence, **faction** extinction, **faction absorption**, **city-state** founding, daughter founding, **settlement** abandonment (**ruin**), **settlement merge** via **administrative federation**, **vassal** defection, major war start/end, treaty/peace, embargo-on-**rivalry**; no routine contest, culture **WOAC**, or **expedition** rows.
- **Settlement ruin**: resolved (epic cross-cut; updated 2026-07-15) — population 0 keeps the pin as a **ruin** (no claims, no **expeditions**, **history log** abandonment); hinterland frees for living neighbors; not full removal and not zombie claims. Delete every incident **bilateral obligation**, which zeros the ruin’s realm balance and matching counterparty positions without breaking mutual-credit accounting; zero any external credit because no claimant remains.
- **Extinct faction**: resolved (epic cross-cut) — **faction** with no living members goes extinct (**history log**); **realm** with only **ruins** stays as colonial memory in `running` (export/**reset colonization** only—no auto-reset, no further exploration/politics progress).
- **Faction territory overlay**: resolved (updated this session) — toggleable territory swathes (not pin chrome) paint **factional control**, not membership alone; ColorBrewer Set3 (**12** solid colors) when a **faction** **controls** **2+** living pins (sticky members/**vassals**/**trade partners** and/or **soft power** over map-gray pins); overflow mints join-first or stay **unaligned** until a slot frees; true gray only when no controller; exclusive **primary claim** fill (not haul-shed overlap paint); not visit-status claims; no membership/loyalty shade or opacity bands on fill; membership band reads as settlement pin size (capital > member = **trade partner** = **unaligned** > **vassal**).
- **Mid-run control**: observe-only for outcomes in v1; **epoch batch** mid-run editing deferred to increment 3; no rewriting **faction** borders or **history log** events by hand.
- **Population model**: resolved — [ADR 0011](../docs/adr/0011-world-builder-bulk-population-wavefunction-collapse.md); [`docs/POPULATION-MODEL.md`](./docs/POPULATION-MODEL.md). **Bulk population** parameters in superposition + per-**epoch** **population collapse** on observation for **population overlay**; collapse raster derived in memory, not session-persisted; **notable figure** dynasties and **expedition** movement tracked outside the bulk model—WFC-style constraint satisfaction (seeded integer placement on legal land) is the collapse mechanism, not a stand-in for future full agent sim; “wavefunction collapse” is not product UI copy.
- **Increment 2 exploration**: **exploration fog** overlay + auto-dispatched **expeditions**; new **settlements** founded automatically at logistics nodes—one **realm** as sole political body until increment 3.
- **Realm after latch**: resolved (epic cross-cut) — **realm** stays the colonial-origin umbrella (shared founding wave); **factions** are political bodies inside it. Not retired; not 1:1 with the origin **faction**.
- **Expedition dispatch gate**: resolved — eligible from first **epoch step**; per-**settlement** stochastic timing each **epoch**; optional surplus/population bias only, no hard tier or survival-streak prerequisite.
- **Automatic founding gate**: resolved (updated 2026-07-15) — requires a scored **logistics node** and **founding viability** on a **provisional claim**. Hard check for the outpost starting population: local freshwater, plus either local food and **salt** covering survival or exportable surplus over the founding connection buying the shortfall after transport and tolls. Exportable surplus is production after local survival floors are reserved. Daughter checks use the parent’s **local prices**; epoch-0 founding-port off-map checks use **reference price** with **off-map shipping cost**. Timber is prosperity demand until another mechanic consumes it. Fog may clear without founding when a node fails the check.
- **Provisional claim at founding**: resolved (epic cross-cut) — daughter-site viability and post-founding claims use the same exclusive nearest-pin rule; do not found on geometric **haul-shed** circle totals the new pin would lose when claims settle.
- **Annual epoch order**: resolved (epic cross-cut; updated this session) — network (**expeditions**, founding, **roads**) → claim recompute → production and trade clearing → **faction tax** → **survival triad** → **ruin** → **population collapse** → politics (increment 3: latch, **factions**, **conflict**; **administrative federation** merge when that ships). Trade resolves before tax and survival so imported food, preservation **salt**, and this epoch’s levy affect the current year’s wealth. **Begin colonization** creates the founding port at **epoch** 0, performs export-first **off-map trade**, then applies the first survival resolve without network, tax, or politics; export earnings may fund same-commit imports.
- **Exploration fog semantics**: resolved — visit-status tint only; geography and resource overlays stay readable; toggleable overlay during `running` (and absent during **terrain authoring**).
- **Initial visited territory**: resolved — founding **haul-shed** cleared at **begin colonization** (**epoch** 0); remainder unvisited until **expeditions** extend it.
- **Expedition fog clearing**: resolved — one-cell-wide routed path; terminus disc when a scored **logistics node** is reached (viability pass or fail).
- **Logistics node scoring**: resolved (updated 2026-07-10) — multi-tag non-exclusive weights; primary type = highest contributor in inspect; five types (**chokepoint**, **haul junction**, **surplus basin**, **refinery**, **drain city**); **chokepoint** from geography funnels (isthmus, elevation saddle, ford)—not a travel-cost raster; **drain city** included in increment 2 founding mix when geography supports it.
- **Daughter settlement seed**: resolved — fixed small outpost headcount (implementation constant); global **three-day haul distance** **haul-shed** centered on each new pin.
- **Expedition concurrency**: resolved — one active **expedition** per **settlement**; one dispatch attempt per **settlement** per **epoch** while idle.
- **Settlement haul-shed overlap**: resolved — distinct pins required; geometric **haul-shed** circles may overlap in increment 2 (still a land-branch logistics link for **supply-chain independence**).
- **Shared hinterland claim**: resolved (epic cross-cut; updated 2026-07-15) — local production sums (food, timber, **salt**) and **population collapse** hinterland use exclusive cell ownership: nearest **settlement** pin by cell distance inside overlapping **haul-shed** circles. Geometric overlap does not invent regional production; **population overlay** does not stack multi-pin density on one cell. Claims recompute every annual **epoch** (including silent years inside an **epoch batch** and **history log** event years)—not frozen at founding. Present-day **primary claim** drives overlays; historical claim maps are not persisted ([ADR 0014](../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md)).
- **Session persistence scope**: resolved (epic cross-cut) — refresh restores present-day colonization state plus **`historyLog`**; no per-epoch snapshot arrays ([ADR 0014](../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md)).
- **Increment 2 history log**: resolved — daughter **settlement** founding entries only; no expedition or rejected-site events.
- **Increment 2 notable figures**: resolved — one dynasty per **settlement** at founding (geography heuristic + “Dynasty”); no **expedition** lead or **vassal** seats until increment 3.
- **Multi-settlement population overlay**: resolved — per-**settlement** **core + hinterland** collapse on claimed cells only; no stacked density from multiple pins on one cell.
- **Settlement count cap**: resolved — no hard cap; dispatch exhausts when all scored **logistics nodes** are founded or rejected; sim does not auto-stop.
- **Rejected logistics nodes**: resolved — once surveyed and failed **survival triad** viability, not re-targeted while terrain is locked.
- **En-route founding**: resolved — evaluate scored **logistics nodes** in path corridor (routed cell + immediate neighbors) in travel order; first viable unscouted node wins.
- **Daughter visit on founding**: resolved — full **haul-shed** becomes visited at automatic founding.
- **Haul-shed shape**: resolved (updated 2026-07-10) — geometric circle of **three-day haul distance** (not a terrain-cost isochrone); setup preview matches simulation; **roads**/sail are separate connectivity; no planned per-cell **movement cost** logistics layer.
- **Routes and exploration**: resolved (updated 2026-07-18) — [ADR 0012](../docs/adr/0012-world-builder-bearing-based-expedition-routing.md), [ADR 0015](../docs/adr/0015-world-builder-expedition-budget-and-settlement-merge.md); **realm expedition budget** with independent land/maritime pools; **frontier-eligible settlement** gating; three modes (**land expedition**, **inland sail expedition**, **open-sea expedition**); **colonist settings** ranges land **2×**, inland sail **3×**, open-sea **8×**; **routes overlay** draws **land route** only (**inland sail route** and **open-sea route** persist but are not painted); bearing-based local steps (no pathfinding toward undiscovered targets). Increment 2 has no **settlement merge** phase—cluster control is founding spacing plus expedition budget; **administrative federation** is increment 3 ([#394](https://github.com/enmaku/portfolio-site/issues/394)).
- **Expedition duration**: resolved — multi-**epoch** treks; **travel time** budget per **epoch** via local terrain-following steps; ends on founding, blocked, **expedition range** cap, or survey complete; founding checks each step.
- **Running panel jobs**: resolved (updated 2026-07-20) — left = **realm economy** extremes (clickable **local price** / wealth / **port toll** values, no placenames; stable Highest/Lowest even when tied; tolls only among living **port settlements**); right = **sim status** census (**epoch**, living + **ruin** counts, active **expeditions**, built **road** segments, on-map trade flows, compact **off-map trade** volume in **gold-piece value**, total population, clickable population extremes, **salt**/mineral pin claimed vs world with zero-total rows omitted)—not **generation report**, not chronicle, not continuous-raster tallies, not money-supply / exploration-% / tier-mix / ceiling-pressure chrome. Extreme values place **settlement focus** (toggle / map-click clear). Settlement and founding narrative detail stay on map inspect / **settlement trade tooltip** / **campaign kit**. **Validation advisory** only at **epoch** 0 on the right.
- **Grid scale**: no intrinsic km-per-cell; **three-day haul distance** and related **travel time** metrics are author-calibrated in **colonist settings** until map scale is modeled.
- **Colonization phase states**: `terrain` → `setup` → `running` until **reset colonization** returns to `terrain`. No **`stopped`** phase (scrubbed). **Colonization setup** (#391) ships the full transition through `running` with document fields initialized; increment 1 (#392) plugs in **epoch** ticks without adding interim phases.
- **Founding settlement at commit**: resolved (epic cross-cut) — **begin colonization** (#391) creates the founding **settlement** at **epoch** 0 (visit status for founding **haul-shed**, founding **dynasty** when slice B lands) before any **epoch step**, recording configured **starting population** and a founding **history log** entry. Empty `settlements` is not a post-commit state. **Survival triad** resolve (clamp to **population ceiling**, freshwater non-sustain) is deferred to increment 1 (#392); until then **epoch** 0 reflects configured headcount honestly in present-day state.
- **Panel navigation actions**: left panel = backward / abandon (red, full width at top); right panel = forward / commit (green, full width at top). Do not put phase labels or a shared top toolbar for these actions.
- **Colonization setup chrome**: terrain authoring panels fully hidden; **generation report** cleared; left panel → **Back to terrain** (red) then **colonist settings**; right panel → **Begin colonization** (green) then **validation advisory** (warnings/errors) only. Same panel real estate as terrain phase, different content.
- **Colonization terrain chrome**: left panel → generation controls; right panel → **Colonize** (green, full width above advisory) then **validation advisory** / **generation report**. **Generation report** does not survive **Colonize**.
- **Colonization running chrome**: left panel → **Reset colonization** (red) then **realm economy**; right panel → **Next epoch** (green) with **campaign kit** download control immediately to its right (green, download icon, no text label) then **validation advisory** (only at **epoch** 0) plus **sim status** census from commit onward; increment 3 adds **event feed**. Terrain generation controls and editable **colonist settings** stay out of `running` chrome; map overlay toggles remain for inspect.
- **Session persistence**: resolved (epic cross-cut) — refresh restores the full colonization run: phase, **founding landing**, **colonist settings**, present-day sim state (**epoch**, **settlements**, **history log**, **expeditions**, **route segments**, **factions**, **trade routes**, …). Setup-only fields are not enough once `running`. Generation settings live on the Pinia session path; while terrain is locked (`setup` / `running`), the generated **landmass** is also cached in IndexedDB so refresh restores geography without re-running the **landmass pipeline**. Cache is keyed by **geography seed** + generation options and cleared on **Back to terrain**, **reset colonization**, or terrain regen. If the cache is missing or mismatched, fall back to silent **landmass** regen then rehydrate. Not a separate colonization save/load UX. **Campaign kit** export remains user-initiated during `running`, repeatable, non-terminal ([ADR 0014](../docs/adr/0014-world-builder-present-day-session-no-committed-tips.md)).
- **Campaign kit pre-latch**: resolved (epic cross-cut) — export available anytime during `running` once the control exists, including before **supply-chain independence**; pre-latch kits omit or empty politics sections.
- **Campaign kit first PDF**: resolved (2026-07-18) — first shippable export is a **partial kit** (settlement/routes map, resource map, numbered settlement dossiers from available present-day data). Full kit vision (politics, culture, history hooks, **trade profiles**) remains; later passes fill it in. Not a permanent narrowing of **campaign kit**. _Avoid_ “GM kit” as a second name.
- **Campaign kit audience (v1 PDF)**: resolved (2026-07-18) — one PDF; optimize for LLM/context ingest with structured tables and **settlement map number** cross-refs; keep human-readable headings/layout. No separate machine-only sidecar in v1.
- **Campaign kit map pages (v1)**: resolved (2026-07-18) — two full-map captures of the normal map. Page 1: **settlements**, **Settlement IDs overlay**, and **Routes overlay** on; all other overlays off. Page 2: **arable**, timber, metals, and salt on; all other overlays off. Overlays are toggles on top of the map—not a substitute for it.
- **Campaign kit settlement neighbors (v1)**: resolved (2026-07-18) — omit explicit neighbor/connectivity lists from settlement dossiers; road links are read from the settlements/routes map page.
- **Campaign kit settlement dossiers (v1)**: resolved (2026-07-18) — one section per **settlement**, keyed by **settlement map number**. Living: status, tier, population, pin coordinates, pin biome, claimed resources / production summary, maritime role, port **off-map trade** when applicable, combined balance, full commodity **local price** + trade-role table (tooltip-equivalent; same present-on-map commodity presence rule as tooltip / **realm economy**), founding epoch / origin map number when present. **Ruins**: short stub (number, ruin status, biome, founding/abandon notes)—no economy tables. Omit factions, culture, placenames, neighbor lists, and unwired **settlement trade profile** for this pass.
- **Campaign kit header (v1)**: resolved (2026-07-18) — short **present-day** realm block before maps: **epoch**, living/**ruin** census, **geography seed**, **founding landing**, compact **colonist settings** summary. No full **history log** chronicle in this pass (founding/abandon stay on settlement stubs).
- **Campaign kit map capture (v1)**: resolved (2026-07-18) — both map pages capture the full landmass at full resolution (not the author’s current pan/zoom crop). Author pan/zoom and overlay toggles are restored after export so the interactive session is unchanged.
- **Campaign kit export busy gate (v1)**: resolved (2026-07-18) — download control shares the colonization busy gate with **Next epoch** (disabled during **authoring progress** / **epoch step**). Export itself uses **authoring progress** when capture/PDF work takes noticeable time.
- **Campaign kit commodity rows (v1)**: resolved (2026-07-18) — living settlement commodity tables use the same present-on-map presence rule as the **settlement trade tooltip** / **realm economy** board (always grain, fish, timber, base metals; **salt** and typed minerals only when the landmass has those pins).
- **Campaign kit PDF outline (v1)**: resolved (2026-07-18) — (1) realm header, (2) settlements/IDs/routes map with caption naming those overlays, (3) arable/timber/metals/salt map with caption, (4) settlement dossiers in **settlement map number** order (1…N, including **ruins**).
- **Campaign kit filename (v1)**: resolved (2026-07-18) — `campaign-kit-seed-{geographySeed}-epoch-{epoch}.pdf`.
- **Colonization RNG**: no separate **history seed**—**geography seed** seeds colonization stochastic rolls; not author-facing in **colonist settings**.
- **Colonization time controls**: increment 2 ships manual **epoch step** (one year per step); **epoch batch** size control and multi-year stepping deferred to increment 3 (#394); **continuous colonization run** deferred past increment 3.
