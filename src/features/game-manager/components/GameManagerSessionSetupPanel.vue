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

      <q-list v-if="rosterRows.length" bordered separator class="rounded-borders q-mb-md">
        <q-item
          v-for="row in rosterRows"
          :key="row.id"
          tag="label"
          :data-testid="`gm-session-setup-person-${row.id}`"
        >
          <q-item-section avatar>
            <q-checkbox
              :model-value="selectedIds.includes(row.id)"
              dense
              :data-testid="`gm-session-setup-check-${row.id}`"
              @update:model-value="(v) => togglePerson(row, v)"
            />
          </q-item-section>
          <q-item-section avatar>
            <div class="gm-person-swatch" :style="{ background: row.color }" />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ row.name }}</q-item-label>
            <q-item-label v-if="row.guest" caption>Guest</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>

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
        :disable="!canStart || busy"
        :loading="busy"
        @click="$emit('start-game')"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  session: { type: Object, default: null },
  savedPeople: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
  suggestionsForName: { type: Function, required: true },
  peekNextColor: { type: Function, required: true },
  upsertPerson: { type: Function, required: true },
  setAttendance: { type: Function, required: true },
  addAttendance: { type: Function, required: true },
})

defineEmits(['close', 'start-game'])

const draftName = ref('')
const persistToRoster = ref(true)
const adding = ref(false)

const selectedIds = computed(() =>
  (props.session?.presentPlayers || []).map((p) => p.recordedPlayerId).filter(Boolean),
)

const canStart = computed(() => selectedIds.value.length >= 1)

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
  return [...byId.values()]
})

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
    const source = saved || existing
    if (!source) continue
    seats.push({
      recordedPlayerId: id,
      name: source.name,
      color: source.color,
    })
  }
  await props.setAttendance(seats)
}

async function togglePerson(row, checked) {
  const next = new Set(selectedIds.value)
  if (checked) next.add(row.id)
  else next.delete(row.id)
  await writeSelection([...next])
}

async function addExisting(match) {
  await props.addAttendance({
    recordedPlayerId: match.id,
    name: match.name,
    color: match.color,
  })
  draftName.value = ''
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
      await props.addAttendance({
        recordedPlayerId: person.id,
        name: person.name,
        color: person.color,
      })
    }
    draftName.value = ''
  } finally {
    adding.value = false
  }
}
</script>

<style scoped>
.gm-person-swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}
</style>
