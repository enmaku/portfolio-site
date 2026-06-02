## Problem Statement

When **neural opponent** inference or model load fails during a **match** (especially after backgrounding the browser on mobile), the product silently substitutes non-NN behavior: legal-action fallbacks that over-select **sacrifice** actions, cooldown-driven **Randombot** play, and optional mid-match model downgrades. Players believe they are facing the **neural opponent** they chose in **setup**, but may actually be playing against degraded logic with no clear signal.

This violates least surprise: a user who selects a **neural opponent** must always play against that opponent type unless they explicitly chose **Randombot** for that seat.

## Solution

Replace silent NN fallbacks with an explicit **neural runtime recovery** pipeline:

1. On recoverable failure, **block only the active neural seat's turn** and show inline status ("Opponent reconnecting…") while attempting full runtime re-initialization (cache clear, inference queue reset, model reload; WebGL then CPU backend escalation).
2. After bounded retries, show a blocking terminal error: **refresh the page** (infer exhausted, model loads but policy path still fails) or **return to setup** with **setup** pre-filled (load exhausted, model cannot be loaded).
3. At **match** start (and on resume from persisted **match**), run a strict load gate so a **match** never begins if selected models cannot load.
4. Remove all in-match paths that swap a **neural opponent** for **Randombot** or random legal actions except the existing temporary **pick-adventurer** bypass (env-gated until training improves).

Ready for agents.

## User Stories

### Honest opponents

1. As a player who selected a **neural opponent** in **setup**, I want every bidding and dungeon turn from that seat to use the policy network, so that I am always playing the opponent I chose.
2. As a player who selected **Randombot** for a seat, I want that seat to use Randombot only, so that opponent types are predictable from **setup**.
3. As a player, I want the product never to silently substitute Randombot or random legal actions when a **neural opponent** fails, so that I am not misled about who I am playing against.
4. As a player, I want a failed NN load at **match** start to prevent the **match** from starting, so that I do not discover incompatibility mid-game.

### Recovery UX (live play)

5. As a player, when a **neural opponent** turn fails transiently, I want that turn to wait with a visible "reconnecting" state on that seat, so that I know the game is repairing rather than frozen.
6. As a player on my own turn while a **neural opponent** is recovering, I want to still be able to act, so that only the broken opponent turn is blocked.
7. As a player, when recovery succeeds, I want the **neural opponent** to resume normal policy play without any action having been taken via fallback, so that **history** stays honest.
8. As a player, when infer recovery is exhausted, I want a clear message to refresh the page, so that I can reset the browser runtime while keeping my saved **match**.
9. As a player, when load recovery is exhausted, I want a clear message that the **neural opponent** cannot load and I should return to **setup**, so that I can change model or pick **Randombot** knowingly.
10. As a player sent to **setup** after load failure, I want my seat configuration preserved, so that I can fix one seat without re-entering the whole table.
11. As a player sent to **setup** after load failure, I want the broken in-progress **match** cleared, so that I am not prompted to resume an unplayable game.

### Mobile / backgrounding

12. As a mobile player who backgrounded the tab, I want NN recovery to attempt WebGL re-init then CPU backend, so that a dead GPU context can often be repaired without a full page reload.
13. As a mobile player, I want CPU backend use to be invisible in the UI, so that I am not bombarded with technical detail during repair.
14. As a player who returns after a long absence, I want illegal model output after a successful load to trigger the same recovery path as load failures, so that corrupt tensor state is not treated as a valid NN move.

### Headless completion

15. As a player who was **eliminated**, I want remaining **opponent** turns to use the same NN recovery rules during **finishing match** / headless completion, so that behavior is consistent.
16. As a player, when headless completion hits infer exhaustion, I want the refresh guidance when I am back on the page, so that I can recover a saved **match**.
17. As a player, when headless completion hits load exhaustion, I want the same **setup** redirect with preserved **setup**, so that terminal outcomes are consistent with live play.

### Prefetch and scheduling

18. As a player, I want NN prefetch disabled while a model is recovering, so that stale or overlapping inference does not undermine repair.
19. As a player, I want AI turn scheduling to respect recovery blocking for the active **neural opponent** seat, so that turns do not fire with fallback actions.

### Removed behaviors

20. As a player, I do not want mid-match automatic downgrade to another model catalog entry, so that model changes happen only through conscious **setup** choices.
21. As a player, I do not want cooldown-based Randombot substitution after NN failures, so that failure handling is explicit rather than disguised.
22. As a maintainer, I want `nnSeatMetadata` (or successor fields) to record backend and failure phase for debugging, so that support can diagnose WebGL vs CPU vs terminal failure.

### Temporary exception (unchanged)

23. As a maintainer, I want the env-gated **pick-adventurer** Randombot bypass to remain until the policy network is retrained, so that bad adventurer-pick behavior does not ship to production NN paths.
24. As a maintainer, I accept no new user-facing copy for that bypass in this work (CONTEXT / code comments only).

### Resume

25. As a player resuming a saved **match** after reload, I want the same model load gate as **match** start, so that a resumed **match** does not continue with unloaded models.

## Implementation Decisions

### Modules (build or modify)

| Module | Role |
|--------|------|
| **Neural runtime recovery coordinator** (new deep module; replaces cooldown-only recovery) | Per-`modelId` state: load vs infer attempt counters, recovering flag, backend escalation phase (WebGL attempts 1–2, CPU attempt 3+). Exposes: `beginRecovery`, `recordLoadFailure`, `recordInferFailure`, `recordSuccess`, `isRecovering`, `shouldBlockTurn`, terminal outcome (`NONE` / `REFRESH` / `SETUP`). |
| **Neural inference runtime** (modify) | Remove `createFallbackAction` and all fallback returns from the public choose/infer API. Return typed outcomes: success with legal action + metadata, or failure kind (`LOAD`, `INFER`, `ILLEGAL_OUTPUT`). Add `resetRuntimeForModel(modelId)` disposing cache, abandoning scheduled inference queue, optional TF backend reset / CPU force. Rename away from "WithFallback" in public API. |
| **Live play action chooser** (modify) | For `nn` seats: if model recovering → block (return pending / await recovery pipeline). On failure → drive recovery coordinator; never call Randombot except **pick-adventurer** bypass when env flag off. Remove null-action Randombot guard for NN. Randombot seats unchanged. |
| **Match neural load gate** (new) | Before first turn and on resume-from-storage: preload all **setup** NN `modelId`s; one failed load → terminal **setup** (no multi-strike at gate). Shares reset/load logic with recovery coordinator. |
| **AI turn prefetch gate** (modify) | Do not start or consume prefetch for a `modelId` while `isRecovering(modelId)`. Cancel in-flight prefetch when recovery starts. |
| **Play page integration** (modify) | Inline seat recovery UI; terminal dialogs (refresh vs setup); hard-fail handler clears persisted **match**, restores **setup** snapshot; remove legacy failure dialogs (manual retry, downgrade, "safe fallback"). Wire headless completion through same chooser/recovery. |
| **AI interface contract** (modify glossary contract) | Replace PASS-fallback rules with recovery + terminal error semantics. Document pick-adventurer bypass as sole intentional non-NN path for neural seats. |

Deep modules to test in isolation: **neural runtime recovery coordinator**, **neural inference runtime** (reset + typed failures), **match neural load gate**, **live play action chooser** (blocking + bypass rules).

### Failure taxonomy

Recoverable failures triggering re-init (same pipeline):

- Model load throws / timeout
- Inference throws
- Model runs but decoded action is not legal (`ILLEGAL_OUTPUT`)

Not failures:

- Exactly one legal action (return immediately)
- Empty legal set (existing null handling)

### Retry policy (split counters)

| Path | Mid-match attempts | Escalation | Terminal |
|------|-------------------|------------|----------|
| **Load** | N = 3 | Attempts 1–2: WebGL re-init; attempt 3+: force CPU backend | **Setup** (clear **match**, preserve **setup**) |
| **Infer** | M = 3 | Same re-init pattern after each failure with model already loaded | **Refresh page** (**match** stays in storage) |
| **Match start / resume gate** | 1 load attempt per selected `modelId` | No multi-strike | **Setup** immediately |

Recovery state keyed per **`modelId`**, not per seat (shared cache).

### Blocking scope

Only the active **neural opponent** seat's turn is blocked during recovery. Human turns and **Randombot** seats continue when it is their clock.

### Headless completion

Same recovery and terminal rules as live play. No Randombot substitution in headless. Surface terminal UX when user returns to page if failure occurred during headless run.

### Removed

- `createFallbackAction` on failure paths
- Cooldown → Randombot for NN
- Mid-match model downgrade prompts
- Legacy `handleNnModelFailure` retry/downgrade/fallback flow

### Retained (temporary)

- **Pick-adventurer** env bypass to Randombot for neural seats when flag off (production default). No new user-facing documentation in this PR.

### Open decision (implement as recommended)

- **Resume on mount:** run the same 1-attempt load gate as **match** start before continuing a persisted **match** (recommended yes).

## Testing Decisions

Good tests assert **external behavior**: chooser never returns Randombot for NN except pick-adventurer bypass; recovery attempts increment; terminal states after N/M; load gate prevents match entry; infer exhaustion does not clear **match**; load exhaustion clears **match** but preserves **setup**; prefetch skipped while recovering.

| Module | Test focus | Prior art |
|--------|------------|-----------|
| Neural runtime recovery coordinator | Counter split, per-modelId isolation, terminal transitions, CPU escalation trigger on attempt 3 | `nn/recovery.test.js` (replace cooldown tests) |
| Neural inference runtime | No fallback metadata on failure; reset clears cache; typed failure kinds | `nn/runtime.test.js` (rewrite fallback tests) |
| Live play action chooser | Block during recovery; no Randombot on NN failure; pick-adventurer bypass preserved | `headlessMatchCompletionRunner.test.js`, `livePlayActionChooserParity.test.js` |
| Match neural load gate | Start/resume blocked on load fail | `setup/state.test.js`, persistence tests |
| Prefetch gate | No prefetch during recovery | `dungeonRunnerAiTurnPrefetch.test.js` |

Avoid asserting user-visible copy strings in unit tests (project rule). Use `data-testid` or state flags for blocking UI where integration tests are added.

## Out of Scope

- Retraining the policy network or fixing pick-adventurer NN quality (bypass stays until separate training work).
- User-facing help text for the pick-adventurer bypass.
- Mid-match model catalog downgrade UI.
- Changing **Randombot** weighting or behavior for seats explicitly set to Randombot.
- Server-side model hosting or catalog changes.
- Analytics schema changes beyond existing `nnSeatMetadata` / action meta fields.

## Further Notes

- Current fallback `createFallbackAction` picks uniformly among legal actions; with revealed bidding this heavily favors **sacrifice** — likely explains reported "equipment dumping after backgrounding" bug.
- Refresh fixes today because it clears in-memory `modelCache`, inference queue, and cooldown state while **match** can resume from `localStorage`.
- Update **AI Interface Contract** in CONTRACT.md to remove PASS-fallback language in favor of recovery semantics.
- CPU backend is a repair step only; same weights, not a different **opponent** type.
