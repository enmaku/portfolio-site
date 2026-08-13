<template>
  <div data-testid="gm-surface-sessions" class="gm-surface">
    <div class="gm-surface__scroll q-pa-md">
      <div
        v-if="!sessions.length"
        class="gm-empty column items-center q-mx-auto q-py-xl text-center text-grey-5"
        data-testid="gm-sessions-empty"
      >
        <p class="q-mb-sm text-body1">No play sessions yet.</p>
        <p class="q-mb-none text-body2">Open a game from Collection to start a sitting.</p>
      </div>

      <div v-else data-testid="gm-sessions-list" class="column q-gutter-sm">
        <q-expansion-item
          v-for="group in gameGroups"
          :key="group.key"
          group="gm-sessions-games"
          class="gm-session-game rounded-borders overflow-hidden"
          expand-separator
          header-class="gm-session-game__header"
          :data-testid="`gm-sessions-game-${group.key}`"
        >
          <template #header>
            <q-item-section avatar>
              <div class="gm-row-thumb flex flex-center">
                <q-img
                  v-if="thumbForGame(group.game)"
                  :src="thumbForGame(group.game)"
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
              <q-item-label>{{ group.game?.title || group.key }}</q-item-label>
              <q-item-label caption>
                {{ group.sessions.length }}
                {{ group.sessions.length === 1 ? 'session' : 'sessions' }}
              </q-item-label>
            </q-item-section>
          </template>

          <div class="gm-session-game__body">
            <q-slide-item
              v-for="session in group.sessions"
              :key="session.id"
              class="gm-slide overflow-hidden"
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

              <q-item clickable v-ripple class="gm-session-row" @click="openSession(session)">
                <q-item-section>
                  <q-item-label>{{ formatSessionWhen(session) }}</q-item-label>
                  <q-item-label caption>{{ playerCountLabel(session) }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-badge outline :color="statusColor(session.state)" :label="session.state" />
                </q-item-section>
              </q-item>
            </q-slide-item>
          </div>
        </q-expansion-item>
      </div>
    </div>

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
import { computed, inject, ref } from 'vue'
import { collectionItemThumbUrl } from '../collection/collectionViewModel.js'
import { GAME_MANAGER_SESSION_FLOW_KEY } from '../composables/sessionFlowKey.js'
import { buildSessionGameGroups, sessionSortMs } from '../sessions/sessionsListViewModel.js'

const props = defineProps({
  sessionsApi: { type: Object, required: true },
})

const flow = inject(GAME_MANAGER_SESSION_FLOW_KEY)
if (!flow) {
  throw new Error('GameManagerSurfaceSessions requires session flow provide')
}

const sessions = computed(() => props.sessionsApi.sessions.value)
const collectionItems = computed(() => props.sessionsApi.collectionItems.value)
const gameGroups = computed(() => buildSessionGameGroups(sessions.value))

const deleteConfirmOpen = ref(false)
const deleteTarget = ref(null)

function thumbForGame(game) {
  if (!game) return null
  const fromShelf = collectionItems.value.find(
    (i) =>
      i.id === game.id ||
      (i.kind === 'catalog' && i.catalogEntryId && i.catalogEntryId === game.catalogEntryId),
  )
  return collectionItemThumbUrl(fromShelf || game)
}

function formatSessionWhen(session) {
  const ms = sessionSortMs(session)
  if (!ms) return 'Unknown time'
  return new Date(ms).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function playerCountLabel(session) {
  const n = (session?.presentPlayers || []).length
  return `${n} ${n === 1 ? 'player' : 'players'}`
}

function statusColor(state) {
  if (state === 'complete') return 'positive'
  if (state === 'scoring') return 'warning'
  if (state === 'playing') return 'primary'
  return 'grey'
}

function openSession(session) {
  void flow.resumeSession(session, 'sessions')
}

function openSessionSlide(detail, session) {
  detail.reset()
  openSession(session)
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
  await props.sessionsApi.removeSession(deleteTarget.value.id)
  cancelDelete()
}
</script>

<style scoped>
.gm-session-game {
  background: rgba(255, 255, 255, 0.04);
}

.body--light .gm-session-game {
  background: rgba(0, 0, 0, 0.03);
}

.gm-session-game__header {
  min-height: 72px;
}

.gm-session-game__body {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.body--light .gm-session-game__body {
  border-top-color: rgba(0, 0, 0, 0.08);
}

.gm-session-row {
  min-height: 56px;
  background: rgba(255, 255, 255, 0.02);
}

.body--light .gm-session-row {
  background: rgba(0, 0, 0, 0.02);
}

.gm-slide {
  margin-bottom: 0;
}
</style>
