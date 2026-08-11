<template>
  <div class="column mv-quorum-controls" data-testid="mv-quorum-controls">
    <div class="row items-center no-wrap">
      <div class="text-subtitle2 col">Quorum</div>
      <q-btn
        flat
        round
        dense
        icon="help_outline"
        color="grey-6"
        size="sm"
        data-testid="mv-quorum-help"
        aria-label="About quorum controls"
        @click.stop="helpOpen = true"
      />
    </div>
    <q-list bordered class="rounded-borders mv-quorum-controls__list">
      <q-item
        v-for="row in rows"
        :key="row.id"
        dense
        data-testid="mv-quorum-row"
        :data-progress-key="row.progress?.key"
      >
        <q-item-section avatar>
          <q-icon
            v-if="row.progress"
            :name="progressIcon(row.progress.key)"
            :color="progressColor(row.progress.key)"
            size="sm"
            data-testid="mv-progress-status"
          />
        </q-item-section>
        <q-item-section>
          <q-item-label class="ellipsis">{{ row.name || '—' }}</q-item-label>
        </q-item-section>
        <q-item-section v-if="editable" side class="mv-quorum-controls__side">
          <div class="row items-center no-wrap q-gutter-x-xs">
            <div class="mv-quorum-controls__remove-slot">
              <q-btn
                v-if="!row.isHost"
                flat
                round
                dense
                icon="delete"
                color="negative"
                size="md"
                data-testid="mv-quorum-remove"
                aria-label="Remove participant"
                @click.stop="confirmRemove(row)"
              >
                <q-tooltip>Remove from room</q-tooltip>
              </q-btn>
            </div>
            <q-toggle
              dense
              :model-value="row.quorumRequired"
              data-testid="mv-quorum-toggle"
              @update:model-value="(v) => emit('toggle-quorum', row.id, v)"
            />
          </div>
        </q-item-section>
      </q-item>
    </q-list>
    <q-btn
      v-if="editable"
      outline
      no-caps
      color="grey-7"
      class="full-width mv-quorum-controls__action-btn"
      padding="12px 16px"
      label="Clear guests"
      data-testid="mv-clear-guests"
      :disable="!hasGuests"
      @click="confirmClearGuests"
    />
    <MovieVoteQuorumHelpDialog v-model="helpOpen" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { HOST_PARTICIPANT_ID } from '../core.js'
import MovieVoteQuorumHelpDialog from './MovieVoteQuorumHelpDialog.vue'

const props = defineProps({
  rows: { type: Array, required: true },
  editable: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle-quorum', 'remove-guest', 'clear-guests'])

const $q = useQuasar()
const helpOpen = ref(false)

const hasGuests = computed(() => props.rows.some((r) => r.id !== HOST_PARTICIPANT_ID))

/** @type {Record<string, { icon: string, color: string }>} */
const PROGRESS_CHROME = {
  watching: { icon: 'visibility', color: 'grey-5' },
  voted: { icon: 'ballot', color: 'positive' },
  not_voted: { icon: 'ballot', color: 'grey-5' },
  ready: { icon: 'how_to_vote', color: 'positive' },
  has_picks: { icon: 'movie_edit', color: 'positive' },
  no_picks: { icon: 'movie_edit', color: 'grey-5' },
}

/**
 * @param {string} key
 */
function progressIcon(key) {
  return PROGRESS_CHROME[key]?.icon ?? 'help_outline'
}

/**
 * @param {string} key
 */
function progressColor(key) {
  return PROGRESS_CHROME[key]?.color ?? 'grey-5'
}

/**
 * @param {{ id: string, name: string }} row
 */
function confirmRemove(row) {
  $q.dialog({
    title: 'Remove participant?',
    message: `Remove ${row.name || 'this guest'} from the room?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    emit('remove-guest', row.id)
  })
}

function confirmClearGuests() {
  $q.dialog({
    title: 'Clear guests?',
    message: 'Remove every guest from the room? You stay as host.',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    emit('clear-guests')
  })
}
</script>

<style scoped lang="scss">
.mv-quorum-controls {
  gap: 12px;
}

.mv-quorum-controls__side {
  flex-shrink: 0;
  padding-left: 8px !important;
}

.mv-quorum-controls__remove-slot {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.mv-quorum-controls__action-btn {
  min-height: 48px;
}
</style>
