<template>
  <q-page class="tt-page column fit no-wrap" data-testid="tt-page">
    <div v-if="loading || workspaceLoading" class="col flex flex-center" data-testid="tt-page-loading">
      <q-circular-progress indeterminate size="32px" color="primary" />
    </div>

    <div v-else-if="!isAccountOwner" class="col flex flex-center q-pa-md">
      <TimeTrackerSignInPanel class="full-width" />
    </div>

    <template v-else>
      <q-toolbar class="tt-page__header">
        <q-toolbar-title>Time Tracker</q-toolbar-title>
        <q-btn
          flat
          dense
          round
          icon="settings"
          color="grey-5"
          data-testid="tt-settings-cog"
        >
          <q-menu anchor="bottom right" self="top right" :offset="[0, 6]">
            <q-list style="min-width: 260px">
              <q-item v-if="fullscreenChromeExposed" tag="label">
                <q-item-section>
                  <q-item-label>Fullscreen</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-toggle
                    v-model="fullscreenModel"
                    color="primary"
                    data-testid="tt-fullscreen-toggle"
                  />
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section>
                  <q-input
                    :model-value="issuerNameDraft"
                    outlined
                    dense
                    label="Issuer name"
                    data-testid="tt-issuer-name"
                    @update:model-value="onIssuerNameInput"
                  />
                </q-item-section>
              </q-item>
              <q-item>
                <q-item-section avatar>
                  <q-avatar
                    square
                    size="20px"
                    :style="{ backgroundColor: timerColor }"
                    data-testid="tt-timer-color-swatch"
                  />
                </q-item-section>
                <q-item-section>
                  <q-btn
                    outline
                    dense
                    no-caps
                    label="Choose color"
                    data-testid="tt-timer-color-btn"
                    @click="colorDialogOpen = true"
                  />
                </q-item-section>
              </q-item>
            </q-list>
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
      </q-toolbar>

      <q-tab-panels v-model="activeSurface" animated class="col tt-page__panels">
        <q-tab-panel name="timer" class="q-pa-none">
          <TimeTrackerSurfaceTimer />
        </q-tab-panel>
        <q-tab-panel name="history" class="q-pa-none">
          <TimeTrackerSurfaceHistory />
        </q-tab-panel>
        <q-tab-panel name="projects" class="q-pa-none">
          <TimeTrackerSurfaceProjects />
        </q-tab-panel>
        <q-tab-panel name="clients" class="q-pa-none">
          <TimeTrackerSurfaceClients />
        </q-tab-panel>
      </q-tab-panels>

      <q-tabs
        v-model="activeSurface"
        dense
        no-caps
        align="justify"
        active-color="primary"
        indicator-color="primary"
        class="tt-nav-bar text-grey-5"
        data-testid="tt-tracker-nav"
      >
        <q-tab
          v-for="item in TRACKER_SURFACES"
          :key="item.id"
          :name="item.id"
          :icon="item.icon"
          :label="item.label"
          :data-testid="`tt-nav-${item.id}`"
        />
      </q-tabs>

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

const activeSurface = computed({
  get: () => workspace.state.activeSurface,
  set: (next) => workspace.setActiveSurface(next),
})

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

.tt-page__header {
  flex-shrink: 0;
}

.tt-page__panels {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;

  :deep(.q-tab-panel) {
    height: 100%;
    overflow: hidden;
  }
}

.tt-nav-bar {
  flex-shrink: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.body--light .tt-nav-bar {
  border-top-color: rgba(0, 0, 0, 0.08);
}
</style>
