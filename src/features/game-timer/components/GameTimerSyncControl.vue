<template>
  <div class="gt-sync-control">
    <q-btn flat round size="md" :color="syncColor" :aria-label="syncAriaLabel" class="gt-sync-control__trigger">
      <q-circular-progress
        v-if="isBusy"
        indeterminate
        size="30px"
        :color="busySpinnerColor"
        class="gt-sync-control__spinner"
      />
      <span
        v-else
        class="gt-sync-control__glyph"
        :class="{ 'gt-sync-control__glyph--multi': syncIcon !== 'check_circle' }"
      >
        <q-icon :name="syncIcon" />
      </span>
      <q-menu
        ref="menuRef"
        anchor="bottom middle"
        self="top middle"
        :offset="[0, 6]"
        class="gt-sync-menu-shell"
      >
        <div class="gt-sync-menu q-pa-lg">
          <div class="text-h6 text-weight-medium q-mb-xs">Multiplayer</div>
          <div class="text-body2 text-grey-6 q-mb-md">{{ statusDescription }}</div>

          <template v-if="phase === 'idle'">
            <div class="column q-gutter-y-md">
              <q-btn
                outline
                no-caps
                color="grey-7"
                class="full-width gt-sync-menu__action-btn"
                padding="12px 16px"
                label="Host room"
                @click="onHost"
              />
              <q-btn
                outline
                no-caps
                color="grey-7"
                class="full-width gt-sync-menu__action-btn"
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
                class="full-width gt-sync-menu__action-btn gt-sync-menu__action"
                padding="12px 16px"
                label="Cancel"
                @click="onLeave"
              />
            </div>
          </template>

          <template v-else-if="phase === 'hosting'">
            <div class="column gt-sync-menu__hosting-block">
              <div class="row items-center no-wrap q-gutter-x-sm">
                <code class="gt-sync-menu__code gt-sync-menu__code-display col">{{ suffix }}</code>
                <q-btn
                  flat
                  round
                  icon="content_copy"
                  size="md"
                  color="grey-6"
                  class="gt-sync-menu__copy-btn"
                  aria-label="Copy room code"
                  @click="copyCode"
                />
                <q-btn
                  flat
                  round
                  icon="link"
                  size="md"
                  color="grey-6"
                  class="gt-sync-menu__copy-btn"
                  aria-label="Copy room link"
                  @click="copyRoomUrl"
                />
              </div>
              <q-btn
                outline
                no-caps
                color="grey-7"
                class="full-width gt-sync-menu__action-btn gt-sync-menu__action"
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
                <code class="gt-sync-menu__code gt-sync-menu__code-display">{{ suffix }}</code>
              </div>
              <div v-if="remoteHostTabVisible" class="text-body2 text-positive">In sync</div>
              <div v-else class="text-body2 text-warning">Host tab in background</div>
              <q-btn
                outline
                no-caps
                color="grey-7"
                class="full-width gt-sync-menu__action-btn gt-sync-menu__action"
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
      <q-card class="gt-dialog-card gt-dialog-card--narrow gt-dialog-card--touch-pad">
        <q-card-section class="text-h6">Join room</q-card-section>
        <q-card-section class="q-pt-none">
          <q-input
            v-model="joinCodeInput"
            label="Room code"
            outlined
            autofocus
            maxlength="32"
            class="gt-join-room-input"
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
import { useGameTimerP2P } from '../composables/useGameTimerP2P.js'
import { buildGameTimerRoomShareUrl, normalizeRoomSuffixInput } from '../p2p/roomId.js'

const $q = useQuasar()
const menuRef = ref(/** @type {{ hide?: () => void } | null} */ (null))
const {
  phase,
  suffix,
  remoteHostTabVisible,
  startAsHost,
  joinRoom,
  leaveSession,
  resumeP2PSessionIfNeeded,
} = useGameTimerP2P()

const joinOpen = ref(false)
const joinCodeInput = ref('')

const isBusy = computed(() => phase.value === 'connecting' || phase.value === 'reconnecting')

const syncIcon = computed(() => {
  if (phase.value === 'guest_connected') return 'check_circle'
  return 'people'
})

const busySpinnerColor = computed(() =>
  phase.value === 'reconnecting' ? 'warning' : 'primary',
)

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
      return `Multiplayer: hosting room ${suffix.value ?? ''}`
    case 'guest_connected':
      return remoteHostTabVisible.value
        ? `Multiplayer: synced, room ${suffix.value ?? ''}`
        : `Multiplayer: host tab in background, room ${suffix.value ?? ''}`
    case 'connecting':
      return 'Multiplayer: connecting'
    case 'reconnecting':
      return 'Multiplayer: reconnecting'
    default:
      return 'Multiplayer: not connected'
  }
})

const statusDescription = computed(() => {
  switch (phase.value) {
    case 'idle':
      return 'Share this session with others on their devices.'
    case 'connecting':
      return 'Opening connection…'
    case 'reconnecting':
      return 'Connection dropped. Trying again…'
    case 'hosting':
      return 'You are currently hosting a room. Others can join with this code:'
    case 'guest_connected':
      return remoteHostTabVisible.value
        ? 'Following the host’s timer state.'
        : 'The host’s browser tab is in the background; updates may be delayed until they return.'
    default:
      return ''
  }
})

watch(joinOpen, (open) => {
  if (open) joinCodeInput.value = ''
})

onMounted(() => {
  resumeP2PSessionIfNeeded()
})

function hideMenu() {
  menuRef.value?.hide?.()
}

async function onHost() {
  try {
    await startAsHost()
  } catch { void 0 }
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
  } catch { void 0 }
}

function copyCode() {
  if (!suffix.value) return
  const t = suffix.value
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(t).then(() => {
      $q.notify({
        type: 'positive',
        message: 'Room code copied',
        timeout: 1500,
        position: 'top',
        classes: 'gt-notify',
      })
    })
  }
}

function copyRoomUrl() {
  if (!suffix.value) return
  const url = buildGameTimerRoomShareUrl(suffix.value)
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      $q.notify({
        type: 'positive',
        message: 'Room link copied',
        timeout: 1500,
        position: 'top',
        classes: 'gt-notify',
      })
    })
  }
}

function onLeave() {
  hideMenu()
  leaveSession()
}
</script>

<style scoped lang="scss">
.gt-sync-control {
  flex-shrink: 0;
}

.gt-sync-control__spinner {
  display: block;
}

.gt-sync-control__glyph {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
}

.gt-sync-control__glyph :deep(.q-icon) {
  font-size: 28px;
}

.gt-sync-control__glyph--multi :deep(.q-icon) {
  transform: scale(0.9, 0.98);
  transform-origin: center center;
}

.gt-sync-menu__code {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  user-select: all;
}
</style>

<style lang="scss">
/* q-menu content is portaled; .gt-sync-menu-shell is on the panel root */
.gt-sync-menu-shell .gt-sync-menu {
  min-width: min(100vw - 32px, 340px);
  max-width: min(480px, 100vw - 20px);
}

.gt-sync-menu-shell .gt-sync-menu__action {
  margin-top: 4px;
}

.gt-sync-menu-shell .gt-sync-menu__hosting-block {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.gt-sync-menu-shell .gt-sync-menu__action-btn {
  min-height: 48px;
}

.gt-sync-menu-shell .gt-sync-menu__copy-btn {
  flex-shrink: 0;
}

/* Large enough to read from across a table; portaled menu — keep under .gt-sync-menu-shell */
.gt-sync-menu-shell .gt-sync-menu__code-display {
  display: block;
  font-size: clamp(2.25rem, 11vw, 3.25rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.16em;
  font-variant-numeric: tabular-nums;
  user-select: all;
  word-break: break-all;
  overflow-wrap: anywhere;
}
</style>
