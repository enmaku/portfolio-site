<template>
  <div class="tt-surface" data-testid="tt-surface-history">
    <div class="tt-surface__scroll q-pa-md">
      <q-item v-if="history.pinned" data-testid="tt-history-running">
        <q-item-section>
          <q-item-label>{{ projectName(history.pinned.projectId) }}</q-item-label>
          <q-item-label caption>{{ formatDurationMs(livePinnedMs) }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-item
        v-for="row in history.rows"
        :key="row.id"
        clickable
        :disable="!row.mutable"
        :data-testid="`tt-history-row-${row.id}`"
        @click="row.mutable && openEdit(row)"
      >
        <q-item-section>
          <q-item-label>{{ projectName(row.projectId) }}</q-item-label>
          <q-item-label caption>
            {{ formatDurationMs(row.durationMs) }}
            <span v-if="row.description"> · {{ row.description }}</span>
          </q-item-label>
        </q-item-section>
      </q-item>
    </div>
    <div class="row justify-end q-pa-md">
      <q-btn fab color="primary" icon="add" data-testid="tt-history-add" @click="openManual" />
    </div>

    <q-dialog v-model="editorOpen" persistent>
      <q-card class="tt-dialog-card">
        <q-card-section class="column q-gutter-y-sm">
          <q-select
            v-model="draft.projectId"
            :options="state.projects"
            option-value="id"
            option-label="name"
            emit-value
            map-options
            outlined
            dense
            label="Project"
          />
          <TimeTrackerDateTimeField v-model="draft.startedAt" label="Start" />
          <TimeTrackerDateTimeField v-model="draft.endedAt" label="End" />
          <q-input v-model="draft.description" outlined dense label="Description" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            v-if="editingId"
            flat
            no-caps
            color="negative"
            label="Delete"
            data-testid="tt-history-delete"
            @click="onDelete"
          />
          <q-btn flat no-caps color="grey" label="Cancel" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Save"
            data-testid="tt-history-save"
            :disable="!draft.projectId || !draft.startedAt || !draft.endedAt"
            :loading="saving"
            @click="onSave"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, inject, onBeforeUnmount, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { TIME_TRACKER_WORKSPACE_KEY } from '../composables/trackerSurfaces.js'
import { formatDurationMs, parseLocalDateTimeInput, toLocalDateTimeInput } from '../formatDisplay.js'
import { historyViewModel } from '../history/historyViewModel.js'
import TimeTrackerDateTimeField from './TimeTrackerDateTimeField.vue'

const $q = useQuasar()
const workspace = inject(TIME_TRACKER_WORKSPACE_KEY)
const state = workspace.state
const editorOpen = ref(false)
const editingId = ref(null)
const saving = ref(false)
const draft = reactive({
  projectId: '',
  startedAt: '',
  endedAt: '',
  description: '',
})
const now = ref(Date.now())
const tick = setInterval(() => {
  now.value = Date.now()
}, 1000)
onBeforeUnmount(() => clearInterval(tick))

const history = computed(() =>
  historyViewModel({
    timeEntries: state.timeEntries,
    runningTimer: state.runningTimer,
    now: now.value,
  }),
)
const livePinnedMs = computed(() =>
  history.value.pinned ? now.value - history.value.pinned.startedAt : 0,
)

function projectName(projectId) {
  return state.projects.find((project) => project.id === projectId)?.name || projectId
}

function toLocalInput(ms) {
  return toLocalDateTimeInput(ms)
}

function fromLocalInput(value) {
  return parseLocalDateTimeInput(value)
}

function openManual() {
  editingId.value = null
  draft.projectId = state.selectedProjectId || state.projects[0]?.id || ''
  const end = Date.now()
  draft.startedAt = toLocalInput(end - 3_600_000)
  draft.endedAt = toLocalInput(end)
  draft.description = ''
  editorOpen.value = true
}

function openEdit(row) {
  editingId.value = row.id
  draft.projectId = row.projectId
  draft.startedAt = toLocalInput(row.startedAt)
  draft.endedAt = toLocalInput(row.endedAt)
  draft.description = row.description || ''
  editorOpen.value = true
}

async function runEditorAction(action) {
  saving.value = true
  try {
    await action()
    editorOpen.value = false
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err instanceof Error ? err.message : 'Could not save time entry',
    })
  } finally {
    saving.value = false
  }
}

function onSave() {
  if (!draft.projectId || !draft.startedAt || !draft.endedAt) return
  const payload = {
    projectId: draft.projectId,
    startedAt: fromLocalInput(draft.startedAt),
    endedAt: fromLocalInput(draft.endedAt),
    description: draft.description,
  }
  return runEditorAction(() =>
    editingId.value
      ? workspace.editTimeEntry(editingId.value, payload)
      : workspace.addManualTimeEntry(payload),
  )
}

function onDelete() {
  if (!editingId.value) return
  return runEditorAction(() => workspace.removeTimeEntry(editingId.value))
}
</script>
