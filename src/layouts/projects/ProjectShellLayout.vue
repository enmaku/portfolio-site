<script setup>
import { useTrapBrowserBack } from '../../composables/useTrapBrowserBack.js'

useTrapBrowserBack()
</script>

<template>
  <!-- No app bar: mobile-style full-height shell (see Quasar `view` — `l` = no header band). -->
  <q-layout view="lHh Lpr fFf" class="project-shell">
    <q-page-container class="project-shell__page-container">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.project-shell {
  min-height: 100vh;
}

.project-shell__page-container {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.project-shell__page-container > * {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
