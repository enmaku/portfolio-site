<template>
  <div class="mv-top-bar row items-center no-wrap full-width q-px-sm q-pt-sm q-pb-xs">
    <MovieVoteSyncControl />
    <div class="col text-center text-subtitle1 text-weight-medium ellipsis q-px-xs">Movie Vote</div>
    <div class="mv-top-bar__end row items-center justify-end no-wrap">
      <q-btn
        flat
        round
        size="md"
        color="grey-5"
        class="mv-top-bar__help"
        aria-label="Help and about"
        @click="helpOpen = true"
      >
        <span class="mv-top-bar__help-glyph">
          <q-icon name="help_outline" />
        </span>
      </q-btn>
    </div>
    <MovieVoteHelpDialog v-model="helpOpen" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import MovieVoteHelpDialog from './MovieVoteHelpDialog.vue'
import MovieVoteSyncControl from './MovieVoteSyncControl.vue'

const helpOpen = ref(false)
</script>

<style scoped>
.mv-top-bar {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.body--light .mv-top-bar {
  border-bottom-color: rgba(0, 0, 0, 0.08);
}

.mv-top-bar__end {
  flex: 0 0 48px;
  width: 48px;
}

.mv-top-bar__help-glyph {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
}

.mv-top-bar__help-glyph :deep(.q-icon) {
  font-size: 28px;
}
</style>
