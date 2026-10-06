<template>
  <q-card class="column no-wrap full-width gm-flow-panel" data-testid="gm-session-setup">
    <q-card-section class="row items-center no-wrap q-pb-sm gm-flow-panel__header">
      <div class="text-h6 col ellipsis">{{ session?.game?.title || 'Who is playing?' }}</div>
      <q-btn
        flat
        dense
        round
        icon="close"
        aria-label="Close"
        data-testid="gm-session-setup-close"
        @click="$emit('close')"
      />
    </q-card-section>

    <q-card-section class="col q-pt-none gm-flow-panel__scroll">
      <div class="text-body2 text-grey-6 q-mb-md">Select who is at the table.</div>

      <div v-if="rosterRows.length" class="gm-setup-roster q-mb-md">
        <q-item
          v-for="row in rosterRows"
          :key="row.id"
          v-ripple
          tag="label"
          class="gm-setup-person"
          :style="personRowStyle(row)"
          :data-testid="`gm-session-setup-person-${row.id}`"
        >
          <q-item-section avatar>
            <q-checkbox
              :model-value="selectedIdSet.has(row.id)"
              color="white"
              keep-color
              size="lg"
              :data-testid="`gm-session-setup-check-${row.id}`"
              @update:model-value="(checked) => togglePerson(row, checked)"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label class="gm-setup-person__name ellipsis">{{ row.name }}</q-item-label>
            <q-item-label v-if="row.guest" caption class="gm-setup-person__guest">Guest</q-item-label>
          </q-item-section>
        </q-item>
      </div>

      <div v-else class="text-body2 text-grey-6 q-mb-md" data-testid="gm-session-setup-empty-roster">
        No saved players yet. Add someone below.
      </div>

      <div class="text-subtitle2 q-mb-sm">Add person</div>
      <q-input
        v-model="draftName"
        dense
        outlined
        label="Name"
        class="q-mb-sm"
        data-testid="gm-session-setup-add-name"
      />
      <q-checkbox
        v-model="persistToRoster"
        dense
        label="Save to People roster"
        class="q-mb-sm"
        data-testid="gm-session-setup-persist"
      />

      <div
        v-if="matchSuggestions.length"
        class="column q-gutter-xs q-mb-sm"
        data-testid="gm-session-setup-matches"
      >
        <div class="text-caption text-grey-6">Existing match</div>
        <q-btn
          v-for="match in matchSuggestions"
          :key="match.id"
          outline
          dense
          color="primary"
          :label="`Use ${match.name}`"
          :data-testid="`gm-session-setup-match-${match.id}`"
          @click="addExisting(match)"
        />
      </div>

      <q-btn
        outline
        color="primary"
        class="full-width"
        label="Add"
        data-testid="gm-session-setup-add-btn"
        :disable="!draftName.trim() || adding"
        :loading="adding"
        @click="addNew"
      />
    </q-card-section>

    <q-card-actions class="gm-flow-panel__actions q-pa-md">
      <q-btn
        class="full-width"
        unelevated
        color="primary"
        label="Start game"
        data-testid="gm-session-setup-start-game"
        :disable="!canStart || busy || starting"
        :loading="busy || starting"
        @click="onStart"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { createLatestAttendanceWrite } from '../sessions/latestAttendanceWrite.js'

const props = defineProps({
  session: { type: Object, default: null },
  savedPeople: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
  suggestionsForName: { type: Function, required: true },
  peekNextColor: { type: Function, required: true },
  upsertPerson: { type: Function, required: true },
  setAttendance: { type: Function, required: true },
})

const emit = defineEmits(['close', 'start-game'])

const draftName = ref('')
const persistToRoster = ref(true)
const adding = ref(false)
const starting = ref(false)
const selectedIds = ref([])
/** @type {import('vue').Ref<Map<string, { id: string, name: string, color: string, saved?: boolean }>>} */
const seatSources = ref(new Map())

function idsFromSession(session) {
  return (session?.presentPlayers || []).map((player) => player.recordedPlayerId).filter(Boolean)
}

function sameIds(left, right) {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((id) => rightSet.has(id))
}

const attendance = createLatestAttendanceWrite((ids) => writeSelection(ids))

const selectedIdSet = computed(() => new Set(selectedIds.value))

const canStart = computed(() => selectedIds.value.length >= 1)

watch(
  () => [props.session?.id, props.session?.presentPlayers],
  () => {
    if (attendance.pending) return
    selectedIds.value = idsFromSession(props.session)
  },
  { immediate: true },
)

const rosterRows = computed(() => {
  const byId = new Map()
  for (const p of props.savedPeople || []) {
    byId.set(p.id, { id: p.id, name: p.name, color: p.color, guest: false })
  }
  for (const seat of props.session?.presentPlayers || []) {
    if (!seat.recordedPlayerId) continue
    if (!byId.has(seat.recordedPlayerId)) {
      byId.set(seat.recordedPlayerId, {
        id: seat.recordedPlayerId,
        name: seat.name,
        color: seat.color,
        guest: true,
      })
    }
  }
  for (const person of seatSources.value.values()) {
    if (!byId.has(person.id)) {
      byId.set(person.id, {
        id: person.id,
        name: person.name,
        color: person.color,
        guest: person.saved === false,
      })
    }
  }
  return [...byId.values()]
})

function personRowStyle(row) {
  const color = typeof row.color === 'string' && row.color ? row.color : '#78909c'
  return { backgroundColor: color }
}

function rememberPerson(person) {
  if (!person?.id) return
  const next = new Map(seatSources.value)
  next.set(person.id, person)
  seatSources.value = next
}

const matchSuggestions = computed(() => {
  const name = draftName.value.trim()
  if (!name) return []
  return props.suggestionsForName(name).slice(0, 5)
})

async function writeSelection(ids) {
  const seats = []
  for (const id of ids) {
    const saved = (props.savedPeople || []).find((p) => p.id === id)
    const existing = (props.session?.presentPlayers || []).find((p) => p.recordedPlayerId === id)
    const source = saved || existing || seatSources.value.get(id)
    if (!source) continue
    seats.push({
      recordedPlayerId: id,
      name: source.name,
      color: source.color,
    })
  }
  await props.setAttendance(seats)
}

function queueSelection(ids) {
  const snapshot = [...ids]
  return attendance.push(snapshot).catch(() => {
    if (!attendance.pending && sameIds(selectedIds.value, snapshot)) {
      selectedIds.value = idsFromSession(props.session)
    }
  })
}

function togglePerson(row, checked) {
  const next = new Set(selectedIds.value)
  if (checked) next.add(row.id)
  else next.delete(row.id)
  selectedIds.value = [...next]
  void queueSelection(selectedIds.value)
}

function addExisting(match) {
  rememberPerson(match)
  draftName.value = ''
  if (!selectedIds.value.includes(match.id)) {
    selectedIds.value = [...selectedIds.value, match.id]
  }
  void queueSelection(selectedIds.value)
}

async function addNew() {
  const name = draftName.value.trim()
  if (!name || adding.value) return
  adding.value = true
  try {
    const person = await props.upsertPerson({
      name,
      color: props.peekNextColor(),
      persistToRoster: persistToRoster.value,
    })
    if (person) {
      rememberPerson(person)
      if (!selectedIds.value.includes(person.id)) {
        selectedIds.value = [...selectedIds.value, person.id]
      }
      await queueSelection(selectedIds.value)
    }
    draftName.value = ''
  } finally {
    adding.value = false
  }
}

async function onStart() {
  if (starting.value || !canStart.value) return
  starting.value = true
  try {
    await attendance.flush()
    if (!canStart.value) return
    emit('start-game')
  } catch {
    if (!attendance.pending) {
      selectedIds.value = idsFromSession(props.session)
    }
  } finally {
    starting.value = false
  }
}
</script>

<style scoped>
.gm-setup-roster {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gm-setup-person {
  min-height: 72px;
  padding: 10px 14px;
  border-radius: 8px;
}

.gm-setup-person__name,
.gm-setup-person__guest {
  color: #fff;
  text-shadow:
    -1.5px 0 0 #000,
    1.5px 0 0 #000,
    0 -1.5px 0 #000,
    0 1.5px 0 #000;
}

.gm-setup-person__name {
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.25;
}

.gm-setup-person :deep(.q-checkbox__bg) {
  border-width: 2px;
  box-shadow:
    -1px 0 0 #000,
    1px 0 0 #000,
    0 -1px 0 #000,
    0 1px 0 #000;
}

.gm-setup-person :deep(.q-checkbox__svg) {
  color: #111;
}
</style>
