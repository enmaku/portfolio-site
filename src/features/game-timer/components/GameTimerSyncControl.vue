<template>
  <div class="gt-sync-control">
    <q-btn flat round dense :color="syncColor" :aria-label="syncAriaLabel">
      <q-circular-progress
        v-if="isBusy"
        indeterminate
        size="26px"
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
        <div class="gt-sync-menu q-pa-md">
          <div class="text-subtitle2 text-weight-medium q-mb-xs">Multiplayer</div>
          <div class="text-caption text-grey-6 q-mb-sm">{{ statusDescription }}</div>

          <template v-if="phase === 'idle'">
            <div class="column q-gutter-y-sm">
              <q-btn outline dense no-caps color="grey-7" class="full-width" label="Host room" @click="onHost" />
              <q-btn outline dense no-caps color="grey-7" class="full-width" label="Join room" @click="openJoinFromMenu" />
            </div>
          </template>

          <template v-else-if="phase === 'connecting'">
            <div class="row items-center q-gutter-sm text-caption text-grey-6">
              <q-circular-progress indeterminate size="18px" color="primary" />
              <span>Connecting…</span>
            </div>
          </template>

          <template v-else-if="phase === 'reconnecting'">
            <div class="column q-gutter-sm">
              <div class="row items-center q-gutter-sm text-caption text-grey-6">
                <q-circular-progress indeterminate size="18px" color="warning" />
                <span>Reconnecting{{ suffix ? ` to ${suffix}` : '' }}…</span>
              </div>
              <q-btn
                outline
                dense
                no-caps
                color="grey-7"
                class="full-width gt-sync-menu__action"
                label="Cancel"
                @click="onLeave"
              />
            </div>
          </template>

          <template v-else-if="phase === 'hosting'">
            <div class="column q-gutter-sm">
              <div class="row items-center no-wrap q-gutter-x-sm">
                <span class="text-caption text-grey-6">Code</span>
                <code class="gt-sync-menu__code text-body2">{{ suffix }}</code>
                <q-btn flat dense round icon="content_copy" size="sm" color="grey-6" aria-label="Copy room code" @click="copyCode" />
              </div>
              <q-btn
                outline
                dense
                no-caps
                color="grey-7"
                class="full-width gt-sync-menu__action"
                label="Stop hosting"
                @click="onLeave"
              />
            </div>
          </template>

          <template v-else-if="phase === 'guest_connected'">
            <div class="column q-gutter-sm">
              <div class="text-body2">Room <code class="gt-sync-menu__code">{{ suffix }}</code></div>
              <div class="text-caption text-positive">In sync</div>
              <q-btn
                outline
                dense
                no-caps
                color="grey-7"
                class="full-width gt-sync-menu__action"
                label="Leave room"
                @click="onLeave"
              />
            </div>
          </template>
        </div>
      </q-menu>
    </q-btn>

    <q-dialog v-model="joinOpen">
      <q-card class="gt-dialog-card gt-dialog-card--narrow">
        <q-card-section class="text-h6">Join room</q-card-section>
        <q-card-section class="q-pt-none">
          <q-input
            v-model="joinCodeInput"
            label="Room code"
            outlined
            dense
            autofocus
            maxlength="32"
            @keyup.enter="confirmJoin"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="grey" @click="joinOpen = false" />
          <q-btn unelevated label="Join" color="primary" @click="confirmJoin" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
/**
 * Multiplayer menu on the round bar, join dialog, and persisted-session resume on mount.
 */

import { computed, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useGameTimerP2P } from '../composables/useGameTimerP2P.js'
import { normalizeRoomSuffixInput } from '../p2p/roomId.js'

const $q = useQuasar()
const menuRef = ref(/** @type {{ hide?: () => void } | null} */ (null))
const { phase, suffix, startAsHost, joinRoom, leaveSession, resumeP2PSessionIfNeeded } =
  useGameTimerP2P()

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
    case 'guest_connected':
      return 'positive'
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
      return `Multiplayer: synced, room ${suffix.value ?? ''}`
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
      return 'You are the host. Others can join with this code.'
    case 'guest_connected':
      return 'Following the host’s timer state.'
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
  hideMenu()
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
      $q.notify({ type: 'positive', message: 'Room code copied', timeout: 1500, position: 'bottom' })
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
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
}

.gt-sync-control__glyph :deep(.q-icon) {
  font-size: 26px;
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
  min-width: 260px;
  max-width: min(320px, 100vw - 24px);
}

.gt-sync-menu-shell .gt-sync-menu__action {
  margin-top: 2px;
}
</style>
