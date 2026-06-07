# Dungeon Runner: Omnipotence as alternate win on initial pile uniqueness

**Status:** Accepted

**Omnipotence** (`M_OMNI`) is a passive second way to win a **dungeon run** after combat would defeat the runner—not a healing effect and not a player choice. When HP would drop to 0 or below, a healing potion (if in play) revives and the run continues first; otherwise, if **M_OMNI** is still in play and every **species** in the **omnipotence set** is distinct, the run succeeds immediately with normal success scoring and **omnipotence success copy** in the **dungeon run** outcome acknowledgment. If uniqueness fails, the run fails with ordinary failure copy (no “almost saved” hint).

## Omnipotence set

The set is the **monster** pile frozen when the **dungeon run** begins: every card **placed** into the dungeon during bidding, before any lane card is revealed. It does **not** include cards discarded via bidding **equipment** sacrifice (they never entered the pile) or cards never drawn from the **monster deck**. Lane play during the run—defeats, Fire Axe, Vorpal, Polymorph, passives, and so on—does not remove cards from this set; uniqueness is evaluated against the initial pile composition, not against defeated/current/unrevealed lane state at the moment of defeat.

Uniqueness is at **species** level. Duplicate **species** in the initial pile (e.g. strengths 1, 1, 3, 4) fail; all distinct **species** (e.g. 1, 3, 4) pass, even if some of those cards were already removed from the lane earlier in the run.

## Eligibility gate

**Omnipotence** is gated by **M_OMNI** in play at defeat, not by **adventurer** identity. Only the Mage loadout includes **M_OMNI** today, but future loadouts may attach it to other **adventurers** without changing this rule.

## Considered options

- **Live lane partition at defeat** (defeated + current + unrevealed)—rejected: diverges from “pile as it existed at run start” and is harder for players to reason about when **equipment** has removed cards from the lane.
- **Include bidding sacrifice discards** (`discardedMonsterCards`)—rejected: those cards were never placed in the dungeon; counting them caused false Omnipotence failures when the visible lane looked species-unique.
- **Gate on Mage **adventurer** only**—rejected: **equipment**-in-play is the stable rule if loadouts change.
- **Omnipotence as revive** (reset HP and continue)—rejected: contradicts alternate-win semantics; healing potions already own continue-the-run behavior.

## Consequences

- Engine `omniSavesDungeon` (or successor) must read the initial pile snapshot (e.g. bidding `dungeonMonsters` at **dungeon run** entry), not union lane state with sacrifice discards.
- Successful Omnipotence wins need structured outcome metadata so the outcome acknowledgment can show **omnipotence success copy** without inferring from replay state.
- **Game data catalog** equipment `details` for **M_OMNI** should describe the initial-pile / **species**-uniqueness rule, aligned with [`CONTEXT.md`](../src/features/dungeon-runner/CONTEXT.md).
