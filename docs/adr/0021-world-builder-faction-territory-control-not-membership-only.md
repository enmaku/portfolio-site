# World Builder faction territory paints control, not membership alone

[ADR 0018](0018-world-builder-faction-territory-primary-claim.md) kept exclusive **primary claim** geometry and ColorBrewer caps, but treated overlay fill as living **faction** membership. Soft commercial pull and non-taxed **trade partners** made that reading wrong: authors expect the board to show who *controls* hinterlands, including sustained **soft power** over free towns.

Glossary: [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md) (**Faction territory overlay**, **Factional control**, **Soft power**, **Trade partner**). Claim geometry unchanged: [ADR 0018](0018-world-builder-faction-territory-primary-claim.md). Sticky membership unchanged: [ADR 0019](0019-world-builder-sticky-faction-membership.md).

## Decision

**Faction territory overlay** fill follows **factional control** of each living **settlement**’s **primary claim**: taxed members and **vassals**, sticky **trade partners**, and map-gray pins under sustained **soft power**. A **faction** earns a ColorBrewer slot when it **controls** two or more living pins, not only when it has two taxed members. True gray means no controller. Membership still changes only on explicit events; **soft power** paint may shift under anti-churn without rewriting banners.

**Faction tax** buys allied **projected might**. **Soft power** and **trade partners** do not—overlay hue is not a war coalition.

## Consequences

Chrome and **campaign kit** maps can show commercial spheres without inventing taxed membership. Implementers must not “simplify” the overlay back to `factionId` alone, grant soft-power free towns or **trade partners** faction projection, or treat soft paint as silent membership.
