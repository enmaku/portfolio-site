# Dungeon Runner

Single-device card **match** against AI **opponents**; play is deterministic from **setup**, **seed**, and the action **history**.

## Language

### Match

One full play from **setup** through **match over**, including bidding, dungeon runs, and scoring until a winner is decided.

_Avoid_: “Game” alone (ambiguous with the whole app or a single dungeon run).

### Match over

The **match** has ended; a winner seat is recorded and the player sees the match-over outcome.

_Avoid_: “Finished game,” “complete game” (use **match** vocabulary).

### Dungeon run

One runner’s attempt through the monster lane during a **match**; distinct from the whole **match**.

### Setup

Seat count and **opponent** roles (human, neural opponent, random bot) chosen before a **match** starts.

### Opponent

A non-human seat in **setup** (neural opponent or random bot).

_Avoid_: “Role badge,” seat-type chips during play (role is fixed at **setup**; **setup** controls already show human vs **opponent** type).

### History

Ordered canonical actions and RNG step metadata that fully determine how a **match** unfolded.

_Avoid_: “History panel,” “action log” as in-match player UI (no play-surface for **history**; use **replay envelope** export when inspection is needed).

### Seed

The numeric RNG starting point for a **match**; with the same **setup** and **seed**, initial state and replayed outcomes match.

### Replay envelope

Versioned export shape: **seed**, **setup**, **history**, and optional **presentation pace** (e.g. cinematic or brisk)—used to rebuild state and share/debug a **match**.

_Avoid_: Treating the envelope as only a debug artifact; it is also the canonical serialized form of a finished **match** for archival.

### Completed match replay

A **replay envelope** for a **match** that has reached **match over**, captured automatically and retained for later analysis (e.g. model training).

_Avoid_: “Telemetry,” “training data,” “upload,” “save prompt,” “consent flow” (pipeline, transport, and opt-in UX are out of glossary scope).

## Relationships

- A **match** contains one or more **dungeon runs** before **match over**.
- A **completed match replay** is a **replay envelope** captured when **match over** is reached.
- **History** supplies the ordered actions recorded in a **replay envelope**.

## Example dialogue

> **Dev:** “When the player wins, do we save the last **dungeon run** or the whole **match**?”
> **Domain expert:** “The whole **match** — once we’re at **match over**, persist a **completed match replay**, not an isolated run.”

> **Dev:** “Is that the same JSON as debug export?”
> **Domain expert:** “Same **replay envelope** — **completed match replay** is the product name for that payload after a real finish.”

## Flagged ambiguities

- “Game” in casual speech usually means **match**; “run” usually means **dungeon run**.
- In-match “history panel” was considered and rejected — **history** stays engine/replay data only.
- Seat “role badges” during play were considered and rejected — **opponent** type belongs in **setup** only.
