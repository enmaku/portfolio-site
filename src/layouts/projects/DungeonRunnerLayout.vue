<script setup>
import { useTrapBrowserBack } from '../../composables/useTrapBrowserBack.js'

useTrapBrowserBack()
</script>

<template>
  <q-layout view="lHh Lpr fFf" class="dr-layout">
    <q-page-container class="dr-layout__page-container">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.dr-layout {
  min-height: 100vh;
}

.dr-layout__page-container {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dr-layout__page-container > * {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
