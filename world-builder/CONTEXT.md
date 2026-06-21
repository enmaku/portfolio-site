# World Builder

Desktop app for procedural fantasy **worlds**: plausible **landmasses**, **settlements** and **trade networks** driven by logistics, and **histories** that produce **factions** and **rivalries** with traceable causes.

Epic: [#293](https://github.com/enmaku/portfolio-site/issues/293). Research index: [`research/README.md`](./research/README.md) (Worldbuilding Insights playlist).

## Language

### World Builder

Working title for the desktop app in this repo (`world-builder/`). Distinct from portfolio **projects** (Game Timer, Movie Vote, …).

_Avoid_: “Worldbuilder” as a generic verb when naming the product; “map generator” alone (maps are an output, not the whole system).

### World

One generated playable setting: **landmass**, **climate**, **resource** layout, **cultures**, **settlements**, **trade networks**, **political** structure, and **history log**, tied to a **seed**.

_Avoid_: “Setting” alone in export/schema keys; “planet” unless generation is explicitly planetary.

### Landmass

Continental-scale geography output: elevation, coastlines, hydrology, **biomes**, and derived movement-cost fields—not political borders.

_Avoid_: “Map” alone when meaning the full **world** document; “terrain texture” for the political/economic layer.

### Culture engine

Causality-driven framework for generating **cultures**: **environmental pressures** and **five forces** run **WAAC cycles** that emit **culture layers**—not aesthetic-first trait picking.

_Avoid_: “Lore generator”; “culture tables” that pick dress and gods without pressure inputs.

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

Under any political surface (feudal, republic, tribal, …): **power centers** with wants, blockers, and actions—the machine that produces ongoing **rivalry**. Built from **WAAC cycles**, not throne furniture.

_Avoid_: “Factions” lists with static alignments; “everyone hates the evil king” without **obstacles**.

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

**Middle-layer** holder of delegated authority (land, fort, toll)—**loyalty** tied to protection, profit, or habit.

_Avoid_: “Lord” generically for every noble; vassal without a liege relationship.

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

Region where delivery still pays after **ox paradox** (and road **movement cost**). Primary limit on land **trade** and garrison feeding.

_Avoid_: “Radius” in miles only; use **travel time** at human scale where possible.

### Three-day rule

Rule of thumb: beyond ~three days' **travel time** by cart, bulk food **haul** often fails economically—not tradition, arithmetic.

_Avoid_: Stating distances in miles/km alone for RPG prep; “two weeks north” without consistency.

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

**Settlement** that concentrates flow (often port or river hub)—“parasite” in the sense of importing surplus from a wide **arable envelope** or **maritime reach**, not local subsistence.

_Avoid_: “Capital” with arbitrary population; metropolis in a food desert.

### Population ceiling

Maximum plausible urban or regional population implied by **arable envelope**, **haul-shed**, and **maritime reach**—an output of geography, not a slider first.

_Avoid_: “100k city” by aesthetic; capitals larger than their hinterland can feed.

### Arable envelope

Land that can sustainably feed a **settlement** or **drain city** given era-appropriate yields and **haul**—typically many times the built area for pre-industrial density.

_Avoid_: Farmland drawn only as map texture; farm percentage ignored (~80–95% rural in pre-industrial models).

### Strategic resource

Geographically sparse necessity (salt for preservation, metals, timber above treeline gaps)—controls **trade routes**, **rivalry**, and who taxes whom.

_Avoid_: “Rare ore” with no logistics effect; salt as flavor text.

### Chokepoint

Pass, strait, ford, or toll segment where **movement cost** forces traffic—natural fort and **trade** leverage.

_Avoid_: “Border” lines without funnel geography; castles off the corridor.

### Trade route

Graph edge or corridor where moved goods still pay after **haul decay**—rivers, roads, sea lanes, **salt roads**—often explains **settlements** and **political middle layer** placement.

_Avoid_: “Trade route” as a line on art without volume or commodity; every road equal.

### Settlement

A persisted population node (hamlet to **drain city**) whose tier and role should be justified by **arable envelope**, **chokepoint**, **strategic resource**, or **trade route**—not random dots.

_Avoid_: “City” / “town” labels without simulation backing; one capital per kingdom by default.

### Faction

Simulated **power center** or aligned group with territory claims, economic wants, and **rivalry** edges—emerges from **history log**, not only from culture dress.

_Avoid_: “Race = faction”; static good/evil teams.

### Rivalry

Directed political tension between **factions** with stored causes (border, succession, trade denial, old war)—for GM-readable hooks.

_Avoid_: “They hate each other”; rivalry without **legacy** or resource **obstacle**.

### History log

Ordered **epochs** and events (founding, conquest, famine, treaty) that feed **legacy** and reshape borders.

_Avoid_: “Timeline” as flavor-only; events that don’t touch **power centers**.

### Epoch

Discrete simulation tick for **history log**—generational or seasonal abstraction, not necessarily year-by-year.

_Avoid_: “Year 1042” precision without source events; real-time simulation in v1 copy.

### Seed

Deterministic input to **landmass** and simulation stages; same **seed** + params → same **world**.

_Avoid_: “Random” without reproducibility; sharing worlds without **seed** export.

### World document

Serializable snapshot: **seed**, stage parameters, geography fields, **settlements**, **factions**, **trade routes**, **history log**, derived **culture** summaries.

_Avoid_: “Save file” in UI copy when the artifact is author-facing; PNG-only export as the whole **world**.

## Relationships

- **Landmass → environmental pressure stack**: elevation, hydrology, and **climate** produce movement cost, visibility, connectivity, predictability, survival stress, and **resource profile** inputs.
- **Environmental pressure stack → culture engine**: pressures run **WAAC cycles** that fill **six culture layers** per people; **exchange** modulates isolation vs synthesis.
- **Culture engine → settlement simulation**: **survival strategy** and **resource profile** bias where people cluster (water, arable land, defensible **chokepoints**, junctions).
- **Ox paradox + movement cost → haul-shed**: caps land **trade**; explains **three-day rule** and spacing of **baronies** along **grain circle** routes.
- **Maritime reach → drain city**: sea **haul cost** enables large **population ceiling** off-site; **strategic resource** ports become **power centers**.
- **Settlement + haul → trade route**: routes are viable edges on the movement graph; **chokepoints** attract toll **vassals** and forts.
- **Trade route + strategic resource → conflict engine**: scarcity creates **obstacles** between **power centers**; **exchange** force drives smuggling and alliance.
- **Supply-chain feudalism → political middle layer**: **vassals** hold nodes on **grain circle** and **trade route** graphs; **conditional loyalty** when logistics shift.
- **Five forces → conflict engine**: same **WAAC** machinery as **culture engine**; **belief** **legitimizes** **power**; **legacy** stores grudges as **rivalry**.
- **History log → legacy → rivalry**: wars and treaties rewrite borders and **faction** wants; present politics read from the log, not freehand borders.
- **Reverse-engineering culture ↔ export**: GM-facing tooltips trace rituals and borders to pressures for table use.

## Example dialogue

- “This **drain city** isn’t impossible—the **maritime reach** from the delta feeds it; the **arable envelope** on the map is three days upstream.”
- “The pass **chokepoint** explains the **vassal** fort; if we add a lowland road, **conditional loyalty** breaks because the **grain circle** bypasses them.”
- “Run one **WAAC cycle** for the desert **environment** force before naming gods—wellkeepers are a **consequence**, not a aesthetic pick.”
- “**Rivalry** here is trade denial on **salt**, not ‘evil neighbors’—check the **strategic resource** layer.”

## Landmass constraints (simulation inputs)

Geography is not decorative: **landmass** stages must emit fields the **culture engine**, **settlement** placement, and **conflict engine** consume. Derived from logistics-first worldbuilding (playlist #05, #15–#18, #13).

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

- No **population ceiling** violation: urban nodes fit their **arable envelope** and **haul** mode.
- No impossible capitals: apex **settlements** sit on sea, river, or rich hinterland—not isolated peaks without **maritime reach**.
- **Trade routes** follow low **movement cost** paths; long bulk hauls respect **ox paradox** unless **maritime reach** applies.
- **Political middle layer** aligns with **supply-chain feudalism** nodes, not random castles.
- **Strategic resource** scarcity produces explainable **conflict engine** wants (salt wars, timber monopolies).

## Flagged ambiguities

- **WAAC** spelling vs playlist “WAC” / “WOAC”—canonical here is **WAAC cycle** (four explicit steps).
- **Fantasy races** vs **culture**: playlist #14 argues species should diverge in cognition/biology; v1 **culture engine** may assume human-norm peoples unless a separate species layer is added later.
- **Magic / industrial exceptions**: **ox paradox** and **population ceiling** assume pre-industrial logistics; teleportation, flying mounts, or preservation magic need explicit overrides or they break **supply-chain feudalism**.
- **Map-first vs story-first**: playlist #05 warns against pretty maps before need; World Builder generates geography-first for simulation, but export should still answer “why is this port valuable?” like a journey-driven story map.
