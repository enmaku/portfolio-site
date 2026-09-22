# Movie Vote: host phase controls and participant quorum

**Status:** Accepted — supersedes the mid-vote stuckness and optional-seat portions of [ADR 0023](./0023-movie-vote-quorum-controls-suggest-only.md).

**Movie Vote** no longer supports optional / non-voting seats. Every **participant** is in **participant quorum**: each seat must set **ready flag** and submit a **ranking** for automatic phase advances.

## Host phase controls

The **host** may move the **room** between **suggest phase**, **voting phase**, and **results phase** in either direction via **host phase controls**. Forward into **voting** may skip the all-ready gate when compiling at least two distinct movies. Forward into **results** may **force-finish voting**: incomplete **rankings** are dropped and excluded from the tally; if no complete ballot remains, the room stays in **voting**.

Backward **voting** → **suggest** reopens **movie picks** and clears **rankings** / outcome while preserving picks (wipe remains a separate start-over path).

## Suggest-only removal (ADR 0023 remainder)

**Host participant removal** and **clear guests** stay **suggest phase** only. Mid-vote disconnect no longer hard-blocks forever: the **host** can **force-finish voting** or move phases instead of ejecting mid-ballot.
