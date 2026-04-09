<template>
  <q-layout view="hHh lpR fFf" class="gt-game-timer-layout">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title>Game Timer</q-toolbar-title>
        <q-space />
        <q-btn
          outline
          round
          color="white"
          size="sm"
          class="gt-help-btn"
          aria-label="Help"
          @click="helpOpen = true"
        >
          <span class="gt-help-icon" aria-hidden="true">?</span>
        </q-btn>
      </q-toolbar>
    </q-header>

    <q-dialog v-model="helpOpen">
      <q-card class="gt-help-card">
        <q-card-section class="text-h6">Tips</q-card-section>

        <q-card-section class="q-pt-none text-body2">
          <ul class="gt-help-list q-my-none q-pl-md">
            <li class="q-mb-sm">
              Tap a name to start or stop the clock. End turn banks time and moves to the next person in the list.
            </li>
            <li class="q-mb-sm">
              Arrows by the round number change rounds and pause the clock. Reset clears round timing only, not each
              player’s total.
            </li>
            <li class="q-mb-sm">Swipe right to edit, left to remove. Long-press and drag to reorder.</li>
            <li>+ adds someone; the small button on the left clears everyone after you confirm.</li>
          </ul>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn v-close-popup flat label="Close" color="primary" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-page-container class="gt-game-timer-layout__page-container">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref } from 'vue'

const helpOpen = ref(false)
</script>

<style scoped>
.gt-help-btn {
  flex-shrink: 0;
  opacity: 0.92;
}

.gt-help-btn:hover,
.gt-help-btn:focus-visible {
  opacity: 1;
}

.gt-help-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1;
}

.gt-help-card {
  min-width: 280px;
  max-width: min(420px, 94vw);
  border-radius: 12px;
}

.gt-help-list {
  list-style-type: disc;
}

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
