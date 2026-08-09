# World Builder cooperative progress yielding

Long World Builder work (terrain generation, colonization commit, epoch advance including trade clearing, session rehydration, and similar) historically ran as long synchronous main-thread blocks. Progress pills existed for some stages while others—notably trade clearing—updated the label once and then stalled the browser until the whole phase finished. Network and population collapse already yielded between substeps; that pattern must be the rule, not the exception.

Glossary: [`world-builder/CONTEXT.md`](../../world-builder/CONTEXT.md) (**Progress chrome**).

## Decision

Any World Builder process that can take noticeable wall time and that surfaces a load/progress pill (or equivalent progress chrome) must:

1. **Yield periodically** so the UI can paint and the browser does not treat the page as stalled.
2. **Update progress chrome** on each yield with a truthful step label.
3. **Prefer logical substeps** as the primary progress structure (pipeline stages, epoch phases, hydrology substeps, and so on).
4. **When a single substep itself can take noticeable time**, expose an inner indicator appropriate to the work: an item counter (`13/145`) when the unit of work is discrete, or a percentage (`11%`) when the work is continuous or hard to count.

A multi-second main-thread monolith with a static progress label is explicitly out of bounds—even when the underlying algorithm is correct and deterministic.

## Consequences

- New heavy stages (including trade clearing and future politics) inherit the same yield + progress contract as generation and collapse.
- Deterministic sim results must not depend on yield timing; yields only release the UI thread between pure work chunks.
- Progress chrome may show nested labels (phase · substep · counter/percent) when outer and inner progress both apply.
- **Epoch step** Trade phase uses named clearing-ladder substeps (local prices → survival → comfort → prosperity → off-map residual); any substep that can still stall gets an inner `n/m` or `%`.
- **Epoch step** Politics phase uses named substeps (latch → membership → conflict → absorption → palette); Conflict yields while scoring conquest stakes and reports an inner `n/m`.
- Unit and integration test wall times are a primary signal for where yields belong—stages or substeps that run slowly under test are presumed to need cooperative yielding and progress updates in the product UI. Paying attention to those timings is enough; no separate profiling pass is required to decide placement.
