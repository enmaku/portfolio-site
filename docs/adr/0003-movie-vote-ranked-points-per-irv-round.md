# Movie Vote: ranked-points tally per IRV round

**Status:** Superseded — see [ADR 0004 — Movie Vote: multi-method elections (textbook rules)](./0004-movie-vote-multi-method-elections.md).

**Movie Vote** still runs **instant-runoff (IRV)**—eliminate the lowest performer each round until one **ballot movie** wins or a **declared tie**. Typical IRV implementations score each round with first-preference head counts; with very small groups (about five **participants** or fewer) that tally skews toward “everyone ranked their own **movie pick** first” deadlocks and outcomes that do not reflect full **rankings**.

Each IRV round uses a **ranked-points tally** instead: among still-active titles, rescore every **participant**’s **ranking** so the least preferred earns 1 point, the next 2, and so on; sum across **participants** and eliminate the lowest total (**elimination tie-breaking** and **declared tie** rules unchanged). Results replay shows **points**, not “votes.” We keep the runoff structure and accept departure from textbook per-round IRV math because friend-scale rooms need the whole ballot to matter every round.

**Historical note:** Product behavior now follows textbook **instant-runoff voting**, **Borda count**, and **Condorcet method** per ADR 0004; the ranked-points hybrid is not used.
