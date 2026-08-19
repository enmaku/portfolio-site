<template>
  <q-page class="tt-page column fit no-wrap" data-testid="tt-page">
    <div v-if="loading || workspaceLoading" class="col flex flex-center" data-testid="tt-page-loading">
      <q-circular-progress indeterminate size="32px" color="primary" />
    </div>

    <div v-else-if="!isAccountOwner" class="col flex flex-center q-pa-md">
      <TimeTrackerSignInPanel class="full-width" />
    </div>

    <template v-else>
      <div class="row items-center no-wrap q-px-md q-pt-md q-pb-sm">
        <div class="text-h6 text-weight-medium col">Time Tracker</div>
        <q-btn
          flat
          dense
          round
          icon="settings"
          color="grey-5"
          data-testid="tt-settings-cog"
        >
          <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
            <div class="q-pa-md" style="min-width: 260px">
              <q-toggle
                v-if="fullscreenChromeExposed"
                v-model="fullscreenModel"
                color="primary"
                label="Fullscreen"
                data-testid="tt-fullscreen-toggle"
              />
              <q-input
                :model-value="issuerNameDraft"
                outlined
                dense
                class="q-mt-sm"
                label="Issuer name"
                data-testid="tt-issuer-name"
                @update:model-value="onIssuerNameInput"
              />
              <div class="row items-center no-wrap q-gutter-sm q-mt-md">
                <div
                  class="tt-color-swatch"
                  :style="{ backgroundColor: timerColor }"
                  data-testid="tt-timer-color-swatch"
                />
                <q-btn
                  outline
                  dense
                  no-caps
                  label="Choose color"
                  data-testid="tt-timer-color-btn"
                  @click="colorDialogOpen = true"
                />
              </div>
            </div>
          </q-menu>
        </q-btn>
        <q-btn
          flat
          dense
          round
          icon="logout"
          color="grey-5"
          data-testid="tt-sign-out-btn"
          :loading="signOutPending"
          @click="signOutConfirmOpen = true"
        />
      </div>

      <div class="col tt-page__panels">
        <TimeTrackerSurfaceTimer v-if="workspace.state.activeSurface === 'timer'" />
        <TimeTrackerSurfaceHistory v-else-if="workspace.state.activeSurface === 'history'" />
        <TimeTrackerSurfaceProjects v-else-if="workspace.state.activeSurface === 'projects'" />
        <TimeTrackerSurfaceClients v-else-if="workspace.state.activeSurface === 'clients'" />
      </div>

      <nav class="tt-nav" data-testid="tt-tracker-nav">
        <q-btn
          v-for="item in TRACKER_SURFACES"
          :key="item.id"
          flat
          no-caps
          class="tt-nav__item"
          :class="{ 'tt-nav__item--active': workspace.state.activeSurface === item.id }"
          :data-testid="`tt-nav-${item.id}`"
          @click="workspace.setActiveSurface(item.id)"
        >
          <q-icon :name="item.icon" class="tt-nav__icon" />
          <span class="tt-nav__label">{{ item.label }}</span>
        </q-btn>
      </nav>

      <q-dialog v-model="colorDialogOpen" persistent>
        <q-card class="tt-dialog-card">
          <q-card-section class="text-h6">Timer color</q-card-section>
          <q-card-section>
            <q-color
              v-model="timerColorModel"
              default-view="palette"
              format-model="hex"
              class="full-width"
              data-testid="tt-timer-color-picker"
            />
          </q-card-section>
          <q-card-actions align="right">
            <q-btn unelevated no-caps color="primary" label="Done" @click="colorDialogOpen = false" />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <q-dialog v-model="signOutConfirmOpen" persistent>
        <q-card class="tt-dialog-card">
          <q-card-section>Sign out of Time Tracker on this device?</q-card-section>
          <q-card-actions align="right">
            <q-btn
              flat
              no-caps
              color="grey"
              label="Cancel"
              data-testid="tt-sign-out-cancel"
              @click="signOutConfirmOpen = false"
            />
            <q-btn
              unelevated
              no-caps
              color="primary"
              label="Sign out"
              data-testid="tt-sign-out-confirm"
              :loading="signOutPending"
              @click="confirmSignOut"
            />
          </q-card-actions>
        </q-card>
      </q-dialog>
    </template>
  </q-page>
</template>

<script setup>
import { computed, provide, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useQuasar } from 'quasar'
import { useNoSleep } from '../../composables/keepDisplayOn/useNoSleep.js'
import { useProjectShellBrowserFullscreen } from '../../layouts/projects/composables/useProjectShellBrowserFullscreen.js'
import { useProjectShellBrowserFullscreenChrome } from '../../layouts/projects/projectShellFullscreenChrome.js'
import { useTimeTrackerSettingsStore } from '../../stores/timeTrackerSettings.js'
import TimeTrackerSignInPanel from '../../features/time-tracker/components/TimeTrackerSignInPanel.vue'
import TimeTrackerSurfaceClients from '../../features/time-tracker/components/TimeTrackerSurfaceClients.vue'
import TimeTrackerSurfaceHistory from '../../features/time-tracker/components/TimeTrackerSurfaceHistory.vue'
import TimeTrackerSurfaceProjects from '../../features/time-tracker/components/TimeTrackerSurfaceProjects.vue'
import TimeTrackerSurfaceTimer from '../../features/time-tracker/components/TimeTrackerSurfaceTimer.vue'
import { useTimeTrackerAuth } from '../../features/time-tracker/composables/useTimeTrackerAuth.js'
import {
  TIME_TRACKER_WORKSPACE_KEY,
  TRACKER_SURFACES,
} from '../../features/time-tracker/composables/trackerSurfaces.js'
import { useTimeTrackerWorkspace } from '../../features/time-tracker/composables/useTimeTrackerWorkspace.js'

const $q = useQuasar()
const { isAccountOwner, loading, user, signOut } = useTimeTrackerAuth()
const workspace = useTimeTrackerWorkspace()
const workspaceLoading = ref(false)
const signOutPending = ref(false)
const signOutConfirmOpen = ref(false)
const colorDialogOpen = ref(false)
const issuerNameDraft = ref('')
const settingsStore = useTimeTrackerSettingsStore()
const { fullscreenEnabled, timerColor } = storeToRefs(settingsStore)
const fullscreenChromeExposed = useProjectShellBrowserFullscreenChrome()

provide(TIME_TRACKER_WORKSPACE_KEY, workspace)

const fullscreenModel = computed({
  get: () => fullscreenEnabled.value,
  set: (next) => settingsStore.setFullscreenEnabled(next),
})

const timerColorModel = computed({
  get: () => timerColor.value,
  set: (next) => settingsStore.setTimerColor(next, user.value?.uid),
})

useProjectShellBrowserFullscreen({
  enabled: fullscreenEnabled,
  setEnabled: (next) => settingsStore.setFullscreenEnabled(next),
  notify: $q.notify,
})

useNoSleep(computed(() => Boolean(workspace.state.runningTimer)))

watch(
  () => [isAccountOwner.value, user.value?.uid],
  async ([owner, uid]) => {
    if (!owner || !uid) return
    workspaceLoading.value = true
    try {
      await workspace.load(uid, user.value)
      settingsStore.applyOwner(uid)
      issuerNameDraft.value = workspace.state.settings.issuerName
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: err instanceof Error ? err.message : 'Could not load Time Tracker',
      })
    } finally {
      workspaceLoading.value = false
    }
  },
  { immediate: true },
)

async function onIssuerNameInput(value) {
  issuerNameDraft.value = value
  try {
    await workspace.setIssuerName(value)
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err instanceof Error ? err.message : 'Could not save issuer name',
    })
  }
}

async function confirmSignOut() {
  signOutPending.value = true
  try {
    await workspace.signOutPause()
    await signOut()
    signOutConfirmOpen.value = false
  } finally {
    signOutPending.value = false
  }
}
</script>

<style scoped lang="scss">
.tt-page {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.tt-page__panels {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  position: relative;

  :deep(.tt-surface) {
    height: 100%;
  }
}
</style>
