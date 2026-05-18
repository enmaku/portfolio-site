<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { Notify, useQuasar } from 'quasar'
import { useTrapBrowserBack } from '../../composables/useTrapBrowserBack.js'
import { getDesktopPhoneFrameLayout } from './desktopPhoneFrame.js'
import {
  PROJECT_SHELL_DESKTOP_FRAME_BODY_CLASS,
  PROJECT_SHELL_FRAME_GUTTER_BG_CLASS,
  PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID,
  PROJECT_SHELL_FRAME_PORTAL_LAYER_CLASS,
  resolveProjectShellFrameColumnInlineStyle,
  resolveProjectShellFrameGutterInlineStyle,
  resolveProjectShellOverlayPortalMount,
} from './projectShellFrame.js'
import {
  resetProjectShellOverlayPortalTarget,
  syncProjectShellOverlayPortalTarget,
} from './projectShellOverlayPortal.js'
import {
  syncProjectShellLayoutNotifyFrame,
  teardownProjectShellLayoutNotifyFrame,
} from './projectShellLayoutNotify.js'

useTrapBrowserBack()

const $q = useQuasar()

const frameLayout = computed(() =>
  getDesktopPhoneFrameLayout({
    viewportWidthPx: $q.screen.width,
    viewportHeightPx: $q.screen.height,
  }),
)

const desktopFrameActive = computed(() => frameLayout.value.active)

const framePortalRef = ref(null)

const frameGutterStyle = computed(() =>
  resolveProjectShellFrameGutterInlineStyle(frameLayout.value),
)

const frameColumnStyle = computed(() =>
  resolveProjectShellFrameColumnInlineStyle(frameLayout.value),
)

function syncDesktopFrameChrome(active) {
  if (typeof document === 'undefined') return

  document.body.classList.toggle(PROJECT_SHELL_DESKTOP_FRAME_BODY_CLASS, active)
  syncProjectShellOverlayPortalTarget(active)

  const notifyReady = syncProjectShellLayoutNotifyFrame({
    notifyApi: Notify,
    frameActive: active,
  })

  return (
    !active ||
    (resolveProjectShellOverlayPortalMount(true) != null && notifyReady)
  )
}

watch(
  [desktopFrameActive, framePortalRef],
  ([active]) => {
    nextTick(() => {
      if (syncDesktopFrameChrome(active)) return
      nextTick(() => {
        syncDesktopFrameChrome(active)
      })
    })
  },
  { immediate: true },
)

onUnmounted(() => {
  if (typeof document === 'undefined') return
  document.body.classList.remove(PROJECT_SHELL_DESKTOP_FRAME_BODY_CLASS)
  resetProjectShellOverlayPortalTarget()
  teardownProjectShellLayoutNotifyFrame({ notifyApi: Notify })
})
</script>

<template>
  <!-- No app bar: mobile-style full-height shell (see Quasar `view` — `l` = no header band). -->
  <q-layout
    view="lHh Lpr fFf"
    class="project-shell"
    :class="{ [PROJECT_SHELL_DESKTOP_FRAME_BODY_CLASS]: desktopFrameActive }"
  >
    <q-page-container class="project-shell__page-container">
      <div
        class="project-shell__frame-root"
        :class="{
          [`project-shell__frame-gutter ${PROJECT_SHELL_FRAME_GUTTER_BG_CLASS}`]:
            desktopFrameActive,
        }"
        :style="frameGutterStyle"
      >
        <div
          class="project-shell__frame-inner"
          :class="{ 'project-shell__frame-column': desktopFrameActive }"
          :style="frameColumnStyle"
        >
          <router-view />
          <div
            v-if="desktopFrameActive"
            :id="PROJECT_SHELL_FRAME_PORTAL_ELEMENT_ID"
            ref="framePortalRef"
            :class="PROJECT_SHELL_FRAME_PORTAL_LAYER_CLASS"
          />
        </div>
      </div>
    </q-page-container>
  </q-layout>
</template>

<style scoped lang="scss">
.project-shell {
  min-height: 100vh;
}

.project-shell.project-shell--desktop-frame {
  background-color: $dark-page;
}

.project-shell__page-container {
  min-height: 100vh;
  min-height: 100dvh;
}

.project-shell__frame-root {
  min-height: 100vh;
  min-height: 100dvh;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.project-shell__frame-gutter {
  flex: 1 1 auto;
  width: 100%;
  background-color: $dark-page;
  align-items: center;
  justify-content: center;
}

.project-shell__frame-inner {
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.project-shell__frame-root.project-shell__frame-gutter .project-shell__frame-inner {
  flex: 0 0 auto;
}

.project-shell__frame-column {
  flex: 0 0 auto;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: var(--project-shell-frame-column-radius);
  border-width: var(--project-shell-frame-column-edge-border-width);
  border-style: solid;
  border-color: var(--project-shell-frame-column-edge-border-color);
  box-shadow: var(--project-shell-frame-column-surface-box-shadow);
  overflow: hidden;
}

.project-shell.project-shell--desktop-frame .project-shell__frame-inner > :not(.project-shell__frame-portal) {
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.project-shell__frame-inner > :not(.project-shell__frame-portal) {
  flex: 1 1 auto;
  width: 100%;
  min-height: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.project-shell__frame-portal {
  position: absolute;
  inset: 0;
  z-index: 6000;
  pointer-events: none;
  overflow: visible;

  :deep(#q-notify) {
    pointer-events: none;
  }

  :deep(#q-notify .q-notification),
  :deep(.q-menu),
  :deep(.q-dialog),
  :deep(.q-dialog__backdrop) {
    pointer-events: auto;
  }
}
</style>
