# World Builder major war uses logistics-projected martial capacity and war exhaustion

Major-war outcomes could have been a crow-flies faction strength roll, a tactical battle sim, or whole-**faction absorption** on every win. Those either ignore corridors, explode scope, or erase sticky pin-level membership.

Glossary: [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md) (**Contested settlement**, **Martial capacity**, **Projected might**, **Defender advantage**, **War exhaustion**, **Conquest**, **Rebellion**, **Conflict engine**). Related: [ADR 0019](0019-world-builder-sticky-faction-membership.md).

## Decision

Resolve each major war (inter-**faction** **conquest** or internal **rebellion**) as a deterministic comparison of **projected might** at one **contested settlement**. **Martial capacity** is population-scaled at the source pin, modified by food surplus, **base metals** access, wealth/mercenary offset, and stake **defender advantage**. Attenuation follows the existing logistics / trade-candidate graph (**directional haul friction**, strategic-reach soft cutoff)—not crow-flies distance. Attackers need nonzero projection to contest.

Victory transfers only the stake pin (typically as a **vassal**); whole-**faction absorption** via war only on extinction. Aftermath applies **war exhaustion**: temporary martial penalty plus lasting population loss proportional to contribution on both sides (stake premium), and blocks on-map trade between belligerents on subsequent **epochs** until peace/treaty (min one post-war **epoch**)—politics runs after trade clearing, so the war year is not rewritten.

## Consequences

Empires that keep fighting hollow out and lose distant holds through the same projection math that won them—no special distant-holdings rule. Implementers must not replace pin-level conquest with the old whole-**faction** `warOutcomes` absorb stub, invent a parallel war pathfinder, or add RNG to the force comparison.
