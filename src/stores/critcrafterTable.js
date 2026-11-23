import { acceptHMRUpdate, defineStore } from 'pinia'
import { markRaw } from 'vue'
import * as T from '../features/critcrafter/table/tableState.js'
import { defaultTableStorage } from '../features/critcrafter/table/tableStorage.js'

/**
 * CritCrafter table state for the open character: deltas over the sheet, persisted per Pathbuilder
 * id by `tableStorage` (localStorage, memory fallback). Rules live in `tableState.js`; this store
 * only holds the state and persists after every change. Mutators that move equipment return the
 * notes (e.g. "Put away sword") the screen can toast.
 */
export const useCritcrafterTableStore = defineStore('critcrafterTable', {
  state: () => ({
    id: /** @type {string | null} */ (null),
    sheet: /** @type {any} */ (null),
    table: /** @type {import('../features/critcrafter/table/tableState.js').TableState | null} */ (null),
  }),

  getters: {
    hp: (s) => s.table?.hp ?? 0,
    maxHp: (s) => (s.sheet ? T.maxHp(s.sheet) : 0),
    tempHp: (s) => s.table?.tempHp ?? 0,
    /** Live AC as a stat `{ value, breakdown }` (current state only). */
    ac: (s) => (s.sheet && s.table ? T.liveAc(s.sheet, s.table) : null),
    /** Shield row data, or null when no shield is equipped. */
    shield: (s) => (s.sheet && s.table ? T.shieldView(s.sheet, s.table) : null),
    handsUsed: (s) => (s.sheet && s.table ? T.handsUsed(s.sheet, s.table) : 0),
  },

  actions: {
    /** Load (or switch to) a character: stored deltas are clamped to this sheet. */
    open(id, sheet, storage = defaultTableStorage()) {
      this.id = String(id)
      this.sheet = markRaw(sheet)
      this.table = T.resolveState(sheet, storage.load(this.id))
      this._storage = markRaw(storage)
    },

    /** Clear this character's tracking (the caller confirms first). */
    resetTracking() {
      if (!this.sheet) return
      this._storage.clear(this.id)
      this.table = T.initialState(this.sheet)
    },

    /** Apply `{ state, notes }` from a rule and persist when it changed. */
    _commit(outcome) {
      const state = outcome && outcome.state ? outcome.state : outcome
      if (JSON.stringify(state) !== JSON.stringify(this.table)) {
        this.table = state
        this._storage.save(this.id, T.toStored(this.sheet, state))
      }
      return outcome?.notes ?? []
    },

    applyHp(mode, amount) {
      return this._commit(T.applyHp(this.sheet, this.table, mode, amount))
    },
    rest(kind) {
      return this._commit(T.rest(this.sheet, this.table, kind))
    },
    cycleSlot(key) {
      return this._commit(T.cycleSlot(this.sheet, this.table, key))
    },
    cycleFocus() {
      return this._commit(T.cycleFocus(this.sheet, this.table))
    },
    cycleConsumable(key) {
      return this._commit(T.cycleConsumable(this.sheet, this.table, key))
    },
    toggleArmor(key) {
      return this._commit(T.toggleArmor(this.sheet, this.table, key))
    },
    toggleWeapon(key) {
      return this._commit(T.toggleWeapon(this.sheet, this.table, key))
    },
    toggleGrip(key) {
      return this._commit(T.toggleGrip(this.sheet, this.table, key))
    },
    toggleShield(key) {
      return this._commit(T.toggleShield(this.sheet, this.table, key))
    },
    setShieldRaised(raised) {
      return this._commit(T.setShieldRaised(this.sheet, this.table, raised))
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useCritcrafterTableStore, import.meta.hot))
}
