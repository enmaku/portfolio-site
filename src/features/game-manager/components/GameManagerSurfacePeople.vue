<template>
  <div data-testid="gm-surface-people" class="gm-surface">
    <div class="gm-surface__scroll q-pa-md">
      <div
        v-if="error"
        class="text-negative text-caption q-mb-sm"
        data-testid="gm-people-error"
      >
        {{ errorMessage }}
      </div>

      <div
        v-if="!people.length"
        class="gm-empty column items-center q-mx-auto q-py-xl text-center text-grey-5"
        data-testid="gm-people-empty"
      >
        <p class="q-mb-sm text-body1">No people yet.</p>
        <p class="q-mb-none text-body2">Tap + to add someone to your roster.</p>
      </div>

      <div v-else data-testid="gm-people-list">
        <q-slide-item
          v-for="person in people"
          :key="person.id"
          class="gm-slide rounded-borders overflow-hidden"
          left-color="primary"
          right-color="negative"
          :data-testid="`gm-people-row-${person.id}`"
          @left="(e) => openEditSlide(e, person)"
          @right="(e) => requestDelete(e, person)"
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

          <q-item
            clickable
            v-ripple
            class="gm-person-row"
            :style="rowStyle(person)"
            @click="openPersonStats(person)"
          >
            <q-item-section avatar>
              <q-avatar size="36px" :style="{ backgroundColor: person.color }" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-body1 text-weight-medium">{{ person.name }}</q-item-label>
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
        aria-label="Add person"
        class="gm-actions-bar__fixed-btn"
        data-testid="gm-people-add-fab"
        @click="openAdd"
      />
    </div>

    <GameManagerPersonStatisticsPanel
      v-if="statsPerson"
      :person="statsPerson"
      :sessions="sessions"
      :collection-items="collectionItems"
      @close="statsPerson = null"
      @open-session="openHistorySession"
    />

    <q-dialog v-model="editorOpen">
      <q-card class="gm-dialog-card gm-dialog-card--narrow">
        <q-card-section class="text-h6">{{ editingId ? 'Edit person' : 'Add person' }}</q-card-section>
        <q-card-section class="q-gutter-md q-pt-none">
          <q-input
            v-model="draftName"
            dense
            outlined
            label="Name"
            autofocus
            data-testid="gm-people-name-input"
            @keyup.enter="saveEditor"
          />
          <div>
            <div class="text-caption text-grey-6 q-mb-xs">Color</div>
            <q-color
              v-model="draftColor"
              default-view="palette"
              format-model="hex"
              class="full-width"
              style="max-width: 100%"
              data-testid="gm-people-color"
            />
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="editorOpen = false" />
          <q-btn
            unelevated
            :label="editingId ? 'Save' : 'Add'"
            color="primary"
            data-testid="gm-people-save-btn"
            :disable="!draftName.trim()"
            @click="saveEditor"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="deleteConfirmOpen" persistent>
      <q-card class="gm-dialog-card gm-dialog-card--narrow">
        <q-card-section class="text-h6">Delete person?</q-card-section>
        <q-card-section class="q-pt-none text-body2">
          Remove <strong>{{ deleteTarget?.name }}</strong> from your people list? Past sessions keep a
          removed-player placeholder.
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="cancelDelete" />
          <q-btn
            unelevated
            label="Delete"
            color="negative"
            data-testid="gm-people-delete-confirm"
            @click="confirmDelete"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { GAME_MANAGER_SESSION_FLOW_KEY } from '../composables/sessionFlowKey.js'
import { useGameManagerPeople } from '../composables/useGameManagerPeople.js'
import { PERSON_DEFAULT_COLORS } from '../people/peopleViewModel.js'
import GameManagerPersonStatisticsPanel from './GameManagerPersonStatisticsPanel.vue'

const flow = inject(GAME_MANAGER_SESSION_FLOW_KEY)
if (!flow) {
  throw new Error('GameManagerSurfacePeople requires session flow provide')
}

const { people, error, peekNextColor, addOrSelectPerson, updatePerson, deletePerson } =
  useGameManagerPeople()

const editorOpen = ref(false)
const editingId = ref(null)
const draftName = ref('')
const draftColor = ref(PERSON_DEFAULT_COLORS[0])
const deleteConfirmOpen = ref(false)
const deleteTarget = ref(null)
const statsPerson = ref(null)

const sessions = computed(() => flow.sessions?.value || [])
const collectionItems = computed(() => flow.collectionItems?.value || [])

const errorMessage = computed(() => {
  if (!error.value) return ''
  return error.value.message || String(error.value)
})

function rowStyle(person) {
  return {
    background: `linear-gradient(90deg, ${person.color}33 0%, rgba(255,255,255,0.04) 48%)`,
    minHeight: '64px',
  }
}

function openPersonStats(person) {
  statsPerson.value = person
}

function openHistorySession(sessionId) {
  const session = sessions.value.find((s) => s.id === sessionId)
  if (!session) return
  void flow.resumeSession(session, 'people')
}

function openAdd() {
  editingId.value = null
  draftName.value = ''
  draftColor.value = peekNextColor()
  editorOpen.value = true
}

function openEditSlide(detail, person) {
  detail.reset()
  editingId.value = person.id
  draftName.value = person.name
  draftColor.value = person.color || PERSON_DEFAULT_COLORS[0]
  editorOpen.value = true
}

async function saveEditor() {
  const name = draftName.value.trim()
  if (!name) return
  if (editingId.value) {
    await updatePerson(editingId.value, { name, color: draftColor.value })
  } else {
    await addOrSelectPerson({ name, color: draftColor.value })
  }
  editorOpen.value = false
}

function requestDelete(detail, person) {
  detail.reset()
  deleteTarget.value = person
  deleteConfirmOpen.value = true
}

function cancelDelete() {
  deleteConfirmOpen.value = false
  deleteTarget.value = null
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  await deletePerson(deleteTarget.value.id)
  cancelDelete()
}
</script>

<style scoped>
.gm-person-row {
  min-height: 64px;
}
</style>
