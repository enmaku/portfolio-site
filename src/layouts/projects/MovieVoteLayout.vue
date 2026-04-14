<template>
  <q-layout view="lHh Lpr fFf" class="mv-layout">
    <q-page-container class="mv-layout__page-container">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.mv-layout {
  min-height: 100vh;
}

.mv-layout__page-container {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mv-layout__page-container > * {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
