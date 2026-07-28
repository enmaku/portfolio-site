# World Builder sticky faction membership

Logistics connectivity (**haul-shed** overlap, **roads**, **maritime reach**) is the natural input to increment 3 politics, so an obvious implementation is to re-partition living **settlements** into **factions** from connected components every **epoch**. That would make membership a derived view of the graph and erase the need for explicit political events.

Glossary: [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md) (**Faction**, **Faction absorption**, **Unaligned settlement**, **Conditional loyalty**, **Supply-chain independence**, **History log**). Related paint decision: [ADR 0018](0018-world-builder-faction-territory-primary-claim.md).

## Decision

**Faction** (and **unaligned**) membership is sticky stored state. It changes only on explicit political events—**founding faction** mint at **begin colonization**, out-of-reach founding mint (**strategic overstretch** reach), mid-run **strategic overstretch** peel, **vassal** defection (join / spawn / soft-**unaligned**), **maritime peel**, **faction absorption**, crystallization of **unaligned** cohorts, **faction** extinction, **settlement** abandonment, and staggered post-latch fracture/emergence. Logistics and trade raise *pressure* toward those events; they do not silently recolor banners when components merge or split. Sustained local food independence is seat-level loyalty pressure for **vassal** defection and **control strength**, not the primary mid-run fission that creates contiguous multi-**settlement** **factions**—that is **strategic overstretch** (flat living-membership span vs author setting, default **12**, slider **6–24**, **3**-epoch streak; farthest town-tier seed peels members closer to that seat than to the capital on the land/short-haul graph only; out-of-reach founding uses **land expedition range**). Component disconnect remains a separate break path.

Anti-churn applies to inverse membership flips: underlying causes must clear and re-arm, plus a short refractory floor so threshold flicker cannot rewrite identity on consecutive **epochs**.

**Faction absorption** survivor identity follows impetus (stronger/victor vs senior lineage on mutual re-integration). Absorbed members become **vassals** of the survivor; living **factions** are never nested under one another.

The **founding landing** receives a **founding faction** immediately so territory and membership are not blank until latch. **Vassal** membership events and **strategic overstretch** may fire whenever active **factions** exist (including pre-latch). Foundings outside the dispatching seat’s **strategic overstretch** reach (**land expedition range** from the sender) mint a peer **faction** at founding. On **supply-chain independence** latch, non-senior **logistics connectivity components** may detach into staggered mint queues; after minting, the graph is no longer the roster.

## Consequences

**History log** / **campaign kit** can attribute border change to named causes. Two **factions** may remain distinct while still trading or sail-linked until an absorption (or other) trigger fires. Implementers must not “simplify” politics to per-**epoch** `components(settlements)` and treat that as faithfulness to supply-chain feudalism—logistics drives events; events drive membership.
