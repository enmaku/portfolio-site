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
              Tap a <strong>name</strong> to start that player’s turn; tap the <strong>same name</strong> again to stop
              the clock.
            </li>
            <li class="q-mb-sm">
              <strong>End turn</strong> appears in the bottom bar when a turn is running; it banks the current player and
              moves to the <strong>next in the list</strong> (top → bottom, then wraps).
            </li>
            <li class="q-mb-sm">
              <strong>Swipe left</strong> on a row for <strong>Delete</strong> (with confirmation);
              <strong>swipe right</strong> for <strong>Edit</strong>.
            </li>
            <li class="q-mb-sm">
              <strong>Hold</strong> a row, then <strong>drag</strong> to reorder. <strong>End turn</strong> follows the new
              order.
            </li>
            <li>
              <strong>+</strong> and the small <strong>outlined</strong> button live in the same bottom row; the outline
              button clears everyone after you confirm.
            </li>
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
