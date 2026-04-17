<template>
  <div ref="listRootRef" class="mv-nom-list">
    <div class="mv-nom-list__inner q-pa-sm">
      <Draggable
        v-model="draggablePicks"
        item-key="localId"
        tag="div"
        class="mv-draggable"
        :animation="200"
        :delay="450"
        :delay-on-touch-only="true"
        :touch-start-threshold="8"
        direction="vertical"
        ghost-class="mv-sortable-ghost"
        chosen-class="mv-sortable-chosen"
        drag-class="mv-sortable-drag"
        @contextmenu.prevent
      >
        <template #item="{ element: pick }">
          <q-slide-item
            class="mv-slide q-mb-sm rounded-borders overflow-hidden"
            right-color="negative"
            @right="(e) => requestDelete(e, pick)"
            @contextmenu.prevent
          >
            <template #right>
              <div class="row items-center full-height q-px-md" aria-hidden="true">
                <q-icon name="delete" size="md" />
              </div>
            </template>
            <div
              class="mv-nom-row row items-center no-wrap q-px-md q-py-sm rounded-borders"
              @click="openDetail(pick)"
            >
              <q-img
                v-if="thumbs[pick.localId]"
                :src="thumbs[pick.localId]"
                width="48px"
                height="72px"
                fit="cover"
                class="rounded-borders q-mr-md"
                style="flex-shrink: 0"
                spinner-color="primary"
                loading="lazy"
              />
              <q-icon v-else name="movie" size="lg" class="q-mr-sm" color="grey-5" />
              <div class="col min-width-0">
                <div class="text-body1 text-weight-medium ellipsis">{{ pick.title }}</div>
                <div v-if="pickMetaLine(pick)" class="text-caption text-grey-6 ellipsis">
                  {{ pickMetaLine(pick) }}
                </div>
              </div>
            </div>
          </q-slide-item>
        </template>
      </Draggable>
    </div>

    <MovieDetailDialog v-model="detailOpen" :movie="detailMovie" />

    <q-dialog v-model="deleteConfirmOpen" persistent>
      <q-card class="mv-dialog-card mv-dialog-card--narrow">
        <q-card-section class="text-h6">Remove movie?</q-card-section>
        <q-card-section class="q-pt-none text-body2">
          Remove <strong>{{ deleteTargetTitle }}</strong> from your suggestions?
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="cancelDelete" />
          <q-btn unelevated label="Remove" color="negative" @click="confirmDelete" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import Draggable from 'vuedraggable'
import { useMovieVoteStore } from '../../../stores/movieVote.js'
import { formatMovieMetaLine, posterUrl } from '../tmdb.js'
import MovieDetailDialog from './MovieDetailDialog.vue'

const store = useMovieVoteStore()
const { myDraftPicks } = storeToRefs(store)

const draggablePicks = computed({
  get: () => store.myDraftPicks,
  set: (next) => {
    if (Array.isArray(next)) store.reorderDraftPicks(next)
  },
})

/** @param {import('../types.js').MoviePick} pick */
function pickMetaLine(pick) {
  return formatMovieMetaLine(pick.releaseDate, pick.runtime)
}

const listRootRef = ref(null)
const thumbs = ref(/** @type {Record<string, string>} */ ({}))

watch(
  myDraftPicks,
  async (picks) => {
    const next = { ...thumbs.value }
    for (const p of picks) {
      if (p.posterPath && !next[p.localId]) {
        next[p.localId] = posterUrl(p.posterPath, 'w92') ?? ''
      }
    }
    thumbs.value = next
  },
  { deep: true, immediate: true },
)

const detailOpen = ref(false)
/** @type {import('vue').Ref<import('../types.js').MoviePick | null>} */
const detailMovie = ref(null)

const deleteConfirmOpen = ref(false)
const pendingDeleteLocalId = ref(/** @type {string | null} */ (null))
const deleteTargetTitle = ref('')

/** @param {import('../types.js').MoviePick} pick */
function openDetail(pick) {
  detailMovie.value = pick
  detailOpen.value = true
}

/** @param {{ reset: () => void }} e @param {import('../types.js').MoviePick} pick */
function requestDelete(e, pick) {
  pendingDeleteLocalId.value = pick.localId
  deleteTargetTitle.value = pick.title
  deleteConfirmOpen.value = true
  e.reset()
}

function cancelDelete() {
  deleteConfirmOpen.value = false
  pendingDeleteLocalId.value = null
  deleteTargetTitle.value = ''
}

function confirmDelete() {
  const id = pendingDeleteLocalId.value
  if (id) {
    store.removeDraftPick(id)
  }
  cancelDelete()
}
</script>

<style scoped lang="scss">
.mv-nom-list {
  min-height: 0;
}

.mv-nom-list__inner {
  min-height: 0;
}

.mv-nom-row {
  background: rgba(128, 128, 128, 0.12);
  min-height: 56px;
}

.body--light .mv-nom-row {
  background: rgba(0, 0, 0, 0.04);
}

.mv-sortable-ghost {
  opacity: 0.45;
}

.mv-dialog-card {
  min-width: min(400px, calc(100vw - 32px));
}
</style>
