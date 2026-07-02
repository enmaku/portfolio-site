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

First product phase: generate and tune a **landmass** until the user is satisfied—regenerate, tweak parameters, inspect overlays, pass **validation checks**. Ends when the user is ready to **Colonize**; geography is frozen (or only edited with explicit “break colonization” intent—TBD).

_Avoid_: “Map editing phase” when **scalar fields** and pipeline stages are meant; conflating with **colonization phase** simulation.

### Colonization phase

Second product phase: user completes **colonization setup**, then **begin colonization** runs annual **epoch** ticks. Delivered in three product increments—**single-colony survival**, then **exploration and new settlements**, then **economy, politics, and history** together. Hands-off simulation after initial conditions: user sets geography and **colonist settings**, then the sim advances with minimal intervention—observe, **epoch step**, or **continuous colonization run**; no mid-run outcome edits in v1. Pause may adjust non-geography controls (e.g. extend **year cap**) without rewriting causality.

_Avoid_: “History sim” alone when founding, expansion, and present-day structure are all meant; restarting terrain pipeline silently mid-colonization; requiring user unlock for core **faction** / **trade route** behavior once thresholds fire.

### Single-colony survival

First colonization increment: one **founding landing**, one growing **settlement**—no exploration, no additional **settlements**. Simulation tracks a **survival triad** at the landing site: food ( **arable envelope** ), freshwater, and a fuel/shelter proxy from local biomes—**salt**, metals, and inter-**settlement** trade deferred until increment 1 is proven (**strategic resource** preservation layer added before increment 1 is considered complete). Territorial expansion is settlement size only, not map claim. Runs until **equilibrium state**.

_Avoid_: “Phase 1 worldgen”; conflating with **terrain authoring**; multi-**settlement** maps in the first colonization test slice; full **resource profile** accounting before the survival triad works.

### Equilibrium state

Colonization pause condition for **single-colony survival**: (1) local resource production meets consumption—food, water, and key **strategic resource** stockpiles stay within a stable band; and (2) the founding **settlement** reaches max size justified by local **arable envelope** and **haul-shed** (**population ceiling** for one site). User may acknowledge equilibrium early during testing when auto-thresholds are not yet trustworthy.

_Avoid_: “Victory screen”; implying **colonization phase** ends permanently; population-stable-only detection that masks broken resource accounting.

### Exploration and new settlements

Second colonization increment: **exploration fog** overlay clears along **expedition** paths; additional **settlements** founded automatically at logistics nodes when **expeditions** succeed. **Expeditions** dispatch automatically with stochastic timing from each **settlement** in one realm (not independent **city-states** yet). Still before full **trade route**, **faction**, and **history log** interdependence.

_Avoid_: “Expansion pack” naming; treating as optional when it is the planned second test gate; **city-state** independence before increment 3; requiring user confirmation per new **settlement** in hands-off mode.

### Colonize

User action that ends **terrain authoring** and opens **colonization setup**: place the **founding landing**, configure **colonist settings**, then **begin colonization** to start the clock. Available once terrain **validation checks** pass; colonization reads whatever geography layers exist and fills gaps with documented heuristics—full **logistics pass** is not a hard gate.

_Avoid_: “Generate world” when only people-layer simulation is starting; blocking **Colonize** until every **landmass pipeline** stage is implemented; silent failure when a layer is missing instead of heuristic fallback.

### Colonization setup

Interactive step between **Colonize** and **begin colonization**: user places the **founding landing**, edits **colonist settings** (homeland flavor, era logistics, **history seed**), and reviews geography. Map time is frozen; no **settlements** or **epoch** ticks yet.

_Avoid_: “Pre-sim” in UI copy; conflating with **terrain authoring** parameter panels.

### Colonist settings

Configuration during **colonization setup** for the founding wave. Increment 1 pane: **three-day haul distance** (scale calibration), **history seed**, **homeland flavor** (presets + notes for **landing culture snapshot**), optional **starting population**, optional **yield modifier** (marginal / typical / bountiful **arable envelope** interpretation). Later: simulation **year cap** (max **epochs** before auto-stop). Trade, diplomacy, and expansion temperament knobs wait for later increments.

_Avoid_: “Civ picker” that implies pre-existing on-map peoples; “Difficulty” sliders without geographic meaning; settings that only apply to increment 3 **faction** play in the first test slice.

### Begin colonization

User action that commits **colonization setup** and starts the **colonization phase** clock—annual **epoch** ticks, expansion, **settlement** growth, and downstream simulation. **Terrain authoring** is hard-locked afterward; geography cannot change without resetting colonization state. The run ends when **political equilibrium** holds for N consecutive **epochs** or a **colonist settings** year cap is reached—whichever comes first; export may happen earlier.

_Avoid_: “Play” / “Run” without colonization context; auto-starting simulation when the **founding landing** is placed; silent terrain edits mid-run; infinite run with no stop condition.

### Founding landing

Map cell where the first colonizing boat makes shore—the seed **settlement** and expansion origin for one founding wave. Chosen by the user at **Colonize** time; must be **Sail overlay**-reachable coast or river mouth unless params allow overland-only founding (TBD).

_Avoid_: “Capital” before a **drain city** or political apex exists; random auto-placement without user intent.

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

Regenerate the candidate **landmass** when **validation checks** fail (missing haul corridors, **population ceiling** violation, impossible capital site)—same belt-and-braces pattern as Dwarf Fortress world rejection, but grounded in logistics constraints rather than biome quotas alone.

_Avoid_: “Retry button” without logged reject reasons; accepting broken worlds for speed.

### Geography seed

Deterministic input to **landmass pipeline** stages through **logistics pass** and **validation checks**. Same **geography seed** + params → same terrain fields and derived graph; independent of **history seed**.

_Avoid_: “World seed” alone when history events must also be reproducible; conflating with **seed** when both are meant.

### History seed

Deterministic input to **history log** simulation after **landmass** and initial **settlement** / **faction** placement. Same **geography seed** with different **history seed** → same map, different **rivalry** and borders.

_Avoid_: Single **seed** in export when authors need to share geography-only or replay history variants.

### Landing culture snapshot

One-time **culture** output at **begin colonization**: compressed summary from **colonist settings** plus **environmental pressure stack** at the **founding landing**—readable flavor, not annual **WAAC** drift. Used in **single-colony survival**; full **culture engine** cycles deferred to later increments.

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

**Middle-layer** holder of delegated authority (land, fort, toll)—**loyalty** tied to protection, profit, or habit. Increment 3: internal to a **faction** as **notable figures** with **conditional loyalty** tied to **chokepoint** / **grain circle** economics—not separate **faction territory** until defection (major **history log** event may spawn a new **faction**).

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

Region where delivery still pays after **ox paradox** (and road **movement cost**). Primary limit on land **trade** and garrison feeding. Extent is derived from **movement cost**, **three-day haul distance** (**colonist settings**), and **travel time**—not from raw grid pixels alone.

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

Maximum plausible urban or regional population implied by **arable envelope**, **haul-shed**, and **maritime reach**—an output of geography, not a slider first.

_Avoid_: “100k city” by aesthetic; capitals larger than their hinterland can feed.

### Arable envelope

Land that can sustainably feed a **settlement** or **drain city** given era-appropriate yields and **haul**—typically many times the built area for pre-industrial density.

_Avoid_: Farmland drawn only as map texture; farm percentage ignored (~80–95% rural in pre-industrial models).

### Survival triad

Minimum resource accounting for **single-colony survival**: food from **arable envelope**, freshwater from hydrology/coast access, fuel/shelter proxy from local biome and timber availability. Increment 1 test slice starts here; **salt** and fuller **strategic resource** layers complete increment 1 before **exploration and new settlements**.

_Avoid_: “Needs bars” UI jargon; treating the triad as the full **economy** model.

### Strategic resource

Geographically sparse necessity (salt for preservation, metals, timber above treeline gaps)—controls **trade routes**, **rivalry**, and who taxes whom.

_Avoid_: “Rare ore” with no logistics effect; salt as flavor text.

### Chokepoint

Pass, strait, ford, or toll segment where **movement cost** forces traffic—natural fort and **trade** leverage.

_Avoid_: “Border” lines without funnel geography; castles off the corridor.

### Trade route

Graph edge or corridor where moved goods still pay after **haul decay**—rivers, roads, sea lanes, **salt roads**—often explains **settlements** and **political middle layer** placement. Increment 3: geography proposes viable corridors; **faction** relations and **history log** events activate, tax, block, or sever them (war, embargo, treaty).

_Avoid_: “Trade route” as a line on art without volume or commodity; every road equal; user-drawn routes in hands-off mode.

### Settlement

A persisted population node (hamlet to **drain city**) whose tier and role should be justified by **arable envelope**, **chokepoint**, **strategic resource**, or **trade route**—not random dots. Exposes tier label and population count on inspect; size constrained by local **population ceiling** in **single-colony survival**.

_Avoid_: “City” / “town” labels without simulation backing; one capital per kingdom by default; tier without backing population accounting.

### Settlement tier

RPG-facing size band for a **settlement** (e.g. hamlet → village → town). Primary label on the map; pairs with population count in inspect panels.

_Avoid_: “Level” in domain language; tier divorced from **population ceiling** math.

### Population overlay

Map heatmap of where people actually are after each **epoch**'s **population collapse**—bulk population density, not just **settlement** pin dots.

_Avoid_: “People layer” when only **settlement** markers are shown; static density painted by hand.

### Bulk population

The vast majority of people not simulated as individuals—held as regional parameters (density, distribution constraints) until **population collapse** each **epoch**.

_Avoid_: “NPCs”; census lists for every farmer; agent simulation of every person in v1.

### Population collapse

Once per **epoch**, resolve bulk population parameters into a concrete spatial distribution for the **population overlay** and **settlement** totals—inspired by wavefunction-collapse-style constraint satisfaction (exact algorithm TBD). The canonical “where people are this year” observation.

_Avoid_: “Render pass” alone when simulation state is meant; collapsing mid-epoch for gameplay sub-ticks unless explicitly modeled.

### Notable figure

A directly tracked person (explorer, lord, expedition leader, …) whose individual state matters to simulation or **history log**—outside **bulk population** accounting. Increment 1 test slice: none; founder before increment 1 complete. Increment 3 **power roster**: apex leader per **faction** plus key **vassals** at **chokepoints**, **drain city** stewards, and active **expedition** leads—handful per **faction**, not proportional census.

_Avoid_: “Hero” in schema keys; simulating every notable as a full agent; full roster before exploration mechanics exist; dozens of tracked individuals per **city-state**.

### Faction

Simulated **power center** or aligned group with territory claims across one or more **settlements**, economic wants, and **rivalry** edges—emerges gradually in increment 3 from **supply-chain independence**, not at **founding landing**. A **city-state** is a **faction** whose capital **settlement** has reached sovereign town-tier or higher.

_Avoid_: “Race = faction”; static good/evil teams; 1:1 **faction** ↔ single hamlet without territorial claims.

### City-state

A **faction** whose capital **settlement** has reached sovereign town-tier or higher—an urban polity with its own **grain circle** or **maritime reach** dependence, not merely a fort on the frontier.

_Avoid_: “Kingdom” when only one city is sovereign; **city-state** before increment 3 independence; labeling every **settlement** a **city-state**.

### Political equilibrium

Colonization stop condition (with **year cap** backstop): **faction** borders and **rivalry** intensity stabilize for N consecutive **epochs**—present-day snapshot is readable without major pending realignments.

_Avoid_: “World peace” as victory; implying simulation cannot continue if user extends the **year cap**.

### Rivalry

Directed political tension between **factions** with stored causes—for GM-readable hooks. Increment 3 records causes sparsely when a **rivalry** edge is created or intensifies, across: **resource** (monopoly, embargo), **logistics** (**chokepoint**, **grain circle**, sea-lane), **territory** (border, succession), **legacy** (war, treaty), and **belief** (legitimacy, schism).

_Avoid_: “They hate each other”; **rivalry** without **legacy** or resource **obstacle**; logging every minor insult.

### History log

Ordered **epochs** and events (founding, conquest, famine, treaty) that feed **legacy** and reshape borders. Browsable in-app via **epoch scrubber** (map and **faction** state at selected year) and filterable **event feed** (wars, treaties, founding, …) that jumps to map locations.

_Avoid_: “Timeline” as flavor-only; events that don’t touch **power centers**; export-only log with no in-app investigation.

### Epoch

Discrete simulation tick for **colonization phase** and **history log**—one in-world **year** per tick in v1 (harvest cycles, haul economics, and **history log** entries align to annual steps). v1 advances by manual **epoch step**; **continuous colonization run** with pause/speed is the target UX once epoch application is reliable.

_Avoid_: “Year 1042” precision without source events; real-time wall-clock simulation in v1 copy; conflating with **terrain authoring** (no **epochs** until **begin colonization**); generational or seasonal ticks unless explicitly switched in **colonist settings**.

### Epoch step

Manual advance of one **epoch** during **colonization phase**—primary v1 time control for testing and inspecting causality between ticks.

_Avoid_: “Turn” in domain language when **epoch** is the persisted unit; sub-epoch micro-ticks in user-facing copy unless explicitly modeled.

### Continuous colonization run

Target UX: after **begin colonization**, simulation auto-advances **epochs** with pause and speed controls—same tick semantics as **epoch step**, not a different time model.

_Avoid_: “Real-time strategy mode”; wall-clock tied to in-world days.

### Seed

Deterministic input to generation; same **seed** + params → same **world**. Prefer explicit **geography seed** and **history seed** in the **world document** when stages are separable.

_Avoid_: “Random” without reproducibility; sharing worlds without **seed** export; one opaque seed when debugging requires knowing which stage diverged.

### World document

Serializable snapshot: **geography seed**, **history seed**, stage parameters, geography **fields**, **settlements**, **factions**, **trade routes**, **history log**, derived **culture** summaries. At simulation stop, exports support a **campaign kit**—not JSON alone.

_Avoid_: “Save file” in UI copy when the artifact is author-facing; PNG-only export as the whole **world**.

### Campaign kit

Primary GM deliverable when colonization reaches **political equilibrium** or **year cap**: map layers, structured **world document**, present-day brief (**factions**, **rivalries** with causes, key **settlements**), story hooks (border friction, **strategic resource** pressure, **vassal** defection risk), **reverse-engineering culture** notes per **faction**, and per-**settlement** **trade profile** (what each place wants and supplies for table-side trade play).

_Avoid_: “Lore dump” without causal hooks; politics-only export when economic trade opportunities are omitted.

### Settlement trade profile

Per-**settlement** synopsis of wanted vs supplied commodities—structured surplus/deficit per simulated good (grain, fish, **salt**, metals, timber, …) with triad-style headlines in the **campaign kit** UI. Derived from local **resource profile**, **haul-shed**, and active **trade routes**.

_Avoid_: Static flavor text without supply/demand backing; narrative-only profiles without structured fields; duplicating full **economy** simulation in the export blurb.

## Relationships

- **Landmass pipeline → fields before labels**: **scalar fields** (elevation, rainfall, temperature, drainage, salinity) overlap into **biomes** and **resource rasters**; hydrology is derived (erosion, river graph)—not painted first (Dwarf Fortress pattern; see research notes).
- **Landmass → hydrology → Sail overlay**: rivers, lakes, and coast on the final map feed **traversable water**; **meander refine** bridges must appear in **Sail overlay** connectivity, not only in presentation paint ignored by metrics.
- **Landmass pipeline → logistics pass**: after physical terrain, **ox paradox**, **arable envelope**, **maritime reach**, and **strategic resource** nodes apply—World Builder’s layer on top of DF-style geography.
- **Terrain authoring → Colonize → colonization setup → begin colonization**: user finishes tuning geography, places **founding landing**, sets **colonist settings**, then starts the **colonization phase** clock on a fixed **landmass**.
- **Rejection sampling → validation checks**: failed **population ceiling**, haul corridor, or node presence → regenerate candidate **landmass**; reject reasons inform tuning.
- **Geography seed / history seed → world document**: same map with different **history log** when only **history seed** changes; **founding landing** is independent of **geography seed**.
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
- **Campaign kit export**: present-day brief, political hooks, per-**faction** culture notes, per-**settlement** **trade profile** (wants/supplies)—primary GM deliverable at simulation stop.

## Example dialogue

- “This **drain city** isn’t impossible—the **maritime reach** from the delta feeds it; the **arable envelope** on the map is three days upstream.”
- “The pass **chokepoint** explains the **vassal** fort; if we add a lowland road, **conditional loyalty** breaks because the **grain circle** bypasses them.”
- “Run one **WAAC cycle** for the desert **environment** force before naming gods—wellkeepers are a **consequence**, not a aesthetic pick.”
- “**Rivalry** here is trade denial on **salt**, not ‘evil neighbors’—check the **strategic resource** layer.”
- “Same **geography seed**, new **history seed**—the delta’s still there; only the **faction** borders moved.”
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

1. **Single-colony survival** — one **settlement**, local resource exploitation, **equilibrium state**; settlement size growth only.
2. **Exploration and new settlements** — territory expansion, additional **settlements** at logistics nodes.
3. **Economy, politics, and history** — **trade routes**, **factions**, **city-states**, **history log**, **rivalry** (interdependent; one delivery slice). Enters automatically when **supply-chain independence** fires (land **haul-shed** split and/or **drain city** **maritime reach** branch)—either branch sufficient alone.

Within each increment, **culture engine** pressure may apply when regions are engaged; full **WAAC** visibility arrives with increment 3 unless earlier increments prove partial cycles.

Physical **landmass** and **logistics pass** complete during **terrain authoring**; **history seed** applies when **colonization phase** runs.

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

Used by **rejection sampling**; same role as Dwarf Fortress biome and feature quotas, but logistics-grounded. Hydrology sailing checks measure **Sail overlay** connectivity using sail-native report labels—**Sailable water**, **Coastal river access**, **Coast-to-interior sailing path**—not pre-refine graph edge counts or “navigable” wording.

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
- **Colonization geography inputs**: **best-effort**—**Colonize** after terrain validates; missing layers (e.g. full **movement cost**, **maritime reach**) use heuristics until **logistics pass** matures. Increment 2+ may tighten required layers.
- **Terrain lock**: geography hard-frozen at **begin colonization**; editing terrain requires resetting colonization state.
- **Increment 3 entry**: automatic when **supply-chain independence** fires (land **haul-shed** split and/or **drain city** **maritime reach** branch)—either branch sufficient alone.
- **Increment 3 politics**: **factions**, **city-states**, and **rivalry** emerge gradually over **epochs** after entry—not an instant realm split on the threshold **epoch**.
- **Simulation stop**: **political equilibrium** for N **epochs** or **year cap** from **colonist settings**—whichever first; early export allowed.
- **Increment 3 overlays**: **faction territory** and **trade route** overlays required; **strategic resource** layers reuse terrain; **haul-shed** and **rivalry** heat deferred to inspect/debug.
- **Mid-run control**: observe-only for outcomes in v1; pause may tweak non-geography settings (e.g. **year cap**), not **faction** borders or **history log** events.
- **Population model**: **bulk population** parameters + per-**epoch** **population collapse** for **population overlay**; **notable figures** tracked individually—WFC-style constraint satisfaction is inspiration, not a committed algorithm name in product copy.
- **Increment 2 exploration**: **exploration fog** overlay + auto-dispatched **expeditions**; new **settlements** founded automatically at logistics nodes—one realm until increment 3.
- **Grid scale**: no intrinsic km-per-cell; **three-day haul distance** and related **travel time** metrics are author-calibrated in **colonist settings** until map scale is modeled.
- **Colonization time controls**: v1 ships **epoch step**; **continuous colonization run** (pause/speed) is the target UX once epoch ticks are trustworthy.
