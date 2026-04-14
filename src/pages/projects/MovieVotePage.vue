<template>
  <q-page class="mv-page column fit no-wrap">
    <MovieVoteTopBar />

    <div class="col mv-page__scroll column">
      <!-- Suggestions -->
      <template v-if="phase === 'suggest'">
        <div class="q-px-md q-pt-md column q-gutter-y-sm">
          <q-input
            v-model="displayNameModel"
            outlined
            dense
            label="Your name"
            maxlength="40"
            @blur="persistName"
          />
          <div v-if="participants.length" class="text-caption text-grey-6">
            <span v-for="(p, i) in participants" :key="p.id">
              {{ p.displayName }}: {{ p.ready ? 'ready' : 'picking' }} ({{ p.pickCount }})
              <span v-if="i < participants.length - 1"> · </span>
            </span>
          </div>
        </div>
        <MovieSearchField @select="onPickMovie" />
        <div v-if="!myDraftPicks.length" class="q-pa-lg text-center text-body2 text-grey-5">
          <p class="q-mb-sm">No movies in your list yet.</p>
          <p class="q-mb-none">Search above to add suggestions, then drag to reorder.</p>
        </div>
        <MovieNominationList v-else class="col" />
        <div class="q-px-md q-pb-md">
          <q-toggle v-model="readyModel" color="primary" label="Ready to vote" :disable="myDraftPicks.length < 1" />
        </div>
        <div v-if="!isInSession" class="q-px-md q-pb-md">
          <q-btn
            unelevated
            color="primary"
            no-caps
            class="full-width"
            label="Start ballot (solo)"
            :disable="!readyModel || myDraftPicks.length < 1"
            @click="onSoloStart"
          />
        </div>
      </template>

      <!-- Voting -->
      <template v-else-if="phase === 'voting'">
        <div class="q-px-md q-pt-md text-body2 text-grey-6">
          Rank every movie. {{ voteProgressLabel }}
        </div>
        <MovieBallotList class="col" />
        <div class="q-pa-md">
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

      <!-- Results -->
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
  </q-page>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
import {
  joinRoom,
  movieVoteGuestPushDraft,
  movieVoteGuestSubmitVote,
  movieVoteHostAfterVoteSubmit,
  movieVoteHostLocalChanged,
  movieVoteSoloStartVoting,
} from '../../features/movie-vote/p2p/session.js'
import { useMovieVoteStore } from '../../stores/movieVote.js'

const $q = useQuasar()
const route = useRoute()
const router = useRouter()
const store = useMovieVoteStore()
const {
  phase,
  myDraftPicks,
  participants,
  ballotMovies,
  irvResult,
  myVoteSubmitted,
  voteProgress,
} = storeToRefs(store)

const { isGuest, isHosting, isInSession, resumeMovieVoteSessionIfNeeded } = useMovieVoteP2P()

let guestDraftTimer = 0
function scheduleGuestDraftPush() {
  if (!isGuest.value) return
  window.clearTimeout(guestDraftTimer)
  guestDraftTimer = window.setTimeout(() => {
    guestDraftTimer = 0
    movieVoteGuestPushDraft()
  }, 320)
}

watch(
  [myDraftPicks, () => store.readyToVote, () => store.displayName, phase, isGuest],
  () => {
    if (isGuest.value && phase.value === 'suggest') {
      scheduleGuestDraftPush()
    }
  },
  { deep: true },
)

watch(
  [() => store.myParticipantId, isGuest, phase],
  () => {
    if (isGuest.value && phase.value === 'suggest' && store.myParticipantId) {
      movieVoteGuestPushDraft()
    }
  },
)

watch(
  [myDraftPicks, () => store.readyToVote, () => store.displayName, phase, isHosting],
  () => {
    if (isHosting.value) {
      movieVoteHostLocalChanged()
    }
  },
  { deep: true },
)

onUnmounted(() => {
  window.clearTimeout(guestDraftTimer)
})

const displayNameModel = ref(store.displayName)
watch(
  () => store.displayName,
  (v) => {
    displayNameModel.value = v
  },
)

function persistName() {
  store.setDisplayName(displayNameModel.value)
}

const readyModel = computed({
  get: () => store.readyToVote,
  set: (v) => store.setReadyToVote(Boolean(v)),
})

const voteProgressLabel = computed(() => {
  const v = voteProgress.value
  if (!v) return ''
  return `${v.submitted} / ${v.total} voted`
})

/** @param {import('../../features/movie-vote/types.js').MoviePick} pick */
function onPickMovie(pick) {
  store.addDraftPick(pick)
}

function onSoloStart() {
  movieVoteSoloStartVoting()
}

function onDoneVoting() {
  const ranking = [...store.myRanking]
  if (ranking.length !== store.ballotOrderIds.length) {
    $q.notify({ type: 'warning', message: 'Rank every movie.', position: 'top' })
    return
  }
  if (isGuest.value) {
    movieVoteGuestSubmitVote(ranking)
    store.markVoteSubmitted()
    return
  }
  if (isHosting.value) {
    store.submitMyVoteLocal(ranking)
    movieVoteHostAfterVoteSubmit()
    return
  }
  store.submitSoloVoteAndTally(ranking)
}

function onResetResults() {
  store.resetToSuggest()
  if (isHosting.value) {
    movieVoteHostLocalChanged()
  }
}

onMounted(() => {
  resumeMovieVoteSessionIfNeeded()

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
  overflow: hidden;
}

.mv-page__scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
