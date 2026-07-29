# World Builder faction territory uses primary claim

Earlier increment 3 glossary treated **faction territory overlay** as geometric **haul-shed** circle fill with contested overlap where circles meet. That conflicted with the rule that two **settlements** cannot politically own the same land, and diverged from the hinterland mask already used by **survival triad**, **population collapse**, and **wealth overlay**.

Glossary: [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md) (**Faction territory overlay**, **Primary claim** / exclusive nearest-pin claim under **Haul-shed**, **Unaligned settlement**, **Wealth overlay**). Who the fill attributes to (control vs membership): [ADR 0021](0021-world-builder-faction-territory-control-not-membership-only.md).

## Decision

Paint **faction territory** on exclusive **primary claim** cells of each living controlled **settlement**—the same hinterland assignment as wealth and calorie claim. Overlapping **haul-shed** circles remain logistics geometry (latch, connectivity pressure, founding spacing) and do **not** create co-owned political fill. Color attribution follows **factional control** ([ADR 0021](0021-world-builder-faction-territory-control-not-membership-only.md)), not membership alone.

Presentation: ColorBrewer qualitative Set3 (**12** solid colors) for **factions** with multi-pin **factional control**; active roster capped at **12**—overflow mints prefer join-first, else **unaligned** until a slot frees; true gray when no controller; no capital / **vassal** / loyalty shade or opacity bands on fill; membership band instead scales settlement pin size (capital > member = **trade partner** = **unaligned** > **vassal**); no faction badges as pin chrome.

## Consequences

Political borders on the map follow claim recomputes each **epoch** (including after founding and abandonment). Contested *political* stories between **factions** read as abutting hinterlands and **rivalry** / corridor pressure, not as blended dual-fill cells. Authors comparing wealth and faction overlays share one mask and can disagree only on color meaning.
