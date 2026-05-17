# Movie Vote: multi-method elections (textbook rules)

**Status:** Accepted — supersedes [ADR 0003](./0003-movie-vote-ranked-points-per-irv-round.md).

**Movie Vote** picks one winner from a compiled **ballot** using ranked **rankings** from every **participant**. The **host** chooses a **voting method** for the **room**; tally code implements standard textbook definitions only—no project-specific hybrids.

## Voting methods

Three **voting method** options, each by its usual definition:

1. **Instant-runoff voting (IRV)** — Hare-style runoff: each round counts **first preferences** among still-active **ballot movies**, eliminates every candidate tied for fewest (**IRV last-place tie**), transfers ballots to the next ranked choice still in the race, stops on a majority among active ballots or a single remaining candidate. **Rounds log** records first-preference counts per round for replay.

2. **Borda count** — One pass on the full **ballot**: **classic Borda scale** (top rank *n*−1 points, bottom 0 for *n* candidates). Highest total wins.

3. **Condorcet method** — Pairwise majority from **rankings**; a **Condorcet winner** beats every other **ballot movie** head-to-head. Results may include a compact **pairwise matrix** for inspection.

Default for a new **room** is **instant-runoff voting**. Legacy `ranked-points` persisted values normalize to IRV.

## Tie policy

**No algorithmic tiebreak** across methods: never switch to another **voting method**, random lots, **ballot order**, or hidden rules to force a single winner. When the active method’s standard rules leave no unique winner, the outcome is a **declared tie** (`tieWinnerIds` non-empty, no `winnerId`).

- **IRV** — Further deadlock after simultaneous last-place eliminations (e.g. two remain with equal first preferences, or every active candidate tied for last) → **declared tie** on the remaining active set.
- **Borda count** — Equal highest totals → **declared tie** on all leaders.
- **Condorcet method** — No **Condorcet winner** (**Condorcet cycle**) → **declared tie** with `tieWinnerIds` listing exactly the **Smith set** (smallest non-empty set where every member reaches every outsider via pairwise majority beatpaths, with pairwise ties as mutual reachability), not the whole **ballot** unless the Smith set is everyone.

Human resolution outside the app is out of scope.

## Configuration lock

**Voting method** is **room**-level configuration: the **host** may change it only during **suggest phase** (**voting method settings** editable for **host**, read-only for **guests**). It is **locked** when **voting phase** begins so tallies and **results phase** copy match the rule everyone ranked under.

## Why this replaces ranked-points IRV

[ADR 0003](./0003-movie-vote-ranked-points-per-irv-round.md) rescaled each IRV round with a custom **ranked-points** tally to reduce small-group deadlocks. That departed from textbook IRV and collided with product language once **Borda count** and **Condorcet method** were added. We keep friend-scale rooms honest by offering three standard methods and **declared tie** instead of a fourth hybrid tally.

## Consequences

- Tally modules (`irv`, `borda`, `condorcet`, `election` facade) stay pure; **host** persists the official outcome into **room** authority at **results** entry.
- UI and glossary use method names from [Movie Vote CONTEXT](../../src/features/movie-vote/CONTEXT.md), not “ranked-points” or generic “IRV” for every method.
- Condorcet UX treats **pairwise matrix** as secondary detail; IRV keeps **rounds log** animation; Borda uses a single scoreboard.
