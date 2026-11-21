# Movie Vote: single-use room codes

**Status:** Accepted — carves **Movie Vote** out of **stable host suffix preference** and **host reclaim** (see [Star-room P2P](../../src/features/p2p/CONTEXT.md)) and out of **room exit survival** for personal prep (see [Movie Vote](../../src/features/movie-vote/CONTEXT.md)). **Game Timer** is unchanged.

## Context

Weekly votes kept inheriting the previous week's names and **movie picks**. The host's **room code** was deterministic (**stable host suffix preference**), a persisted host role resumed the old **room** after reload, **host reclaim** kept the old payload, and **movie picks** and the sticky **participant name** survived **room exit**. In practice **join links** are shared as QR codes and nobody revisits last week's URL, so the stable code bought nothing for Movie Vote.

## Decision

A Movie Vote **room code** is **single-use**:

- **Host room** always mints a random code; it never derives a stable suffix or reuses a saved one. An ended code is never reclaimable.
- **Stop hosting** ends the **room** and clears the persisted host role, suffix and name.
- The hosting menu's copy-code button is replaced by **refresh**: end the **room**, mint a new code, keep hosting. It confirms only when at least one **guest** is connected.
- **Start new vote** from **results** while hosting does the same (always confirms). Not hosting, it keeps the old local reset.
- Refresh and new vote keep the **host**'s **participant name** (no re-prompt); explicit stop does not.
- Anyone leaving a **room**, including **guests** booted by the **host**, loses their **participant name** and **movie pick** drafts. Only the fullscreen preference survives.
- A persisted host role resumes after reload only if the **room** is un-ended and `hostPing` is within 12 hours; otherwise the **host** starts clean.
- **Guests** are not told the new code; the **host** re-shares the QR.

## Consequences

- Old RTDB **rooms** accumulate. Cleanup, or account-owned history, is out of scope for now.
- The shared star-room core keeps its stable-suffix and reclaim behaviour for **Game Timer**; Movie Vote opts out.
