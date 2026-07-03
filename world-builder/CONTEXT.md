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

Second product phase: user completes **colonization setup**, then **begin colonization** runs annual **epoch** ticks. Delivered in three product increments—**single-colony survival**, then **exploration and new settlements**, then **economy, politics, and history** together. Hands-off simulation after initial conditions: user sets geography and **colonist settings**, then the sim advances with minimal intervention—observe and **epoch step** (or later **epoch batch** controls); no mid-run outcome edits in v1. No fixed or terminal run endpoint—the user keeps stepping **epochs** as long as they like; “present day” for **campaign kit** export is a subjective call, not a sim state change. In `running` phase: left panel keeps **colonist settings** (read-only except permitted mid-run tweaks such as **epoch batch**); right panel shows **validation advisory** at **epoch** 0, then sim/event feed content as increments ship. **Reset colonization** lives in persistent chrome, not the left panel. Terrain generation controls stay fully hidden; map overlay toggles remain for reading geography.

_Avoid_: “History sim” alone when founding, expansion, and present-day structure are all meant; restarting terrain pipeline silently mid-colonization; requiring user unlock for core **faction** / **trade route** behavior once thresholds fire; swapping the full panel layout again at increment 1; hiding read-only resource overlays during the run; auto-stop or terminal freeze on **equilibrium state**, **political equilibrium**, or **stop colonization** (scrubbed).

### Single-colony survival

First colonization increment: one **founding landing**, one growing **settlement**—no exploration, no additional **settlements**. Simulation tracks a **survival triad** within the founding **haul-shed** circle (**three-day haul distance** from the pin): food ( **arable envelope** ), freshwater, and a fuel/shelter proxy from local biomes inside that zone—**salt**, metals, and inter-**settlement** trade deferred until increment 1 is proven (**strategic resource** preservation layer added before increment 1 is considered complete). **Population collapse** distributes bulk population across cells in the same circle; **settlement tier** stays a single node at the pin. Territorial expansion is settlement size only, not map claim. No sim-detected endpoint—the user keeps stepping **epochs** indefinitely.

_Avoid_: “Phase 1 worldgen”; conflating with **terrain authoring**; multi-**settlement** maps in the first colonization test slice; full **resource profile** accounting before the survival triad works; **equilibrium state** as a completion gate (scrubbed).

### Epoch batch

Number of in-world years each **epoch step** advances—stored in **colonist settings**, editable mid-run. First release defaults to 1 (one year per step for causality debugging); target UX defaults to ~100 with author adjustment. Internal tick semantics stay annual—batching applies N sequential **epoch** ticks per control action.

_Avoid_: “Speed slider” that changes tick semantics; sub-year **epochs** unless explicitly modeled; **year cap** disguised as batch size.

### Exploration and new settlements

Second colonization increment: **exploration fog** overlay clears along **expedition** paths; additional **settlements** founded automatically at logistics nodes when **expeditions** succeed. **Expeditions** dispatch automatically with stochastic timing from each **settlement** in one realm (not independent **city-states** yet). Still before full **trade route**, **faction**, and **history log** interdependence.

_Avoid_: “Expansion pack” naming; treating as optional when it is the planned second test gate; **city-state** independence before increment 3; requiring user confirmation per new **settlement** in hands-off mode.

### Colonize

User action that ends **terrain authoring** and opens **colonization setup**: place the **founding landing**, configure **colonist settings**, then **begin colonization** to start the clock. Available once a **landmass** exists to work with—not gated on **validation checks** passing. **Validation advisory** surfaces errors and warnings first; the user may proceed anyway. Colonization reads whatever geography layers exist and fills gaps with documented heuristics—full **logistics pass** is not a hard gate.

_Avoid_: “Generate world” when only people-layer simulation is starting; blocking **Colonize** until every check is green; hiding failed checks when the user opts in; silent failure when a layer is missing instead of heuristic fallback.

### Colonization setup

Interactive step between **Colonize** and **begin colonization**: user places the **founding landing**, edits **colonist settings** (homeland flavor, era logistics), and reviews geography. Map time is frozen; no **settlements** or **epoch** ticks yet. **Terrain authoring** controls are fully hidden—not merely disabled; the left and right chrome panels show **colonist settings** and **validation advisory** (warnings/errors) respectively. **Begin colonization** enables once a valid **founding landing** exists—all **colonist settings** already hold defaults in the pane. User may return to **terrain authoring** until **begin colonization**—all setup progress is discarded on return (landing pin, settings edits); no partial-state resume.

_Avoid_: “Pre-sim” in UI copy; conflating with **terrain authoring** parameter panels; saving colonization setup drafts across a terrain return; indeterminate colonist controls; leaving terrain sliders visible in setup.

### Colonist settings

Configuration during **colonization setup** for the founding wave. Pane ships in **colonization setup** (#391): **three-day haul distance** (scale calibration), **homeland flavor** (preset list + optional notes for **landing culture snapshot**), **starting population**, **yield modifier** (marginal / typical / bountiful **arable envelope** interpretation), and **epoch batch** (years advanced per **epoch step**—default 1 in first release, target ~100 configurable in later UX). Every field has a concrete default—sliders and controls are never indeterminate. **Begin colonization** enables once a valid **founding landing** is placed; unset-looking controls still carry defaults. Trade, diplomacy, and expansion temperament knobs wait for later increments. No author-facing RNG seed—colonization reuses **geography seed**. No **year cap** or auto-stop—the user keeps stepping **epochs** indefinitely.

_Avoid_: “Civ picker” that implies pre-existing on-map peoples; “Difficulty” sliders without geographic meaning; indeterminate or empty UI state for colonist controls; a separate **history seed** or **simulation seed** in the setup pane; **year cap** as max **epochs** before auto-stop; settings that only apply to increment 3 **faction** play in the first test slice.

### Begin colonization

User action that commits **colonization setup** and enters the **colonization phase** `running` state—terrain hard-locked, **landing culture snapshot** written, **epoch** initialized (0), empty **settlements** placeholder, and one founding **history log** entry (landing, **colonist settings** summary, founding dynasty when slice B lands). Annual **epoch** ticks and **epoch step** arrive with increment 1; until then the UI stays in colonization mode with time controls inert. The run stays in `running` until **reset colonization**—no sim-detected endpoint, terminal freeze, or export gate.

_Avoid_: “Play” / “Run” without colonization context; auto-starting simulation when the **founding landing** is placed; silent terrain edits mid-run; auto-stop on **equilibrium state**, **political equilibrium**, or **year cap**; a fourth “ready” phase between setup and running; **`stopped`** phase that halts **epoch step** (scrubbed).

### Reset colonization

Explicit user action that abandons the colonization run entirely: wipes colonization state (**founding landing**, **colonist settings**, **epoch**, **settlements**, **history log**, …), returns phase to `terrain`, and unlocks geography editing. Always available once **begin colonization** has committed—including at **epoch** 0. One confirm step; no partial colonization resume. The only way back to **terrain authoring** from `running`.

_Avoid_: “New world” as the only escape hatch; preserving sim progress across a reset; different reset rules before vs after the first **epoch** tick; conflating with **campaign kit** export (export does not end the run).

### Founding landing

Map cell where the first colonizing boat makes shore—the seed **settlement** and expansion origin for one founding wave. Chosen by the user during **colonization setup**; must be **Sail overlay**-reachable coast or river mouth. Invalid cells (inland, non-sailable shore) are not selectable—the map shows a “no” cursor like other disabled controls, without error copy. During setup, a single persistent map marker shows the chosen cell, with a small circle centered on the pin showing **three-day haul distance** (oxcart **haul-shed** reach); the circle rescales live as the slider moves. Clicking another valid cell moves the pin and circle. The marker and circle persist in `running` as read-only reference at the **founding landing**.

_Avoid_: “Capital” before a **drain city** or political apex exists; random auto-placement without user intent; overland-only founding in v1; toast or modal explaining why a cell is invalid during placement; hover preview halos beyond the haul circle.

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

Colonization overlay hiding unvisited territory until **expeditions** clear it. Cleared cells persist; uncleared cells hide geography-dependent opportunity until reached.

_Avoid_: “Fog of war” in domain language when **exploration fog** is the product term; pre-revealing the whole map during **terrain authoring**.

### Faction territory overlay

Colonization map layer showing which **faction** controls each cell or **settlement** claim—primary political game board in increment 3.

_Avoid_: “Borders” as hand-drawn lines without simulation claims; painting territory independent of **history log**.

### Trade route overlay

Colonization map layer showing active **trade routes**; blocked or embargoed corridors visually distinct from open haul.

_Avoid_: Decorative path lines without commodity/volume semantics; user-drawn routes in hands-off mode.

### Expedition

An outbound trek from a **settlement** that advances **exploration fog**, surveys logistics nodes, and may lead to a new **settlement** site. Dispatched automatically with stochastic timing per sending **settlement**; exact routing and outcomes TBD.

_Avoid_: “Scout unit” as schema keys; player micro of every path in increment 2 unless a later mode adds it.

### Supply-chain independence

When two **settlements** no longer share one viable bulk-food **grain circle**—the increment 3 entry signal. **Land branch**: beyond shared **haul-shed** (**ox paradox**). **Maritime branch**: a **drain city** sustains on **maritime reach** / import calories with its own sea-lane dependence, decoupled from inland **settlements** even if land distance is small.

_Avoid_: “Too far apart” without haul math; ignoring **drain city** import logic when judging whether politics should activate.

### Logistics pass

World Builder–specific **landmass pipeline** stage after physical terrain: **movement cost**, **haul-shed**, **maritime reach**, **arable envelope**, **strategic resource** placement, and **population ceiling** inputs—bulk haul economics the playlist defines and Dwarf Fortress does not model at macro scale.

_Avoid_: “Economy sim” for the whole **world**; conflating with **history log** or **conflict engine** ticks.

### Rejection sampling

Regenerate the candidate **landmass** when **validation checks** fail (missing haul corridors, **population ceiling** violation, impossible capital site)—same belt-and-braces pattern as Dwarf Fortress world rejection, but grounded in logistics constraints rather than biome quotas alone. Automatic during generation when enabled; distinct from **validation advisory**, which never blocks **Colonize**.

_Avoid_: “Retry button” without logged reject reasons; conflating auto-reject during generation with a hard **Colonize** gate.

### Validation advisory

Pre-**Colonize** (and optionally pre-**begin colonization**) presentation of **validation checks** results—errors and warnings visible, never a hard block. Failing checks stay surfaced in the validation panel; **warnings** alone do not add friction. When any check is in **error** state, **Colonize** requires a lightweight confirm (“colonize anyway”) before **colonization setup** opens—proceeding on marginal geography is deliberate, not accidental. **Begin colonization** does not repeat the confirm; the author already accepted the map. The user may **Colonize** on intentionally marginal geography; odd or “failed” **landmasses** are a valid author choice. Distinct from **rejection sampling**, which may discard candidates during generation.

_Avoid_: requiring all checks green to **Colonize**; proceeding without surfacing what failed; blocking **begin colonization** again after setup.

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

One-time **culture** output at **begin colonization**: compressed summary from **homeland flavor** (preset + notes) plus **environmental pressure stack** at the **founding landing**—readable flavor, not annual **WAAC** drift. Used in **single-colony survival**; full **culture engine** cycles deferred to later increments.

_Avoid_: “Culture sheet” checklist; treating the snapshot as the full **six culture layers** simulation; rerolling culture every **epoch** in increment 1.

### Culture engine

Causality-driven framework for generating **cultures**: **environmental pressures** and **five forces** run **WAAC cycles** that emit **culture layers**—not aesthetic-first trait picking. In **single-colony survival**, only a **landing culture snapshot** runs. In increment 3, **hybrid** mode: full **WAAC** at **faction** emergence, at **supply-chain independence**, and on major **history log** events—not continuous per-**epoch** drift for every **faction**.

_Avoid_: “Lore generator”; “culture tables” that pick dress and gods without pressure inputs; annual culture rerolls for all **factions** every **epoch**.

### WAAC cycle

**Want** → **obstacle** → **action** → **consequence**. One loop of problem-solving; the **consequence** becomes the next **obstacle** or **want**. Same pattern under **culture engine** and **conflict engine**.

_Avoid_: “WAC” / “WOAC” in product copy (playlist variants); one-off **events** without a recorded consequence chain.

### Five forces

Active pressures that run **WAAC cycles** and interact: **environment**, **power**, **belief**, **exchange**, **legacy**. One force’s **consequence** can become another’s **obstacle**.

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

Historical events, trauma, and collective memory that still constrain present **WAAC cycles**.

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

Under any political surface (feudal, republic, tribal, …): **power centers** with wants, blockers, and actions—the machine that produces ongoing **rivalry**. Built from **WAAC cycles**, not throne furniture. Increment 3: routine border pressure resolves as **economic contest** (haul capacity, **strategic resource** stockpiles, **chokepoint** control); full **WAAC** cycles engage for major wars—not every skirmish each **epoch**.

_Avoid_: “Factions” lists with static alignments; “everyone hates the evil king” without **obstacles**; tactical battle simulation.

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

Owed allegiance with history and terms—not permanent unless the **supply chain** or coercion still holds. **Vassals** defect when the math or story breaks.

_Avoid_: “Betrayal” without prior obligation logic; eternal fealty flags.

### Great house

Apex **power center** competing for influence, territory, or succession—sits above the **political middle layer**.

_Avoid_: “Kingdom” when the house is the actor; family name without economic base.

### Vassal

**Middle-layer** holder of delegated authority (land, fort, toll)—**loyalty** tied to protection, profit, or habit. Increment 3: internal to a **faction** as **notable figure** dynasties with **conditional loyalty** tied to **chokepoint** / **grain circle** economics—not separate **faction territory** until defection (major **history log** event may spawn a new **faction**).

_Avoid_: “Lord” generically for every noble; vassal without a liege relationship; every **vassal** as an independent map **faction** in v1 increment 3.

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

Region where delivery still pays after **ox paradox** (and road **movement cost**). Primary limit on land **trade** and garrison feeding. In **single-colony survival**, the founding **haul-shed** is the circle centered on **founding landing** with radius from **three-day haul distance**—same circle shown during **colonization setup**; local **survival triad** accounting and **population collapse** use this boundary. Extent is derived from **movement cost**, **three-day haul distance** (**colonist settings**), and **travel time**—not from raw grid pixels alone.

_Avoid_: “Radius” in miles only without calibration; fixed pixels-per-day baked into the **landmass** without author-facing scale.

### Three-day rule

Rule of thumb: beyond ~three days' **travel time** by cart, bulk food **haul** often fails economically—not tradition, arithmetic. In v1 the distance implied by “three days” is set in **colonist settings** (calibrated **haul-shed** anchor) because the **landmass** grid has no intrinsic real-world scale.

_Avoid_: Stating distances in miles/km alone for RPG prep; “two weeks north” without consistency; assuming one global real-world scale per grid cell without author calibration.

### Travel time

Primary spatial measure for play and simulation—“three days on horseback” beats raw distance.

_Avoid_: “Hexes” in domain language unless the product explicitly uses a hex grid.

### Movement cost

Energy or time to cross terrain (slope, swamp, road quality); high cost → isolation, local self-sufficiency; low cost → **exchange** and blended **cultures**.

_Avoid_: “Difficult terrain” without graph weights; uniform plains with no connectivity story.

### Maritime reach

Where sea **haul cost** (~order-of-magnitude cheaper than land) extends feeding and **trade** beyond **haul-shed**—enables **drain cities** and empire-scale flows.

_Avoid_: Ports that are decorative; continents fed entirely by ox cart from one capital.

### Drain city

**Settlement** that concentrates flow (often port or river hub)—imports surplus from a wide **arable envelope** or **maritime reach**, not local subsistence alone. **Parasite city** pattern: grows past local **population ceiling** by sea-fed calories; foreign policy becomes sea-lane control.

_Avoid_: “Capital” with arbitrary population; metropolis in a food desert without import logic; treating as a normal inland **settlement** for **haul-shed** fracture.

### Population ceiling

Maximum plausible urban or regional population implied by **arable envelope**, **haul-shed**, and **maritime reach**—an output of geography, not a slider first. In **single-colony survival**, the founding site's ceiling is the minimum of applicable caps inside the **haul-shed** circle: food from summed arable (primary), fuel/shelter from summed timber when timber binds below food, and freshwater as a hard gate (no water in circle → colony cannot sustain).

_Avoid_: “100k city” by aesthetic; capitals larger than their hinterland can feed; food ceiling alone when timber sum is the tighter bind.

### Arable envelope

Land that can sustainably feed a **settlement** or **drain city** given era-appropriate yields and **haul**—typically many times the built area for pre-industrial density. In **single-colony survival**, the founding **haul-shed** circle's summed arable productivity (arable raster × **yield modifier**) is the local food production cap and **population ceiling** input for one **settlement**.

_Avoid_: Farmland drawn only as map texture; farm percentage ignored (~80–95% rural in pre-industrial models); single-cell arable bottleneck when circle sum is the accounting unit.

### Survival triad

Minimum resource accounting for **single-colony survival**, aggregated within the founding **haul-shed** circle—food and freshwater are the primary gates; fuel/shelter is secondary. Food: **sum** arable productivity across the circle (arable raster × **yield modifier**) sets the primary production capacity and **population ceiling** input. Freshwater: **hard gate**—at least one **Freshwater availability overlay** cell in the circle; if present, the leg is satisfied and food drives scale. Fuel/shelter: **sum** timber productivity across the circle ( **Timber** overlay)—when the timber total is scarce, it can cap **population ceiling** below the food cap (e.g. grassland with strong arable but little firewood). **Salt** (slice B): **spoilage tax** on food surplus—salt access in the **haul-shed** scales how much arable production counts toward surplus (weak **salt** → spoilage → surplus-driven growth stalls or reverses despite good arable). Increment 1 test slice A omits salt; slice B completes increment 1.

_Avoid_: “Needs bars” UI jargon; treating the triad as the full **economy** model; freshwater from **Sail overlay** alone (sailing ≠ drinking); divergent well rules between overlay and colonization tick; bottleneck-only food from a single worst cell when the circle sum is the cap; volumetric freshwater consumption competing with food for **population ceiling** in increment 1; binary timber gate when sum scarcity is the intended pressure; **salt** as a third **population ceiling** min() when preservation spoilage on surplus is the intended mechanic.

### Strategic resource

Geographically sparse necessity (salt for preservation, metals, timber above treeline gaps)—controls **trade routes**, **rivalry**, and who taxes whom. In increment 1 slice B, **salt** access in the founding **haul-shed** applies a **spoilage tax** on effective food surplus—not a calorie source.

_Avoid_: “Rare ore” with no logistics effect; salt as flavor text; **salt** as a duplicate **population ceiling** cap when spoilage-on-surplus is meant.

### Chokepoint

Pass, strait, ford, or toll segment where **movement cost** forces traffic—natural fort and **trade** leverage.

_Avoid_: “Border” lines without funnel geography; castles off the corridor.

### Trade route

Graph edge or corridor where moved goods still pay after **haul decay**—rivers, roads, sea lanes, **salt roads**—often explains **settlements** and **political middle layer** placement. Increment 3: geography proposes viable corridors; **faction** relations and **history log** events activate, tax, block, or sever them (war, embargo, treaty).

_Avoid_: “Trade route” as a line on art without volume or commodity; every road equal; user-drawn routes in hands-off mode.

### Settlement

A persisted population node (hamlet to **drain city**) whose tier and role should be justified by **arable envelope**, **chokepoint**, **strategic resource**, or **trade route**—not random dots. Exposes tier label and population count on inspect; size constrained by local **population ceiling** in **single-colony survival**. Population changes each **epoch** from food surplus (production minus consumption)—growth when surplus is positive, stall at balance, decline when negative; **starting population** from **colonist settings** seeds **epoch** 0.

_Avoid_: “City” / “town” labels without simulation backing; one capital per kingdom by default; tier without backing population accounting; fixed per-**epoch** headcount increments divorced from **survival triad** production.

### Settlement tier

RPG-facing size band for a **settlement** from **absolute population count**—hamlet, village, town, and higher bands use fixed headcount thresholds (concrete numbers tuned in implementation), not fractions of local **population ceiling**. A **town** is big in absolute terms; a newer **settlement** below its ceiling but above town threshold is still a town, not a **hamlet**. Primary label on the map; inspect pairs tier with raw population count. **Population ceiling** caps growth; tier reflects how large the **settlement** has actually become.

_Avoid_: “Level” in domain language; ceiling-relative tier (e.g. “60% of local cap = town”)—mislabels large young **settlements** smaller than older neighbors; tier divorced from population accounting.

### Population overlay

Map heatmap of where people actually are after each **epoch**'s **population collapse**—bulk population density, not just **settlement** pin dots. In **single-colony survival**, distribution spans the founding **haul-shed**: a **core + hinterland** split—a fixed fraction at **founding landing** (urban cluster) and the remainder spread across the circle weighted by arable productivity (rural envelope). The pin carries **settlement tier** and total population; the overlay shows spatial spread.

_Avoid_: “People layer” when only **settlement** markers are shown; static density painted by hand; all population on one cell when **haul-shed** rural spread is intended; ceiling-relative density that ignores where arable lies.

### Bulk population

The vast majority of people not simulated as individuals—held as regional parameters (density, distribution constraints) until **population collapse** each **epoch**. In increment 1, total bulk count tracks the founding **settlement** population; **epoch** delta follows food surplus against **population ceiling** caps.

_Avoid_: “NPCs”; census lists for every farmer; agent simulation of every person in v1; population growth by fixed schedule ignoring **survival triad** surplus.

### Population collapse

Once per **epoch**, resolve bulk population parameters into a concrete spatial distribution for the **population overlay** and **settlement** totals—inspired by wavefunction-collapse-style constraint satisfaction (exact algorithm TBD). In increment 1, uses **core + hinterland** weighting inside the founding **haul-shed**. Deterministic from **geography seed** + **colonist settings** + **founding landing** + sim state. The canonical “where people are this year” observation.

_Avoid_: “Render pass” alone when simulation state is meant; collapsing mid-epoch for gameplay sub-ticks unless explicitly modeled; spatial output that disagrees with **settlement** pin population total.

### Notable figure

A tracked **dynasty** or lineage—not a single person—whose seat persists across **epochs** while holders change every generation. With **epoch batch** spans of many years, one **epoch** may cover multiple lifetimes; the sim tracks the house (e.g. “The Saltmarsh Flats Dynasty”), not “Lord Trentor Abernathy.” Outside **bulk population** accounting; v1 house labels come from a **landing geography heuristic** at **founding landing** (coast, river mouth, wetland, pass, …) + “Dynasty”—no procedural personal names; authors rename freely. Increment 1 slice B seeds one founding dynasty (flavor only, no per-**epoch** mechanics). Increment 3 **power roster**: apex house per **faction** plus key **vassal** dynasties at **chokepoints**, **drain city** stewards, and active **expedition** houses—handful per **faction**, not proportional census. **Named region** labels may supersede landing heuristics when that **derived geography** ships.

_Avoid_: “Hero” in schema keys; simulating every holder as a full agent; personal name generation in product output; **notable figure** as one immortal individual across centuries; full roster before exploration mechanics exist; dozens of tracked houses per **city-state**; assuming **named region** strings exist before that pipeline stage is implemented.

### Faction

Simulated **power center** or aligned group with territory claims across one or more **settlements**, economic wants, and **rivalry** edges—emerges gradually in increment 3 from **supply-chain independence**, not at **founding landing**. A **city-state** is a **faction** whose capital **settlement** has reached sovereign town-tier or higher.

_Avoid_: “Race = faction”; static good/evil teams; 1:1 **faction** ↔ single hamlet without territorial claims.

### City-state

A **faction** whose capital **settlement** has reached sovereign town-tier or higher—an urban polity with its own **grain circle** or **maritime reach** dependence, not merely a fort on the frontier.

_Avoid_: “Kingdom” when only one city is sovereign; **city-state** before increment 3 independence; labeling every **settlement** a **city-state**.

### Rivalry

Directed political tension between **factions** with stored causes—for GM-readable hooks. Increment 3 records causes sparsely when a **rivalry** edge is created or intensifies, across: **resource** (monopoly, embargo), **logistics** (**chokepoint**, **grain circle**, sea-lane), **territory** (border, succession), **legacy** (war, treaty), and **belief** (legitimacy, schism).

_Avoid_: “They hate each other”; **rivalry** without **legacy** or resource **obstacle**; logging every minor insult.

### History log

Ordered **epochs** and events (founding, conquest, famine, treaty) that feed **legacy** and reshape borders. Browsable in-app via **epoch scrubber** (map and **faction** state at selected year) and filterable **event feed** (wars, treaties, founding, …) that jumps to map locations. Increment 1 (#392): one founding entry written at **begin colonization** (**epoch** 0 anchor)—full feed and scrubber arrive in increment 3.

_Avoid_: “Timeline” as flavor-only; events that don’t touch **power centers**; export-only log with no in-app investigation; deferring the founding entry until the first **epoch step** when **epoch** 0 should record the commit.

### Epoch

Discrete simulation tick for **colonization phase** and **history log**—one in-world **year** per tick in v1 (harvest cycles, haul economics, and **history log** entries align to annual steps). First release advances one **epoch** per **epoch step**; target UX advances **epoch batch** years per step (~100 default). No auto-stop—the user keeps stepping indefinitely; “present day” is whatever **epoch** the map currently shows.

_Avoid_: “Year 1042” precision without source events; real-time wall-clock simulation in v1 copy; conflating with **terrain authoring** (no **epochs** until **begin colonization**); generational or seasonal ticks unless explicitly switched in **colonist settings**; **equilibrium state** or **political equilibrium** as stop triggers (scrubbed).

### Epoch step

Manual advance during **colonization phase**—applies **epoch batch** sequential annual ticks (1 in first release, configurable later). Primary time control for inspecting causality; no fixed endpoint.

_Avoid_: “Turn” in domain language when **epoch** is the persisted unit; sub-epoch micro-ticks in user-facing copy unless explicitly modeled; implying the sim should halt when resources or population stabilize.

### Continuous colonization run

Optional future UX: simulation auto-applies **epoch batch** ticks with pause between batches—same annual tick semantics as **epoch step**, not a different time model. Deferred until batch stepping is reliable; first release uses manual **epoch step** only.

_Avoid_: “Real-time strategy mode”; wall-clock tied to in-world days; auto-run as the only way to reach a sim-detected endpoint.

### World document

Serializable snapshot: **geography seed**, stage parameters, geography **fields**, colonization state (**founding landing**, **colonist settings**, **settlements**, **factions**, **trade routes**, **history log**), derived **culture** summaries. Authoritative in-memory sim state during a session. **Campaign kit** export derives from the live document at the current **epoch**—repeatable without ending the run. Session survival (page refresh) extends the existing Pinia/localStorage pattern alongside generation settings; no separate colonization save/load UX.

_Avoid_: “Save file” in UI copy when the artifact is author-facing; PNG-only export as the whole **world**; a redundant **history seed** field; explicit save/load buttons for in-progress colonization; treating export as a terminal sim state.

### Campaign kit

Primary GM deliverable: map layers, structured **world document** slice, present-day brief (**factions**, **rivalries** with causes, key **settlements**), story hooks (border friction, **strategic resource** pressure, **vassal** defection risk), **reverse-engineering culture** notes per **faction**, and per-**settlement** **trade profile** (what each place wants and supplies for table-side trade play). User-initiated export during `running` at whatever **epoch** they judge “present day”—including precaution exports before stepping further, then continuing the sim. Repeatable; export never halts **epoch step**. Each export is a point-in-time snapshot (file download or equivalent)—not a live link back into the session.

_Avoid_: “Lore dump” without causal hooks; politics-only export when economic trade opportunities are omitted; gating export on stability, **equilibrium state**, **political equilibrium**, or **year cap** (scrubbed); “final export” implying the run must end; single-export-only UX.

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
- **Environmental pressure stack → culture engine**: pressures run **WAAC cycles** that fill **six culture layers** per people; **exchange** modulates isolation vs synthesis.
- **Culture engine → settlement simulation**: **survival strategy** and **resource profile** bias where people cluster (water, arable land, defensible **chokepoints**, junctions).
- **Ox paradox + movement cost → haul-shed**: caps land **trade**; explains **three-day rule** and spacing of **baronies** along **grain circle** routes.
- **Maritime reach → drain city**: sea **haul cost** enables large **population ceiling** off-site; **strategic resource** ports become **power centers**.
- **Settlement + haul → trade route**: routes are viable edges on the movement graph; **chokepoints** attract toll **vassals** and forts.
- **Bulk population → population collapse → population overlay**: each **epoch**, parameters resolve to density the map can show; **notable figures** stay tracked outside the bulk model.
- **Trade route + strategic resource → conflict engine**: scarcity creates **obstacles** between **power centers**; **exchange** force drives smuggling and alliance.
- **Supply-chain feudalism → political middle layer**: **vassals** hold nodes on **grain circle** and **trade route** graphs; **conditional loyalty** when logistics shift.
- **Five forces → conflict engine**: same **WAAC** machinery as **culture engine**; **belief** **legitimizes** **power**; **legacy** stores grudges as **rivalry**.
- **History log → legacy → rivalry**: wars and treaties rewrite borders and **faction** wants; present politics read from the log, not freehand borders.
- **Reverse-engineering culture ↔ export**: GM-facing tooltips trace rituals and borders to pressures for table use.
- **Campaign kit export**: present-day brief, political hooks, per-**faction** culture notes, per-**settlement** **trade profile** (wants/supplies)—repeatable GM snapshot during `running`; export never ends the sim.

## Example dialogue

- “This **drain city** isn’t impossible—the **maritime reach** from the delta feeds it; the **arable envelope** on the map is three days upstream.”
- “The pass **chokepoint** explains the **vassal** fort; if we add a lowland road, **conditional loyalty** breaks because the **grain circle** bypasses them.”
- “Run one **WAAC cycle** for the desert **environment** force before naming gods—wellkeepers are a **consequence**, not a aesthetic pick.”
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

Within each increment, **culture engine** pressure may apply when regions are engaged; full **WAAC** visibility arrives with increment 3 unless earlier increments prove partial cycles.

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

Used by **rejection sampling** and **validation advisory**; same role as Dwarf Fortress biome and feature quotas, but logistics-grounded. Hydrology sailing checks measure **Sail overlay** connectivity using sail-native report labels—**Sailable water**, **Coastal river access**, **Coast-to-interior sailing path**—not pre-refine graph edge counts or “navigable” wording.

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
- **WAAC** spelling vs playlist “WAC” / “WOAC”—canonical here is **WAAC cycle** (four explicit steps).
- **Fantasy races** vs **culture**: playlist #14 argues species should diverge in cognition/biology; v1 **culture engine** may assume human-norm peoples unless a separate species layer is added later.
- **Magic / industrial exceptions**: **ox paradox** and **population ceiling** assume pre-industrial logistics; teleportation, flying mounts, or preservation magic need explicit overrides or they break **supply-chain feudalism**.
- **Map-first vs story-first**: playlist #05 warns against pretty maps before need; World Builder generates geography-first for simulation, but export should still answer “why is this port valuable?” like a journey-driven story map.
- **Dwarf Fortress depth vs v1 scope**: DF history is full agent simulation; v1 **history log** may use lighter **epoch** ticks with stored **rivalry** causes—same “simulation log, not authored timeline” pattern, not necessarily DF agent count.
- **DF research vs implementation**: terrain notes are conceptual inspiration for **fields before labels**, hydrology-as-derived-graph, and rejection *pattern*—not a mandate to match DF algorithms (e.g. midpoint-displacement elevation), biomes, fantasy layers (good/evil, savagery), or rejection UX (hundreds of silent retries). **`world-builder/core`** ships in JavaScript with JSDoc (portfolio repo convention), not a separate TypeScript toolchain.
- **User-gated colonization vs DF auto-civ-placement**: DF places civilizations after terrain verification without a player-chosen landing; World Builder uses **colonization setup** (**founding landing** + **colonist settings**) then **begin colonization**. v1 continent is empty until the founding wave (no indigenous peoples).
- **Colonization geography inputs**: **best-effort**—**Colonize** when the author is satisfied with the **landmass**; **validation advisory** informs but does not gate. Missing layers (e.g. full **movement cost**, **maritime reach**) use heuristics until **logistics pass** matures. Increment 2+ may tighten required layers.
- **Well-viable thresholds**: rainfall, **drainage**, **salinity**, and biome exclusion cutoffs are implementation tuning—shared between **Freshwater availability overlay** and colonization freshwater accounting; not author sliders in v1.
- **Settlement tier thresholds**: absolute population bands (hamlet / village / town / …)—implementation tuning; comparable across **settlements** on one map regardless of local **population ceiling** or age.
- **Population collapse core fraction**: share of **settlement** population pinned at **founding landing** vs arable-weighted hinterland in **haul-shed**—implementation tuning for increment 1 **core + hinterland** model.
- **Notable figure naming**: **landing geography heuristic** + “Dynasty” in v1; **named region** labels when that stage exists may replace or enrich house names.
- **Named regions**: glossary term for planned **derived geography** (contiguous cluster labels)—**not implemented** in the landmass pipeline today; do not depend on region strings for slice B dynasty naming.
- **Terrain lock**: geography hard-frozen at **begin colonization**; **reset colonization** is the only way back to editable terrain—no in-place geography edits while colonization state exists.
- **Increment 3 entry**: automatic when **supply-chain independence** fires (land **haul-shed** split and/or **drain city** **maritime reach** branch)—either branch sufficient alone.
- **Increment 3 politics**: **factions**, **city-states**, and **rivalry** emerge gradually over **epochs** after entry—not an instant realm split on the threshold **epoch**.
- **Simulation length**: no terminal state—user keeps **epoch step**ping in `running` until **reset colonization**; no **equilibrium state**, **political equilibrium**, or **year cap** auto-stop (scrubbed).
- **Increment 3 overlays**: **faction territory** and **trade route** overlays required; **strategic resource** layers reuse terrain; **haul-shed** and **rivalry** heat deferred to inspect/debug.
- **Mid-run control**: observe-only for outcomes in v1; **epoch batch** editable mid-run; no rewriting **faction** borders or **history log** events by hand.
- **Population model**: **bulk population** parameters + per-**epoch** **population collapse** for **population overlay**; **notable figure** dynasties tracked outside the bulk model—WFC-style constraint satisfaction is inspiration, not a committed algorithm name in product copy.
- **Increment 2 exploration**: **exploration fog** overlay + auto-dispatched **expeditions**; new **settlements** founded automatically at logistics nodes—one realm until increment 3.
- **Grid scale**: no intrinsic km-per-cell; **three-day haul distance** and related **travel time** metrics are author-calibrated in **colonist settings** until map scale is modeled.
- **Colonization phase states**: `terrain` → `setup` → `running` until **reset colonization** returns to `terrain`. No **`stopped`** phase (scrubbed). **Colonization setup** (#391) ships the full transition through `running` with document fields initialized; increment 1 (#392) plugs in **epoch** ticks without adding interim phases.
- **Colonization setup chrome**: terrain authoring panels fully hidden; left panel → **colonist settings**, right panel → **validation advisory** (warnings/errors). Same panel real estate as terrain phase, different content.
- **Colonization running chrome**: left panel → **colonist settings** (read-only except permitted mid-run edits such as **epoch batch**); right panel → **validation advisory** at **epoch** 0, then sim/event feed as increments ship. **Campaign kit** export and **reset colonization** in persistent toolbar chrome. Terrain generation controls hidden; map overlay toggles remain for inspect.
- **Session persistence**: colonization phase, **founding landing**, and **colonist settings** live on the existing `worldBuilderSettings` Pinia store (same `portfolio-world-builder-settings` persist key as generation settings)—not a separate colonization store. On page refresh, the app silently regenerates the **landmass** from persisted seed/settings, then rehydrates colonization state so the user lands back in the same phase. **Campaign kit** export is user-initiated during `running`, repeatable, non-terminal.
- **Colonization RNG**: no separate **history seed**—**geography seed** seeds colonization stochastic rolls; not author-facing in **colonist settings**.
- **Colonization time controls**: first release ships manual **epoch step** ( **epoch batch** = 1 ); target UX raises default **epoch batch** (~100) with author adjustment; **continuous colonization run** deferred.
