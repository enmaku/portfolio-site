<template>
  <div class="tt-surface" data-testid="tt-surface-projects">
    <div class="tt-surface__scroll q-pa-md">
      <q-item
        v-for="project in state.projects"
        :key="project.id"
        clickable
        :data-testid="`tt-project-${project.id}`"
        @click="openEdit(project)"
      >
        <q-item-section>
          <q-item-label>{{ project.name }}</q-item-label>
          <q-item-label caption>
            {{ clientName(project.clientId) }}
            <span v-if="project.billable"> · {{ formatUsd(project.hourlyRateUsd) }}/hr</span>
          </q-item-label>
        </q-item-section>
      </q-item>
    </div>
    <div class="row justify-end q-pa-md">
      <q-btn fab color="primary" icon="add" data-testid="tt-project-add" @click="openAdd" />
    </div>

    <q-dialog v-model="editorOpen">
      <q-card class="tt-dialog-card">
        <q-card-section class="column q-gutter-y-sm">
          <q-input v-model="draft.name" outlined dense label="Name" data-testid="tt-project-name" />
          <q-select
            v-model="draft.clientId"
            :options="clientOptions"
            option-value="id"
            option-label="name"
            emit-value
            map-options
            clearable
            outlined
            dense
            label="Client"
          />
          <q-toggle v-model="draft.billable" label="Billable" data-testid="tt-project-billable" />
          <q-input
            v-model.number="draft.hourlyRateUsd"
            type="number"
            outlined
            dense
            label="Hourly rate"
            :disable="!draft.billable"
            data-testid="tt-project-rate"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn
            v-if="editingId"
            flat
            no-caps
            color="negative"
            label="Delete"
            data-testid="tt-project-delete"
            @click="onDelete"
          />
          <q-btn flat no-caps color="grey" label="Cancel" v-close-popup />
          <q-btn
            unelevated
            no-caps
            color="primary"
            label="Save"
            data-testid="tt-project-save"
            :disable="!draft.name.trim()"
            :loading="saving"
            @click="onSave"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, inject, reactive, ref } from 'vue'
import { useQuasar } from 'quasar'
import { TIME_TRACKER_WORKSPACE_KEY } from '../composables/trackerSurfaces.js'
import { formatUsd } from '../formatDisplay.js'

const $q = useQuasar()
const workspace = inject(TIME_TRACKER_WORKSPACE_KEY)
const state = workspace.state
const editorOpen = ref(false)
const editingId = ref(null)
const saving = ref(false)
const draft = reactive({
  name: '',
  clientId: null,
  billable: false,
  hourlyRateUsd: 0,
})

const clientOptions = computed(() => [{ id: null, name: '—' }, ...state.clients])

function clientName(clientId) {
  return state.clients.find((client) => client.id === clientId)?.name || ''
}

function openAdd() {
  editingId.value = null
  draft.name = ''
  draft.clientId = null
  draft.billable = false
  draft.hourlyRateUsd = 0
  editorOpen.value = true
}

function openEdit(project) {
  editingId.value = project.id
  draft.name = project.name
  draft.clientId = project.clientId
  draft.billable = project.billable
  draft.hourlyRateUsd = project.hourlyRateUsd
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
      message: err instanceof Error ? err.message : 'Could not save project',
    })
  } finally {
    saving.value = false
  }
}

function onSave() {
  if (!draft.name.trim()) return
  return runEditorAction(async () => {
    if (editingId.value) {
      await workspace.renameProject(editingId.value, draft.name)
      await workspace.updateProjectClient(editingId.value, draft.clientId)
      await workspace.updateProjectBilling(editingId.value, {
        billable: draft.billable,
        hourlyRateUsd: draft.hourlyRateUsd,
      })
      return
    }
    const project = await workspace.createProject({ name: draft.name })
    if (draft.clientId) await workspace.updateProjectClient(project.id, draft.clientId)
    if (draft.billable) {
      await workspace.updateProjectBilling(project.id, {
        billable: true,
        hourlyRateUsd: draft.hourlyRateUsd,
      })
    }
  })
}

function onDelete() {
  if (!editingId.value) return
  return runEditorAction(() => workspace.removeProject(editingId.value))
}
</script>
