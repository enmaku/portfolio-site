<template>
  <div data-testid="gm-surface-sessions" class="gm-surface">
    <div class="gm-surface__scroll q-pa-md">
      <div
        v-if="!sessions.length"
        class="gm-empty column items-center q-mx-auto q-py-xl text-center text-grey-5"
        data-testid="gm-sessions-empty"
      >
        <p class="q-mb-sm text-body1">No play sessions yet.</p>
        <p class="q-mb-none text-body2">Tap + to start recording a sitting.</p>
      </div>

      <div v-else data-testid="gm-sessions-list">
        <q-slide-item
          v-for="session in sessions"
          :key="session.id"
          class="gm-slide rounded-borders overflow-hidden"
          left-color="primary"
          right-color="negative"
          :data-testid="`gm-sessions-row-${session.id}`"
          @left="(e) => openSessionSlide(e, session)"
          @right="(e) => requestDelete(e, session)"
        >
          <template #left>
            <div class="row items-center full-height q-px-md" aria-hidden="true">
              <q-icon name="edit" size="md" />
            </div>
          </template>
          <template #right>
            <div class="row items-center full-height q-px-md" aria-hidden="true">
              <q-icon name="delete" size="md" />
            </div>
          </template>

          <q-item clickable v-ripple class="gm-session-row" @click="openSession(session.id)">
            <q-item-section avatar>
              <div class="gm-row-thumb flex flex-center">
                <q-img
                  v-if="thumbForSession(session)"
                  :src="thumbForSession(session)"
                  width="40px"
                  height="56px"
                  fit="cover"
                  spinner-color="primary"
                  loading="lazy"
                />
                <q-icon v-else name="casino" size="md" color="grey-5" />
              </div>
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ session.game?.title || session.id }}</q-item-label>
              <q-item-label caption>{{ session.state }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-slide-item>
      </div>
    </div>

    <div class="gm-actions-bar row items-center justify-end q-px-md q-pt-sm">
      <q-btn
        fab
        color="primary"
        icon="add"
        aria-label="Start session"
        class="gm-actions-bar__fixed-btn"
        data-testid="gm-sessions-add-fab"
        @click="openCreate"
      />
    </div>

    <q-dialog :model-value="createOpen && !catalogSearchOpen" @update:model-value="onCreateDialogToggle">
      <q-card class="gm-dialog-card gm-dialog-card--wide">
        <q-card-section class="text-h6">Start session</q-card-section>
        <q-card-section class="q-gutter-md q-pt-none">
          <q-select
            v-model="selectedGameId"
            dense
            outlined
            emit-value
            map-options
            clearable
            label="Game from shelf"
            :options="gameOptions"
            data-testid="gm-sessions-game-select"
          />

          <q-btn
            outline
            color="primary"
            class="full-width"
            label="Search catalog / custom title"
            icon="search"
            data-testid="gm-sessions-open-search"
            @click="catalogSearchOpen = true"
          />

          <div
            v-if="pickedCatalogGame || customGameTitle"
            class="text-body2"
            data-testid="gm-sessions-picked-game"
          >
            Selected:
            {{ pickedCatalogGame?.title || customGameTitle }}
          </div>

          <q-select
            v-model="selectedPeopleIds"
            dense
            outlined
            multiple
            emit-value
            map-options
            use-chips
            label="Present players"
            :options="peopleOptions"
            data-testid="gm-sessions-people-select"
          />

          <q-checkbox
            v-model="addToCollection"
            dense
            label="Add to collection"
            data-testid="gm-sessions-add-to-collection"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" v-close-popup />
          <q-btn
            unelevated
            label="Start"
            color="primary"
            data-testid="gm-sessions-create-btn"
            :disable="!canCreate"
            @click="onCreate"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <GameManagerCatalogSearchPanel
      v-if="catalogSearchOpen"
      title="Find a game"
      test-id="gm-sessions-search-panel"
      close-test-id="gm-sessions-search-close"
      @select="onCatalogPick"
      @close="catalogSearchOpen = false"
    />

    <q-dialog v-model="detailOpen">
      <q-card v-if="activeSession" class="gm-dialog-card gm-dialog-card--wide" data-testid="gm-sessions-active">
        <q-card-section class="text-h6">
          {{ activeSession.game?.title || 'Session' }}
        </q-card-section>
        <q-card-section class="q-pt-none column q-gutter-sm">
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
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" color="grey" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="deleteConfirmOpen" persistent>
      <q-card class="gm-dialog-card gm-dialog-card--narrow">
        <q-card-section class="text-h6">Delete session?</q-card-section>
        <q-card-section class="q-pt-none text-body2">
          Delete <strong>{{ deleteTarget?.game?.title || 'this session' }}</strong>? This cannot be undone.
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="cancelDelete" />
          <q-btn
            unelevated
            label="Delete"
            color="negative"
            data-testid="gm-sessions-delete-confirm"
            @click="confirmDelete"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { collectionItemThumbUrl } from '../collection/collectionViewModel.js'
import { createCustomCollectionEntry } from '../domain/collection.js'
import { useGameManagerSessions } from '../composables/useGameManagerSessions.js'
import { SCORE_ENTRY_MODES } from '../sessions/sessionsViewModel.js'
import GameManagerCatalogSearchPanel from './GameManagerCatalogSearchPanel.vue'

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

const createOpen = ref(false)
const catalogSearchOpen = ref(false)
const detailOpen = ref(false)
const selectedGameId = ref(null)
const customGameTitle = ref('')
const pickedCatalogGame = ref(null)
const selectedPeopleIds = ref([])
const addToCollection = ref(true)
const scoreMode = ref(SCORE_ENTRY_MODES.PER_PLAYER)
const perPlayerScores = reactive({})
const outcomes = reactive({})
const sharedScore = ref(0)
const deleteConfirmOpen = ref(false)
const deleteTarget = ref(null)

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

const canCreate = computed(
  () => Boolean(selectedGameId.value || pickedCatalogGame.value || customGameTitle.value.trim()),
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

watch(detailOpen, (open) => {
  if (!open) selectSession(null)
})

function thumbForSession(session) {
  const game = session?.game
  if (!game) return null
  const fromShelf = collectionItems.value.find(
    (i) =>
      i.id === game.id ||
      (i.kind === 'catalog' && i.catalogEntryId && i.catalogEntryId === game.catalogEntryId),
  )
  return collectionItemThumbUrl(fromShelf || game)
}

function openCreate() {
  selectedGameId.value = null
  customGameTitle.value = ''
  pickedCatalogGame.value = null
  selectedPeopleIds.value = []
  addToCollection.value = true
  catalogSearchOpen.value = false
  createOpen.value = true
}

/** @param {boolean} open */
function onCreateDialogToggle(open) {
  if (!open && !catalogSearchOpen.value) {
    createOpen.value = false
  }
}

/**
 * @param {{ source: string, catalogEntryId?: string, title: string, yearPublished?: number | null, thumbnailUrl?: string | null }} pick
 */
function onCatalogPick(pick) {
  selectedGameId.value = null
  if (pick.source === 'custom') {
    pickedCatalogGame.value = null
    customGameTitle.value = pick.title
    catalogSearchOpen.value = false
    return
  }
  customGameTitle.value = ''
  pickedCatalogGame.value = {
    kind: 'catalog',
    id: `catalog:${pick.catalogEntryId}`,
    catalogEntryId: pick.catalogEntryId,
    title: pick.title,
    yearPublished: pick.yearPublished ?? null,
    thumbnailUrl: pick.thumbnailUrl || null,
  }
  catalogSearchOpen.value = false
}

async function openSession(sessionId) {
  await selectSession(sessionId)
  detailOpen.value = true
}

function openSessionSlide(detail, session) {
  detail.reset()
  void openSession(session.id)
}

function requestDelete(detail, session) {
  detail.reset()
  deleteTarget.value = session
  deleteConfirmOpen.value = true
}

function cancelDelete() {
  deleteConfirmOpen.value = false
  deleteTarget.value = null
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  await removeSession(deleteTarget.value.id)
  cancelDelete()
}

async function onCreate() {
  let game = collectionItems.value.find((i) => i.id === selectedGameId.value) || null
  if (!game && pickedCatalogGame.value) game = pickedCatalogGame.value
  if (!game && customGameTitle.value.trim()) {
    game = createCustomCollectionEntry({ title: customGameTitle.value.trim() })
  }
  if (!game) return
  const session = await createSession({
    game,
    presentPlayerIds: selectedPeopleIds.value,
    addToCollection: addToCollection.value,
  })
  createOpen.value = false
  if (session?.id) {
    await selectSession(session.id)
    detailOpen.value = true
  }
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
.gm-session-row {
  background: rgba(255, 255, 255, 0.04);
  min-height: 72px;
}

.body--light .gm-session-row {
  background: rgba(0, 0, 0, 0.03);
}
</style>
