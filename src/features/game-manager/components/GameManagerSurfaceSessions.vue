<template>
  <div data-testid="gm-surface-sessions" class="gm-surface column q-pa-md q-gutter-md">
    <div class="row q-gutter-sm items-center">
      <q-select
        v-model="selectedGameId"
        dense
        outlined
        emit-value
        map-options
        clearable
        class="col"
        :options="gameOptions"
        data-testid="gm-sessions-game-select"
      />
      <q-checkbox
        v-model="addToCollection"
        dense
        data-testid="gm-sessions-add-to-collection"
      />
    </div>

    <q-input
      v-model="customGameTitle"
      dense
      outlined
      data-testid="gm-sessions-custom-game"
    />

    <q-select
      v-model="selectedPeopleIds"
      dense
      outlined
      multiple
      emit-value
      map-options
      use-chips
      :options="peopleOptions"
      data-testid="gm-sessions-people-select"
    />

    <q-btn
      color="primary"
      unelevated
      dense
      class="full-width"
      data-testid="gm-sessions-create-btn"
      :disable="!selectedGameId && !customGameTitle.trim()"
      @click="onCreate"
    >
      Start session
    </q-btn>

    <q-list bordered separator data-testid="gm-sessions-list">
      <q-item
        v-for="session in sessions"
        :key="session.id"
        clickable
        v-ripple
        :data-testid="`gm-sessions-row-${session.id}`"
        @click="selectSession(session.id)"
      >
        <q-item-section>
          <q-item-label>{{ session.game?.title || session.id }}</q-item-label>
          <q-item-label caption>{{ session.state }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn
            flat
            dense
            round
            icon="delete"
            color="negative"
            :data-testid="`gm-sessions-delete-${session.id}`"
            @click.stop="removeSession(session.id)"
          />
        </q-item-section>
      </q-item>
    </q-list>

    <div v-if="activeSession" class="column q-gutter-sm" data-testid="gm-sessions-active">
      <div class="text-subtitle2" data-testid="gm-sessions-active-state">
        {{ activeSession.state }}
      </div>

      <div class="row q-gutter-xs">
        <q-btn
          v-if="activeSession.state === 'setup'"
          dense
          outline
          data-testid="gm-sessions-to-playing"
          @click="transition('playing')"
        >
          Playing
        </q-btn>
        <q-btn
          v-if="activeSession.state === 'setup' || activeSession.state === 'playing'"
          dense
          outline
          data-testid="gm-sessions-to-scoring"
          @click="transition('scoring')"
        >
          Scoring
        </q-btn>
        <q-btn
          v-if="activeSession.state === 'complete'"
          dense
          outline
          data-testid="gm-sessions-reopen-scoring"
          @click="transition('scoring')"
        >
          Edit scores
        </q-btn>
      </div>

      <template v-if="activeSession.state === 'scoring' || activeSession.state === 'complete'">
        <q-btn-toggle
          v-model="scoreMode"
          dense
          toggle-color="primary"
          :options="modeOptions"
          data-testid="gm-sessions-score-mode"
        />

        <div
          v-for="seat in activeSession.presentPlayers"
          :key="seat.recordedPlayerId || seat.name"
          class="row items-center q-gutter-sm"
        >
          <div class="col">{{ seat.name }}</div>
          <q-input
            v-if="scoreMode === 'per_player'"
            dense
            outlined
            type="number"
            class="col-4"
            :model-value="perPlayerScores[seat.recordedPlayerId]"
            :data-testid="`gm-sessions-score-${seat.recordedPlayerId}`"
            @update:model-value="(v) => (perPlayerScores[seat.recordedPlayerId] = Number(v))"
          />
          <q-select
            v-else-if="scoreMode === 'outcome_marks'"
            dense
            outlined
            emit-value
            map-options
            class="col-5"
            :options="outcomeOptions"
            :model-value="outcomes[seat.recordedPlayerId]"
            :data-testid="`gm-sessions-outcome-${seat.recordedPlayerId}`"
            @update:model-value="(v) => (outcomes[seat.recordedPlayerId] = v)"
          />
          <q-btn
            flat
            dense
            round
            icon="person_off"
            :data-testid="`gm-sessions-dropout-${seat.recordedPlayerId}`"
            @click="dropPlayer(seat.recordedPlayerId)"
          />
        </div>

        <q-input
          v-if="scoreMode === 'shared'"
          dense
          outlined
          type="number"
          data-testid="gm-sessions-shared-score"
          v-model.number="sharedScore"
        />

        <q-btn
          color="primary"
          unelevated
          dense
          data-testid="gm-sessions-save-score"
          @click="onSaveScore"
        >
          Save score
        </q-btn>
        <q-btn
          v-if="activeSession.state === 'scoring'"
          color="secondary"
          unelevated
          dense
          data-testid="gm-sessions-complete"
          @click="transition('complete')"
        >
          Complete
        </q-btn>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { createCustomCollectionEntry } from '../domain/collection.js'
import { SCORE_ENTRY_MODES } from '../sessions/sessionsViewModel.js'
import { useGameManagerSessions } from '../composables/useGameManagerSessions.js'

const {
  sessions,
  people,
  collectionItems,
  activeSession,
  createSession,
  selectSession,
  transition,
  saveScore,
  dropPlayer,
  removeSession,
} = useGameManagerSessions()

const selectedGameId = ref(null)
const customGameTitle = ref('')
const selectedPeopleIds = ref([])
const addToCollection = ref(true)
const scoreMode = ref(SCORE_ENTRY_MODES.PER_PLAYER)
const perPlayerScores = reactive({})
const outcomes = reactive({})
const sharedScore = ref(0)

const gameOptions = computed(() =>
  collectionItems.value.map((item) => ({
    label: item.title,
    value: item.id,
  })),
)

const peopleOptions = computed(() =>
  people.value.map((p) => ({
    label: p.name,
    value: p.id,
  })),
)

const modeOptions = [
  { label: 'Per-player', value: SCORE_ENTRY_MODES.PER_PLAYER },
  { label: 'Shared', value: SCORE_ENTRY_MODES.SHARED },
  { label: 'Outcomes', value: SCORE_ENTRY_MODES.OUTCOME_MARKS },
]

const outcomeOptions = [
  { label: 'Win', value: 'win' },
  { label: 'Loss', value: 'loss' },
  { label: 'Draw', value: 'draw' },
]

watch(
  activeSession,
  (session) => {
    if (!session?.score) return
    scoreMode.value = session.score.mode || SCORE_ENTRY_MODES.PER_PLAYER
    Object.assign(perPlayerScores, session.score.perPlayer || {})
    Object.assign(outcomes, session.score.outcomes || {})
    sharedScore.value = session.score.shared ?? 0
  },
  { immediate: true },
)

async function onCreate() {
  let game = collectionItems.value.find((i) => i.id === selectedGameId.value) || null
  if (!game && customGameTitle.value.trim()) {
    game = createCustomCollectionEntry({ title: customGameTitle.value.trim() })
  }
  if (!game) return
  await createSession({
    game,
    presentPlayerIds: selectedPeopleIds.value,
    addToCollection: addToCollection.value,
  })
  customGameTitle.value = ''
}

async function onSaveScore() {
  /** @type {object} */
  let score = { mode: scoreMode.value }
  if (scoreMode.value === SCORE_ENTRY_MODES.PER_PLAYER) {
    score = { mode: scoreMode.value, perPlayer: { ...perPlayerScores } }
  } else if (scoreMode.value === SCORE_ENTRY_MODES.SHARED) {
    score = { mode: scoreMode.value, shared: Number(sharedScore.value) }
  } else {
    score = { mode: scoreMode.value, outcomes: { ...outcomes } }
  }
  await saveScore(score)
}
</script>

<style scoped>
.gm-surface {
  min-height: 100%;
}
</style>
