# World Builder soft power is two passes, not one blended score

Non-violent affiliation could have been one amalgamated “influence” score mixing trade share with neighbor borders, corridors, and might. That would blur commercial spheres (overlay paint, **trade partner**) with weak external binds (**alliance** → **vassal**) and invite open-sea “news from abroad” into local neighbor politics.

Glossary: [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md) (**Soft power**, **Trade agreement**, **Political pressure**, **Alliance**, **Trade partner**, **Vassal**). Overlay control: [ADR 0021](0021-world-builder-faction-territory-control-not-membership-only.md). Sticky membership: [ADR 0019](0019-world-builder-sticky-faction-membership.md).

## Decision

**Soft power** is an umbrella for two separate passes in each **epoch**, in order: **trade agreement** (commercial dominance → optional paint, then **trade partner** join) then **political pressure** (neighbor borders, pop/wealth/**martial capacity**, trade history, direct **road** / **inland sail** corridors — never **open-sea**) then major-war **conflict**. Scores and events stay separate; they share anti-churn / sticky-membership discipline only.

**Alliance** (pressure) joins an existing banner as a **vassal**, or peer-mints free towns as capital + ordinary members. Membership flips are atomic within the **epoch**; pressure does not pre-paint before the **alliance**. Commercial pre-join paint from **trade agreement** remains ([ADR 0021](0021-world-builder-faction-territory-control-not-membership-only.md)).

## Consequences

Authors can amalgamate the faction map via neighbor pressure without collapsing it into trade-share math or ocean-spanning soft empires. Implementers must not merge the two passes into one score, run pressure after war in the same **epoch**, treat **alliance** as a **trade partner** or polity type, or amplify pressure over **open-sea** links.
