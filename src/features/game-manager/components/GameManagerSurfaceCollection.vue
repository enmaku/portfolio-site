<template>
  <div data-testid="gm-surface-collection" class="gm-surface">
    <div class="gm-surface__scroll q-pa-md">
      <div
        v-if="error"
        class="text-negative text-caption q-mb-sm"
        data-testid="gm-collection-error"
      >
        {{ errorMessage }}
      </div>

      <div
        v-if="!items.length"
        class="gm-empty column items-center q-mx-auto q-py-xl text-center text-grey-5"
        data-testid="gm-collection-empty"
      >
        <p class="q-mb-sm text-body1">No games on your shelf yet.</p>
        <p class="q-mb-none text-body2">Tap + to search the catalog or add a custom title.</p>
      </div>

      <div v-else data-testid="gm-collection-list">
        <q-slide-item
          v-for="item in items"
          :key="item.id"
          class="gm-slide rounded-borders overflow-hidden"
          left-color="primary"
          right-color="negative"
          :data-testid="`gm-collection-row-${item.id}`"
          @left="(e) => openEditSlide(e, item)"
          @right="(e) => requestDelete(e, item)"
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

          <q-item class="gm-collection-row">
            <q-item-section avatar>
              <div class="gm-row-thumb flex flex-center">
                <q-img
                  v-if="thumbFor(item)"
                  :src="thumbFor(item)"
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
              <q-item-label>{{ item.title }}</q-item-label>
              <q-item-label caption>
                <template v-if="item.yearPublished">{{ item.yearPublished }}</template>
                <template v-else-if="item.kind === 'custom'">Custom</template>
              </q-item-label>
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
        aria-label="Add game"
        class="gm-actions-bar__fixed-btn"
        data-testid="gm-collection-add-fab"
        @click="searchOpen = true"
      />
    </div>

    <GameManagerCatalogSearchPanel
      v-if="searchOpen"
      title="Add game"
      test-id="gm-collection-search-panel"
      close-test-id="gm-collection-search-close"
      @select="onSearchSelect"
      @close="searchOpen = false"
    />

    <q-dialog v-model="editDialogOpen">
      <q-card class="gm-dialog-card gm-dialog-card--narrow">
        <template v-if="editTarget?.kind === 'custom'">
          <q-card-section class="text-h6">Rename game</q-card-section>
          <q-card-section class="q-pt-none">
            <q-input
              v-model="editTitle"
              dense
              outlined
              label="Title"
              autofocus
              data-testid="gm-collection-rename-input"
              @keyup.enter="saveEdit"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Cancel" color="grey" @click="editDialogOpen = false" />
            <q-btn
              unelevated
              label="Save"
              color="primary"
              data-testid="gm-collection-rename-save"
              :disable="!editTitle.trim()"
              @click="saveEdit"
            />
          </q-card-actions>
        </template>
        <template v-else-if="editTarget">
          <q-card-section class="text-h6">{{ editTarget.title }}</q-card-section>
          <q-card-section class="q-pt-none column items-center q-gutter-sm">
            <q-img
              v-if="thumbFor(editTarget)"
              :src="thumbFor(editTarget)"
              width="120px"
              height="120px"
              fit="contain"
              spinner-color="primary"
            />
            <div class="text-body2 text-grey-6 text-center">
              <template v-if="editTarget.yearPublished">{{ editTarget.yearPublished }}</template>
              <template v-if="editTarget.minPlayers != null || editTarget.maxPlayers != null">
                <span v-if="editTarget.yearPublished"> · </span>
                {{ editTarget.minPlayers ?? '?' }}–{{ editTarget.maxPlayers ?? '?' }} players
              </template>
              <template v-if="editTarget.playingTime">
                · {{ editTarget.playingTime }} min
              </template>
            </div>
          </q-card-section>
          <q-card-actions align="right">
            <q-btn flat label="Close" color="grey" v-close-popup />
          </q-card-actions>
        </template>
      </q-card>
    </q-dialog>

    <q-dialog v-model="deleteConfirmOpen" persistent>
      <q-card class="gm-dialog-card gm-dialog-card--narrow">
        <q-card-section class="text-h6">Remove from shelf?</q-card-section>
        <q-card-section class="q-pt-none text-body2">
          Remove <strong>{{ deleteTarget?.title }}</strong> from your collection?
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="cancelDelete" />
          <q-btn
            unelevated
            label="Remove"
            color="negative"
            data-testid="gm-collection-delete-confirm"
            @click="confirmDelete"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { collectionItemThumbUrl } from '../collection/collectionViewModel.js'
import { useGameManagerCollection } from '../composables/useGameManagerCollection.js'
import GameManagerCatalogSearchPanel from './GameManagerCatalogSearchPanel.vue'

const { items, error, addFromSearchPick, renameCustom, removeItem } = useGameManagerCollection()

const searchOpen = ref(false)
const editDialogOpen = ref(false)
const editTarget = ref(null)
const editTitle = ref('')
const deleteConfirmOpen = ref(false)
const deleteTarget = ref(null)

const errorMessage = computed(() => {
  if (!error.value) return ''
  return error.value.message || String(error.value)
})

function thumbFor(item) {
  return collectionItemThumbUrl(item)
}

async function onSearchSelect(pick) {
  await addFromSearchPick(pick)
  searchOpen.value = false
}

function openEditSlide(detail, item) {
  detail.reset()
  editTarget.value = item
  editTitle.value = item.title || ''
  editDialogOpen.value = true
}

function requestDelete(detail, item) {
  detail.reset()
  deleteTarget.value = item
  deleteConfirmOpen.value = true
}

function cancelDelete() {
  deleteConfirmOpen.value = false
  deleteTarget.value = null
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  await removeItem(deleteTarget.value.id)
  cancelDelete()
}

async function saveEdit() {
  if (!editTarget.value || editTarget.value.kind !== 'custom') return
  await renameCustom(editTarget.value.id, editTitle.value)
  editDialogOpen.value = false
  editTarget.value = null
}
</script>

<style scoped>
.gm-collection-row {
  background: rgba(255, 255, 255, 0.04);
  min-height: 72px;
}

.body--light .gm-collection-row {
  background: rgba(0, 0, 0, 0.03);
}
</style>
