<script setup>
import { useTrapBrowserBack } from '../../composables/useTrapBrowserBack.js'

useTrapBrowserBack()
</script>

<template>
  <!-- No app bar: mobile-style full-height shell (see Quasar `view` — `l` = no header band). -->
  <q-layout view="lHh Lpr fFf" class="gt-game-timer-layout">
    <q-page-container class="gt-game-timer-layout__page-container">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.gt-game-timer-layout {
  min-height: 100vh;
}

.gt-game-timer-layout__page-container {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.gt-game-timer-layout__page-container > * {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
