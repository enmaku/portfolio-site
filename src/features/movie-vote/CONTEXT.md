# Movie Vote

Collaborative picker: propose films, converge on a finalized **ballot**, collect ranked votes, compute an **instant-runoff** collective choice.

## Language

### Phase

Stage of the cooperative flow (`suggest` → `voting` → `results`).

### Suggest phase

Everyone contributes **movie picks** and marks readiness without locking the group tally yet.

### Voting phase

Participants submit **rankings** over the compiled **ballot**.

### Results phase

Shows **instant-runoff** outcome (winner or declared tie metadata).

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

Host-issued session identifier for a **participant**, carried in summaries and tallies—distinct from **stable client identity**, though reconnect may **resume** the same slot when the stable id matches.

### Draft payload

Guest → host bundle of provisional **movie picks** plus suggest-phase signals during **suggest phase**.

### Ready flag

Per-**participant** indicator that they finished nominating while drafts can still change.

### Ballot order

Authoritative sequence of **ballot movie** **public identifiers** driving ranking UI and tally inputs.

### Unique suggested movie count

Distinct nominated titles across the room during **suggest phase**—preview metric before **ballot compilation** completes.

### Host / Guest

Host aggregates participant payloads; guests send draft nominations and rankings. Mirrors [**Star-room P2P**](../p2p/CONTEXT.md).

### Ranking

Participant’s ordering of ballot ids (preferred first).

### Instant-runoff (IRV)

Single-winner vote procedure eliminating lowest-performing options round by round according to aggregated **rankings**.

### Elimination tie-breaking

Deterministic tie rule when deciding which advancing candidate loses this IRV elimination step based on ballot list position.

### IRV rounds log

Recorded per-round tally snapshot for auditing or UX explanation.

### Session phase

Realtime connection posture analogous to Game Timer (`idle`, `connecting`, `reconnecting`, `hosting`, `guest_connected`).

### Vote progress

Submitted vs total ballot submission counts surfaced while ballots are still arriving.

### Declared tie

Outcome where multiple titles remain inseparable after IRV concludes with tie metadata rather than lone winner id.

## Relationships

- A **participant** submits many **movie picks** during **suggest phase**, shipped incrementally inside **draft payloads** guarded by **ready flags**.
- The **host** is a **participant** via the **host participant seat**; **guests** receive ids from the host while retaining **stable client identity** at the browser layer for reconnect mapping.
- **Unique suggested movie count** summarizes nomination breadth before compilation locks **ballot order**.
- Compilation reduces picks to mutually distinct **ballot movies** keyed by TMDB id or **normalized custom title**.
- **Voting phase** consumes exactly the compiled ballot; each **participant** submits one **ranking**.
- IRV emits either a single champion id or **declared tie** ids plus **IRV rounds log** detail.

## Example dialogue

> **Host:** “Two people nominated the same blockbuster under different typo spellings.”  
> **Contributor:** “Compilation folds them into one **ballot movie**—TMDB id for catalogue picks, **normalized custom title** for free-typed ones.”

> **Moderator:** “We ended with drama + comedy tied at the finale.”  
> **Designer:** “Surface **declared tie** UX and expose **IRV rounds log** if people want justification.”

> **Dev:** “Guest refreshed—does IRV think they’re a brand-new voter?”  
> **Maintainer:** “**Stable client identity** tells **host** to **resume** the existing **participant id** slot once **draft payloads** / votes replay.”

## Flagged ambiguities

- “Nomination” vs “pick”: Resolved — treat **movie pick** as the neutral term; reserve “nomination” for conversational tone only.
- **Participant id** vs **stable client identity**: Resolved — stable identity is browser-persistent remapping glue; **participant id** is the host-visible seat label inside one **room**.
- **Host** vs **participant** in tallies: Resolved — the **host** counts as a **participant** through the **host participant seat**.
