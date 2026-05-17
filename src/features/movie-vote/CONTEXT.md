# Movie Vote

Collaborative picker: propose films, converge on a finalized **ballot**, collect ranked votes, compute a single-winner outcome with the **host**’s chosen **voting method**.

## Language

### Phase

Stage of the cooperative flow (`suggest` → `voting` → `results`).

_Avoid_: Using “phase” for star-room connectivity posture—that is **connection status**.

### Suggest phase

Everyone contributes **movie picks** and marks readiness without locking the group tally yet.

### Voting phase

Participants submit **rankings** over the compiled **ballot**.

### Results phase

Shows the **room**’s authoritative election outcome—the **host** commits winner or **declared tie** metadata and the persisted **rounds log** (when the method produces one) into **room**-level authority when entering this **phase** (not a per-client recompute as the source of truth).

### Movie pick

A proposed title, either **TMDB-backed** or **custom**.

### TMDB-backed pick

Pick tied to The Movie Database by numeric id with poster and metadata from search—the catalogue path.

_Avoid_: Saying “catalogue” alone without clarifying TMDB when precision matters.

### Custom pick

Film entered manually; overlapping titles merge using a **normalized custom title** key, not TMDB ids.

### Normalized custom title

Canonical spelling for a free-typed title—case- and punctuation-insensitive—used only to dedupe **custom picks** during **ballot compilation**.

### Ballot movie

Canonical row on the finalized list with stable **public identifier** surfaced to sorting and tally.

### Public identifier

Stable id string clients use when ranking **ballot** entries (distinct from ephemeral local drafts).

### Ballot compilation

Deduping overlapping **picks** into unique **ballot movies** ahead of ranking (TMDB id for **TMDB-backed picks**, **normalized custom title** for **custom picks**).

### Participant

Collaborator in the room for readiness and voting (includes the **host**, who uses a fixed **host participant seat**, and **guests**).

### Host participant seat

Reserved **participant id** for the **host** in readiness and **vote progress** tallies—stable and distinct from ids issued to **guests**.

_Avoid_: Treating the host as “not a **participant**” in copy about counts.

### Participant id

**Host**-managed seat label for a **participant** in summaries and tallies—includes the reserved **host participant seat**. Distinct from the shell’s canonical browser-level principal (**stable client identity**); reconnect maps that principal back to the same **participant id** when the **host** preserves the binding.

### Draft payload

Guest → host bundle of provisional **movie picks** plus suggest-phase signals during **suggest phase**.

### Ready flag

Per-**participant** indicator that they finished nominating while drafts can still change.

### Ballot order

Authoritative sequence of **ballot movie** **public identifiers** driving ranking UI and tally inputs.

### Unique suggested movie count

Distinct nominated titles across the room during **suggest phase**—preview metric before **ballot compilation** completes.

### Host / Guest

Host aggregates participant payloads into **room**-level authority (**phase**, **ballot order**, **ballot compilation**); guests supply **draft payloads**, **ready flags**, and **rankings**. Each **participant** may persist their own contribution while the **host** retains that **room** authority. The **host** role never transfers; with persisted collaboration, **guest** **participants** stay usable when the **host**’s browser is offline or backgrounded—**host**-only moves simply wait until that **host** returns. Mirrors [**Star-room P2P**](../p2p/CONTEXT.md) roles.

### Ranking

Participant’s ordering of ballot ids (preferred first).

### Voting method

Which standard single-winner rule the **host** selects for this **room**—**instant-runoff voting**, **Borda count**, or **Condorcet method**—each implemented by its usual textbook definition, not a project-specific hybrid. The **host** may change it only during **suggest phase**; it is locked when **voting phase** begins.

_Avoid_: Invented tally names, “ranked-points” as a stand-in for **Borda count** or **IRV**, or labeling every method “IRV” in UI; letting **guests** change the method.

### Voting method settings

Top-bar settings control for **voting method**: the **host** edits during **suggest phase** only; **guests** see the current choice read-only so rules are visible before **ranking**. Default for a new **room** is **instant-runoff voting**.

### Instant-runoff voting (IRV)

Hare-style ranked-choice runoff: each round counts **first preferences** among still-active **ballot movies**; **eliminate all tied for last** (**IRV last-place tie**); transfer ballots to each voter’s next ranked choice still in the race; stop when one candidate has a majority of active ballots or one remains.

### IRV last-place tie

When multiple **ballot movies** share the fewest first-preference votes in a round, **eliminate all tied for last** in that round, then transfer and continue. If the runoff cannot reach a single winner under standard **IRV** (e.g. two remain with equal first-preference totals), **declared tie**.

_Avoid_: Eliminating only one tied last-place candidate via **ballot order** or other ad hoc tie-breaks while calling it standard **IRV**.

### Borda count

Single pass: each **ranking** awards points by position on the full **ballot** using the **classic Borda scale** (top rank *n*−1 points, bottom 0, for *n* **ballot movies**). Highest total wins; equal highest totals yield a **declared tie**.

### Condorcet method

Pairwise comparisons from **rankings**: a **Condorcet winner** beats every other **ballot movie** head-to-head by strict majority on ballots. If none exists, **declared tie**—see **Condorcet cycle**. No fallback to another **voting method**.

### Condorcet cycle

No **ballot movie** beats every other head-to-head (a preference cycle). Outcome is **declared tie** with `tieWinnerIds` listing every member of the **Smith set**, not the whole **ballot** unless the Smith set is everyone.

### Smith set

Smallest non-empty set of **ballot movies** where every member reaches every candidate outside the set via pairwise majority steps, with pairwise ties counting as mutual reachability. When **Condorcet method** hits a **Condorcet cycle**, co-winners for **declared tie** are exactly this set.

_Avoid_: Requiring every Smith member to beat every outsider in a single head-to-head (cycles need beatpaths).

### Rounds log

Per-round snapshots the **host** persists for **instant-runoff voting** replay—first-preference counts each round, active set, eliminations. **Borda count** uses a single scored round in the same structure where applicable.

_Avoid_: **IRV rounds log** as the only name for every **voting method**; legacy field names like `counts` / `ballotsWithVote` in user-facing copy.

### Pairwise matrix

Compact **Condorcet method** results view: **ballot movies** on both axes with tiny poster thumbnails, each cell showing head-to-head outcome (win, loss, or pairwise tie) at a glance—dense and mobile-friendly for those who want detail.

_Avoid_: Full **rounds log** replay for **Condorcet method**; oversized matrices on small screens.

### Results summary

Primary **results phase** surface: clear winner **ballot movie** when there is a `winnerId`, or **declared tie** co-winner list otherwise. **Pairwise matrix** is secondary detail for **Condorcet method** only; **instant-runoff voting** uses **rounds log** animation; **Borda count** uses a single scoreboard.

### Connection status

Local star-room shell posture for transport and listeners (`idle`, `connecting`, `reconnecting`, `hosting`, `guest_connected`)—independent of collaborative **phase** (**suggest** → **voting** → **results**). [**Game Timer**](../game-timer/CONTEXT.md) documents the same shell values under **session phase**.

_Avoid_: Saying “phase” when you mean connectivity or reconnect banners.

### Vote progress

Submitted vs total ballot submission counts surfaced while ballots are still arriving.

### Declared tie

Outcome with no single `winnerId` and non-empty `tieWinnerIds`: the **room** could not pick one winner under the active **voting method** without inventing a tiebreak. Applies across **instant-runoff voting**, **Borda count**, and **Condorcet method** whenever the standard rules leave no unique winner (including **Condorcet cycle**, **Borda top tie**, pairwise deadlocks, or **IRV** rounds that fail to produce one remaining champion).

### No algorithmic tiebreak

Product rule: never resolve deadlocks by switching to another **voting method**, random lots, **ballot order**, or hidden rules—only **declared tie** (or human choice outside the app, out of scope).

_Avoid_: **Black’s method**, **Borda tiebreak**, subset runoffs, or any second-phase tally presented as an automatic tiebreaker.

## Relationships

- **Phase** (collaborative flow) and **connection status** (shell connectivity) stay independent—do not merge them in UI or persisted **room** fields.
- A **participant** submits many **movie picks** during **suggest phase**, shipped incrementally inside **draft payloads** guarded by **ready flags**.
- The **host** is a **participant** via the **host participant seat**; **guests** receive **participant id** seat labels from the **host** while **stable client identity** is the canonical browser principal for reconnect and per-**participant** persistence.
- **Room**-level authority (**phase**, **ballot order**, **ballot compilation**) is **host**-owned; **participant**-scoped state (**draft payload**, **ready flag**, **ranking**) is **participant**-owned at persistence while the **host** still aggregates for compilation and tally.
- The **host** is never reassigned for a **room**; **guest** **participants** do not lose the **room** because the **host** tab sleeps or disconnects—only **host**-only progression waits on the **host**.
- What collaborators must agree on in a **room** has a single authoritative shared copy; each browser mirrors that copy locally for UI rather than treating local state as a competing source of truth.
- **Unique suggested movie count** summarizes nomination breadth before compilation locks **ballot order**.
- Compilation reduces picks to mutually distinct **ballot movies** keyed by TMDB id or **normalized custom title**.
- **Voting phase** consumes exactly the compiled ballot; each **participant** submits one **ranking**.
- The **host** persists the official election outcome (**rounds log** when applicable, winner or **declared tie**) into **room**-level authority when entering **results phase**; that record is the collective result the **room** shows.
- The active **voting method** is **room**-level configuration chosen by the **host** during **suggest phase**, broadcast to **guests**, and locked when **voting phase** starts; tally uses standard rules for that method only.
- Any deadlock under those rules ends in **declared tie**—never an automatic crossover to another **voting method** (**no algorithmic tiebreak**).
- Election rules and tie policy: [ADR 0004](../../../docs/adr/0004-movie-vote-multi-method-elections.md) (supersedes [ADR 0003](../../../docs/adr/0003-movie-vote-ranked-points-per-irv-round.md)).

## Example dialogue

> **Host:** “Two people nominated the same blockbuster under different typo spellings.”  
> **Contributor:** “Compilation folds them into one **ballot movie**—TMDB id for catalogue picks, **normalized custom title** for free-typed ones.”

> **Moderator:** “We ended with drama + comedy tied at the finale.”  
> **Designer:** “Surface **declared tie** UX and expose the **rounds log** if people want justification.”

> **Host:** “Condorcet cycle—who wins?”  
> **Maintainer:** “Nobody automatically. **Declared tie**—no **Borda tiebreak**, no subset **IRV**.”

> **Host:** “Two films tied on **Borda count**.”  
> **Maintainer:** “**Declared tie**. We don’t run another algorithm to break it.”

> **Guest:** “Why no winner under **Condorcet method**?”  
> **Designer:** “Winner card states **declared tie**; optional **pairwise matrix** shows the cycle—check / X / tie in each cell, posters on the axes.”

> **Dev:** “Guest refreshed—does IRV think they’re a brand-new voter?”  
> **Maintainer:** “**Stable client identity** tells **host** to **resume** the existing **participant id** slot once **draft payloads** / votes replay.”

## Flagged ambiguities

- “Nomination” vs “pick”: Resolved — treat **movie pick** as the neutral term; reserve “nomination” for conversational tone only.
- **Participant id** vs **stable client identity**: Resolved — **stable client identity** is the single canonical browser-level principal; **participant id** is the **host**-visible seat label inside one **room**; the shell aligns persistence and remapping with the principal while UX and tallies follow **participant id**.
- **Host** vs **participant** in tallies: Resolved — the **host** counts as a **participant** through the **host participant seat**.
- **Host** migration: Resolved — out of scope; a **room**’s **host** is fixed for that **room**’s lifetime.
- **IRV** source of truth: Resolved — the **host** writes the official outcome package to **room**-level authority at **results** entry; clients mirror it, not independent recompute as truth.
- **Custom ranked-points hybrid**: Resolved — abandoned; each **voting method** uses its standard definition only. [ADR 0003](../../../docs/adr/0003-movie-vote-ranked-points-per-irv-round.md) is superseded by [ADR 0004](../../../docs/adr/0004-movie-vote-multi-method-elections.md).
- **Voting method** labels: Resolved — **instant-runoff voting**, **Borda count**, **Condorcet method** in UI and docs; no project-specific tally vocabulary.
- **Condorcet completion** when no winner: Resolved — **declared tie** (**Condorcet cycle**); no **Black’s method** or other fallback.
- **IRV tie-breaking** among tied last place: Resolved — **eliminate all tied for last** each round (**IRV last-place tie**); any further deadlock → **declared tie**.
- **Borda weights**: Resolved — **classic Borda scale** (*n*−1 … 0).
- **Borda top tie** completion: Resolved — **declared tie** only.
- **Tiebreak policy (all methods)**: Resolved — **no algorithmic tiebreak**; **declared tie** only.
- **Condorcet cycle** `tieWinnerIds`: Resolved — **Smith set** members only.
- **Voting method settings** visibility: Resolved — **host** edits in **suggest phase**; **guests** read-only.
- **Default voting method**: Resolved — **instant-runoff voting** for a new **room**.
- **Results replay per method**: Resolved — **IRV**: multi-round **rounds log**; **Borda count**: single scoreboard; **Condorcet method**: winner or tie card plus optional compact **pairwise matrix** (win / loss / pairwise tie per cell, poster thumbnails on axes).
- **When the host may change voting method**: Resolved — **suggest phase** only; locked at **voting phase** entry.
- “Phase” overload: Resolved — **phase** means **suggest** / **voting** / **results**; **connection status** means `idle` / `connecting` / … for the star-room shell (Game Timer still labels that **session phase**).
