# Movie Vote: multi-method elections (textbook rules)

**Status:** Accepted — supersedes [ADR 0003](./0003-movie-vote-ranked-points-per-irv-round.md).

**Movie Vote** picks one winner from a compiled **ballot** using ranked **rankings** from every **participant**. The **host** chooses a **voting method** for the **room**; tally code implements standard textbook definitions only—no project-specific hybrids.

## Voting methods

Standard **voting method** options, each by its usual definition:

1. **Instant-runoff voting (IRV)** — Hare-style runoff: each round counts **first preferences** among still-active **ballot movies**, eliminates every candidate tied for fewest (**IRV last-place tie**), transfers ballots to the next ranked choice still in the race, stops on a majority among active ballots or a single remaining candidate. **Rounds log** records first-preference counts per round for replay.

2. **Borda count** — One pass on the full **ballot**: **classic Borda scale** (top rank *n*−1 points, bottom 0 for *n* candidates). Highest total wins.

3. **Dowdall method** — One pass on the full **ballot**: **harmonic scale** (1, ½, ⅓, … by rank position). Highest total wins. Not **Borda count** (linear weights).

4. **Condorcet method** — Pairwise majority from **rankings**; a **Condorcet winner** beats every other **ballot movie** head-to-head. Results may include a compact **pairwise matrix** for inspection.

5. **Copeland method** — Pairwise wins minus losses from **rankings** (pairwise ties count neither); unique highest **Copeland score** wins. Results may include **Copeland score** plus a compact **pairwise matrix**.

6. **Coombs method** — Anti-plurality runoff: each round counts **last preferences** among still-active **ballot movies**, eliminates every candidate tied for most last-place (**Coombs most-last-place tie**), repeats until one remains. **Rounds log** records last-place counts per round for replay.

7. **Baldwin method** — Borda elimination: each round tallies **classic Borda scale** among survivors only, eliminates every candidate tied for lowest (**Baldwin lowest-tie**), repeats until one remains. **Rounds log** records Borda-on-survivors totals per round for replay.

Default for a new **room** is **instant-runoff voting**. Legacy `ranked-points` persisted values normalize to IRV.

## Tie policy

**No algorithmic tiebreak** across methods: never switch to another **voting method**, random lots, **ballot order**, or hidden rules to force a single winner. When the active method’s standard rules leave no unique winner, the outcome is a **declared tie** (`tieWinnerIds` non-empty, no `winnerId`).

- **IRV** — Further deadlock after simultaneous last-place eliminations (e.g. two remain with equal first preferences, or every active candidate tied for last) → **declared tie** on the remaining active set.
- **Borda count** — Equal highest totals → **declared tie** on all leaders.
- **Dowdall method** — Equal highest totals → **declared tie** on all leaders.
- **Condorcet method** — No **Condorcet winner** (**Condorcet cycle**) → **declared tie** with `tieWinnerIds` listing exactly the **Smith set** (smallest non-empty set where every member reaches every outsider via pairwise majority beatpaths, with pairwise ties as mutual reachability), not the whole **ballot** unless the Smith set is everyone.
- **Copeland method** — Equal highest **Copeland scores** → **declared tie** on all score leaders only; no **Schulze method** or **Black’s method** fallback.
- **Coombs method** — Further deadlock after simultaneous most-last-place eliminations (e.g. two remain with equal last-place totals, every active candidate tied for most last-place, or no ballots express a preference among actives) → **declared tie** on the remaining active set.
- **Baldwin method** — Every survivor ties for lowest Borda among actives in a round (**Baldwin lowest-tie**) → **declared tie** on the remaining active set.

Human resolution outside the app is out of scope.

## Configuration lock

**Voting method** is **room**-level configuration: the **host** may change it only during **suggest phase** (**voting method settings** editable for **host**, read-only for **guests**). It is **locked** when **voting phase** begins so tallies and **results phase** copy match the rule everyone ranked under.

## Why this replaces ranked-points IRV

[ADR 0003](./0003-movie-vote-ranked-points-per-irv-round.md) rescaled each IRV round with a custom **ranked-points** tally to reduce small-group deadlocks. That departed from textbook IRV and collided with product language once additional standard **voting method** options were added. We keep friend-scale rooms honest by offering seven standard methods and **declared tie** instead of a hybrid tally.

## Consequences

- Tally modules (`irv`, `borda`, `dowdall`, `condorcet`, `copeland`, `coombs`, `baldwin`, `election` facade, …) stay pure; **host** persists the official outcome into **room** authority at **results** entry.
- UI and glossary use method names from [Movie Vote CONTEXT](../../src/features/movie-vote/CONTEXT.md), not “ranked-points” or generic “IRV” for every method.
- Condorcet and Copeland UX treat **pairwise matrix** as secondary detail (Copeland also shows **Copeland score**); IRV, Coombs, and Baldwin keep **rounds log** animation; Borda and Dowdall each use a single scoreboard.
