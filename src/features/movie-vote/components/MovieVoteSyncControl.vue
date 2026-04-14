<template>
  <div class="mv-sync-control">
    <q-btn flat round size="md" :color="syncColor" :aria-label="syncAriaLabel" class="mv-sync-control__trigger">
      <q-circular-progress
        v-if="isBusy"
        indeterminate
        size="30px"
        :color="busySpinnerColor"
        class="mv-sync-control__spinner"
      />
      <span v-else class="mv-sync-control__glyph">
        <q-icon :name="syncIcon" />
      </span>
      <q-menu
        ref="menuRef"
        anchor="bottom middle"
        self="top middle"
        :offset="[0, 6]"
        class="mv-sync-menu-shell"
      >
        <div class="mv-sync-menu q-pa-lg">
          <div class="text-h6 text-weight-medium q-mb-xs">Movie Vote room</div>
          <div class="text-body2 text-grey-6 q-mb-md">{{ statusDescription }}</div>

          <template v-if="phase === 'idle'">
            <div class="column q-gutter-y-md">
              <q-btn
                outline
                no-caps
                color="grey-7"
                class="full-width mv-sync-menu__action-btn"
                padding="12px 16px"
                label="Host room"
                @click="onHost"
              />
              <q-btn
                outline
                no-caps
                color="grey-7"
                class="full-width mv-sync-menu__action-btn"
                padding="12px 16px"
                label="Join room"
                @click="openJoinFromMenu"
              />
            </div>
          </template>

          <template v-else-if="phase === 'connecting'">
            <div class="row items-center q-gutter-md text-body2 text-grey-6">
              <q-circular-progress indeterminate size="24px" color="primary" />
              <span>Connecting…</span>
            </div>
          </template>

          <template v-else-if="phase === 'reconnecting'">
            <div class="column q-gutter-md">
              <div class="row items-center q-gutter-md text-body2 text-grey-6">
                <q-circular-progress indeterminate size="24px" color="warning" />
                <span>Reconnecting{{ suffix ? ` to ${suffix}` : '' }}…</span>
              </div>
              <q-btn
                outline
                no-caps
                color="grey-7"
                class="full-width mv-sync-menu__action-btn"
                padding="12px 16px"
                label="Cancel"
                @click="onLeave"
              />
            </div>
          </template>

          <template v-else-if="phase === 'hosting'">
            <div class="column mv-sync-menu__hosting-block">
              <div class="row items-center no-wrap q-gutter-x-sm">
                <code class="mv-sync-menu__code mv-sync-menu__code-display col">{{ suffix }}</code>
                <q-btn
                  flat
                  round
                  icon="content_copy"
                  size="md"
                  color="grey-6"
                  aria-label="Copy room code"
                  @click="copyCode"
                />
                <q-btn
                  flat
                  round
                  icon="link"
                  size="md"
                  color="grey-6"
                  aria-label="Copy room link"
                  @click="copyRoomUrl"
                />
              </div>
              <q-btn
                outline
                no-caps
                color="grey-7"
                class="full-width mv-sync-menu__action-btn"
                padding="12px 16px"
                label="Stop hosting"
                @click="onLeave"
              />
            </div>
          </template>

          <template v-else-if="phase === 'guest_connected'">
            <div class="column q-gutter-md">
              <div class="column q-gutter-sm">
                <span class="text-body2 text-grey-6">Room</span>
                <code class="mv-sync-menu__code mv-sync-menu__code-display">{{ suffix }}</code>
              </div>
              <div v-if="remoteHostTabVisible" class="text-body2 text-positive">Connected</div>
              <div v-else class="text-body2 text-warning">Host tab in background</div>
              <q-btn
                outline
                no-caps
                color="grey-7"
                class="full-width mv-sync-menu__action-btn"
                padding="12px 16px"
                label="Leave room"
                @click="onLeave"
              />
            </div>
          </template>
        </div>
      </q-menu>
    </q-btn>

    <q-dialog v-model="joinOpen">
      <q-card class="mv-dialog-card mv-dialog-card--narrow">
        <q-card-section class="text-h6">Join room</q-card-section>
        <q-card-section class="q-pt-none">
          <q-input
            v-model="joinCodeInput"
            label="Room code"
            outlined
            autofocus
            maxlength="32"
            input-class="text-h6"
            @keyup.enter="confirmJoin"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" padding="10px 18px" @click="joinOpen = false" />
          <q-btn unelevated label="Join" color="primary" padding="10px 22px" @click="confirmJoin" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useMovieVoteP2P } from '../composables/useMovieVoteP2P.js'
import { buildMovieVoteRoomShareUrl, normalizeRoomSuffixInput } from '../p2p/roomId.js'

const $q = useQuasar()
const menuRef = ref(/** @type {{ hide?: () => void } | null} */ (null))
const {
  phase,
  suffix,
  remoteHostTabVisible,
  startAsHost,
  joinRoom,
  leaveSession,
  resumeMovieVoteSessionIfNeeded,
} = useMovieVoteP2P()

const joinOpen = ref(false)
const joinCodeInput = ref('')

const isBusy = computed(() => phase.value === 'connecting' || phase.value === 'reconnecting')

const syncIcon = computed(() => {
  if (phase.value === 'guest_connected') return 'check_circle'
  return 'people'
})

const busySpinnerColor = computed(() => (phase.value === 'reconnecting' ? 'warning' : 'primary'))

const syncColor = computed(() => {
  switch (phase.value) {
    case 'hosting':
      return 'positive'
    case 'guest_connected':
      return remoteHostTabVisible.value ? 'positive' : 'warning'
    case 'connecting':
      return 'primary'
    case 'reconnecting':
      return 'warning'
    default:
      return 'grey-5'
  }
})

const syncAriaLabel = computed(() => {
  switch (phase.value) {
    case 'hosting':
      return `Movie vote: hosting ${suffix.value ?? ''}`
    case 'guest_connected':
      return `Movie vote: room ${suffix.value ?? ''}`
    case 'connecting':
      return 'Movie vote: connecting'
    case 'reconnecting':
      return 'Movie vote: reconnecting'
    default:
      return 'Movie vote: not connected'
  }
})

const statusDescription = computed(() => {
  switch (phase.value) {
    case 'idle':
      return 'Host or join so everyone can nominate and rank movies together.'
    case 'connecting':
      return 'Opening connection…'
    case 'reconnecting':
      return 'Connection dropped. Trying again…'
    case 'hosting':
      return 'Share this code so friends can join.'
    case 'guest_connected':
      return remoteHostTabVisible.value
        ? 'Following the host’s session.'
        : 'The host’s tab is in the background; updates may be delayed.'
    default:
      return ''
  }
})

watch(joinOpen, (open) => {
  if (open) joinCodeInput.value = ''
})

onMounted(() => {
  resumeMovieVoteSessionIfNeeded()
})

function hideMenu() {
  menuRef.value?.hide?.()
}

async function onHost() {
  try {
    await startAsHost()
  } catch {
    void 0
  }
}

function openJoinFromMenu() {
  hideMenu()
  joinOpen.value = true
}

async function confirmJoin() {
  const code = normalizeRoomSuffixInput(joinCodeInput.value)
  if (!code) return
  try {
    await joinRoom(code)
    joinOpen.value = false
  } catch {
    void 0
  }
}

function copyCode() {
  if (!suffix.value) return
  navigator.clipboard?.writeText(suffix.value).then(() => {
    $q.notify({ type: 'positive', message: 'Room code copied', timeout: 1500, position: 'top' })
  })
}

function copyRoomUrl() {
  if (!suffix.value) return
  const url = buildMovieVoteRoomShareUrl(suffix.value)
  navigator.clipboard?.writeText(url).then(() => {
    $q.notify({ type: 'positive', message: 'Room link copied', timeout: 1500, position: 'top' })
  })
}

function onLeave() {
  hideMenu()
  leaveSession()
}
</script>

<style scoped lang="scss">
.mv-sync-control__spinner {
  display: block;
}

.mv-sync-control__glyph {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
}

.mv-sync-control__glyph :deep(.q-icon) {
  font-size: 28px;
}

.mv-sync-menu__code {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  user-select: all;
}
</style>

<style lang="scss">
.mv-sync-menu-shell.q-menu.scroll {
  overflow-x: hidden;
  overflow-y: auto;
}

.mv-sync-menu-shell .mv-sync-menu {
  box-sizing: border-box;
  width: min(480px, calc(100vw - 32px));
}

.mv-sync-menu-shell .mv-sync-menu__hosting-block {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.mv-sync-menu-shell .mv-sync-menu__action-btn {
  min-height: 48px;
}

.mv-sync-menu-shell .mv-sync-menu__code-display {
  display: block;
  font-size: clamp(2.25rem, 11vw, 3.25rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.16em;
  font-variant-numeric: tabular-nums;
  user-select: all;
  white-space: nowrap;
  min-width: 0;
  overflow-x: clip;
}

.mv-dialog-card {
  min-width: min(400px, calc(100vw - 32px));
}
</style>
