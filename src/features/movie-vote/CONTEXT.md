# Movie Vote

Collaborative picker: propose films, converge on a finalized **ballot**, collect ranked votes, compute an **instant-runoff** collective choice.

## Language

### Phase

Stage of the cooperative flow (`suggest` → `voting` → `results`).

_Avoid_: Using “phase” for star-room connectivity posture—that is **connection status**.

### Suggest phase

Everyone contributes **movie picks** and marks readiness without locking the group tally yet.

### Voting phase

Participants submit **rankings** over the compiled **ballot**.

### Results phase

Shows the **room**’s authoritative **instant-runoff** outcome—the **host** commits winner or **declared tie** metadata and the **IRV rounds log** into **room**-level authority when entering this **phase** (not a per-client recompute as the source of truth).

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

### Instant-runoff (IRV)

Single-winner vote procedure eliminating lowest-performing options round by round according to aggregated **rankings**.

### Elimination tie-breaking

Deterministic tie rule when deciding which advancing candidate loses this IRV elimination step based on ballot list position.

### IRV rounds log

Per-round tally snapshots the **host** persists with the official **instant-runoff** outcome when entering **results phase**—for auditing or UX explanation.

### Connection status

Local star-room shell posture for transport and listeners (`idle`, `connecting`, `reconnecting`, `hosting`, `guest_connected`)—independent of collaborative **phase** (**suggest** → **voting** → **results**). [**Game Timer**](../game-timer/CONTEXT.md) documents the same shell values under **session phase**.

_Avoid_: Saying “phase” when you mean connectivity or reconnect banners.

### Vote progress

Submitted vs total ballot submission counts surfaced while ballots are still arriving.

### Declared tie

Outcome where multiple titles remain inseparable after IRV concludes with tie metadata rather than lone winner id.

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
- The **host** persists the official **instant-runoff** outcome (**IRV rounds log**, winner or **declared tie**) into **room**-level authority when entering **results phase**; that record is the collective result the **room** shows.

## Example dialogue

> **Host:** “Two people nominated the same blockbuster under different typo spellings.”  
> **Contributor:** “Compilation folds them into one **ballot movie**—TMDB id for catalogue picks, **normalized custom title** for free-typed ones.”

> **Moderator:** “We ended with drama + comedy tied at the finale.”  
> **Designer:** “Surface **declared tie** UX and expose **IRV rounds log** if people want justification.”

> **Dev:** “Guest refreshed—does IRV think they’re a brand-new voter?”  
> **Maintainer:** “**Stable client identity** tells **host** to **resume** the existing **participant id** slot once **draft payloads** / votes replay.”

## Flagged ambiguities

- “Nomination” vs “pick”: Resolved — treat **movie pick** as the neutral term; reserve “nomination” for conversational tone only.
- **Participant id** vs **stable client identity**: Resolved — **stable client identity** is the single canonical browser-level principal; **participant id** is the **host**-visible seat label inside one **room**; the shell aligns persistence and remapping with the principal while UX and tallies follow **participant id**.
- **Host** vs **participant** in tallies: Resolved — the **host** counts as a **participant** through the **host participant seat**.
- **Host** migration: Resolved — out of scope; a **room**’s **host** is fixed for that **room**’s lifetime.
- **IRV** source of truth: Resolved — the **host** writes the official outcome package to **room**-level authority at **results** entry; clients mirror it, not independent recompute as truth.
- “Phase” overload: Resolved — **phase** means **suggest** / **voting** / **results**; **connection status** means `idle` / `connecting` / … for the star-room shell (Game Timer still labels that **session phase**).
