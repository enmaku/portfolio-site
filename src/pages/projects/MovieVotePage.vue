<template>
  <q-page class="mv-page column fit no-wrap">
    <MovieVoteTopBar />

    <div class="col mv-page__scroll column">
      <template v-if="phase === 'suggest'">
        <MovieSearchField @select="onPickMovie" />
        <div v-if="!myDraftPicks.length" class="q-pa-lg text-center text-body2 text-grey-5">
          <template v-if="roomShowsOthersSuggestionHint">
            <p class="q-mb-sm">You haven’t added any movies.</p>
            <p class="q-mb-none">Someone else already suggested titles — add more if you like, or mark ready once there are two different movies in the pool.</p>
          </template>
          <template v-else>
            <p class="q-mb-sm">No movies in your list yet.</p>
            <p class="q-mb-none">Search above to add suggestions, then drag to reorder.</p>
          </template>
        </div>
        <MovieNominationList v-else class="col" />
        <div v-if="isInSession" class="q-px-md q-pb-md">
          <q-toggle
            v-model="readyModel"
            color="primary"
            label="Ready to vote"
            :disable="!roomCanMarkReadyForVote"
          />
        </div>
      </template>

      <template v-else-if="phase === 'voting'">
        <div class="q-px-md q-pt-md text-body2 text-grey-6">
          Rank every movie. {{ voteProgressLabel }}
        </div>
        <MovieBallotList class="col mv-page__ballot" />
        <div class="mv-page__vote-footer">
          <q-btn
            unelevated
            color="primary"
            no-caps
            class="full-width"
            label="Done voting"
            :disable="myVoteSubmitted"
            @click="onDoneVoting"
          />
        </div>
      </template>

      <template v-else-if="phase === 'results'">
        <MovieVoteResultsPanel
          class="col"
          :irv-result="irvResult"
          :ballot-movies="ballotMovies"
          :allow-reset="!isGuest"
          @reset="onResetResults"
        />
      </template>
    </div>

    <div
      v-if="phase === 'suggest' && myDraftPicks.length"
      class="mv-actions-bar row items-center no-wrap full-width q-px-md q-pt-sm"
    >
      <q-btn
        fab-mini
        outline
        color="grey-5"
        icon="playlist_remove"
        aria-label="Clear all my movies"
        class="mv-actions-bar__fixed-btn"
        @click="clearConfirmOpen = true"
      />
    </div>

    <q-dialog v-model="clearConfirmOpen" persistent>
      <q-card class="mv-dialog-card mv-dialog-card--narrow">
        <q-card-section class="text-h6">Clear your movies?</q-card-section>
        <q-card-section class="q-pt-none text-body2">
          This removes every movie from your suggestions for this session. This cannot be undone.
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="clearConfirmOpen = false" />
          <q-btn unelevated label="Clear all" color="negative" @click="confirmClearMovies" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'
import MovieBallotList from '../../features/movie-vote/components/MovieBallotList.vue'
import MovieNominationList from '../../features/movie-vote/components/MovieNominationList.vue'
import MovieSearchField from '../../features/movie-vote/components/MovieSearchField.vue'
import MovieVoteResultsPanel from '../../features/movie-vote/components/MovieVoteResultsPanel.vue'
import MovieVoteTopBar from '../../features/movie-vote/components/MovieVoteTopBar.vue'
import { useMovieVoteP2P } from '../../features/movie-vote/composables/useMovieVoteP2P.js'
import {
  MOVIE_VOTE_ROOM_QUERY_KEY,
  isValidRoomSuffix,
  normalizeRoomSuffixInput,
} from '../../features/movie-vote/p2p/roomId.js'
import { joinRoom } from '../../features/movie-vote/p2p/session.js'
import { useProjectShellBrowserFullscreen } from '../../layouts/projects/composables/useProjectShellBrowserFullscreen.js'
import { useMovieVoteStore } from '../../stores/movieVote.js'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const store = useMovieVoteStore()
const {
  phase,
  myDraftPicks,
  ballotMovies,
  irvResult,
  myVoteSubmitted,
  voteProgress,
  uniqueSuggestedMovieCount,
  fullscreenEnabled,
} = storeToRefs(store)

const { isGuest, isInSession } = useMovieVoteP2P()

useProjectShellBrowserFullscreen({
  enabled: fullscreenEnabled,
  setEnabled: (next) => store.setFullscreenEnabled(next),
  notify: $q.notify,
})

/** Distinct movies in the room (TMDB-deduped) meet the minimum to mark ready. */
const roomCanMarkReadyForVote = computed(() => uniqueSuggestedMovieCount.value >= 2)

/** Empty local list but someone has suggested at least one title (copy hint). */
const roomShowsOthersSuggestionHint = computed(
  () => isInSession.value && uniqueSuggestedMovieCount.value >= 1,
)

const readyModel = computed({
  get: () => store.readyToVote,
  set: (v) => store.setReadyToVote(Boolean(v)),
})

const voteProgressLabel = computed(() => {
  const v = voteProgress.value
  if (!v) return ''
  return `${v.submitted} / ${v.total} voted`
})

const clearConfirmOpen = ref(false)

/** @param {import('../../features/movie-vote/types.js').MoviePick} pick */

function onPickMovie(pick) {
  store.addDraftPick(pick)
}

function confirmClearMovies() {
  store.clearAllDraftPicks()
  clearConfirmOpen.value = false
}

function onDoneVoting() {
  const ranking = [...store.myRanking]
  if (!store.submitVote(ranking)) {
    $q.notify({ type: 'warning', message: 'Rank every movie.', position: 'top' })
  }
}

function onResetResults() {
  store.resetToSuggest()
}

onMounted(() => {
  const raw = route.query[MOVIE_VOTE_ROOM_QUERY_KEY]
  if (raw === undefined || raw === null) return
  const str = Array.isArray(raw) ? raw[0] : raw
  if (!String(str).trim()) return

  const nextQuery = { ...route.query }
  delete nextQuery[MOVIE_VOTE_ROOM_QUERY_KEY]
  router.replace({
    path: route.path,
    query: nextQuery,
    hash: route.hash,
  })

  const code = normalizeRoomSuffixInput(str)
  if (!isValidRoomSuffix(code)) {
    $q.notify({
      type: 'warning',
      message: 'This room link is not valid.',
      timeout: 2500,
      position: 'top',
    })
    return
  }

  void joinRoom(code).catch(() => {})
})
</script>

<style scoped lang="scss">
.mv-page {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  width: 100%;
  overflow: hidden;
}

.mv-page__scroll {
  flex: 1 1 0;
  min-height: 0;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mv-page__ballot {
  min-width: 0;
  width: 100%;
  max-width: 100%;
}

.mv-page__vote-footer {
  flex: 0 0 auto;
  align-self: stretch;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 16px;
}

.mv-actions-bar {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
}

.mv-actions-bar__fixed-btn {
  flex-shrink: 0;
}

.body--light .mv-actions-bar {
  border-top-color: rgba(0, 0, 0, 0.08);
}

.mv-dialog-card {
  min-width: min(400px, calc(100vw - 32px));
}
</style>
