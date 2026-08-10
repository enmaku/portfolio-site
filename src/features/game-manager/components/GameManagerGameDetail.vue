<template>
  <q-card class="column no-wrap full-width gm-flow-panel" data-testid="gm-game-detail">
    <q-card-section class="row items-center no-wrap q-pb-sm gm-flow-panel__header">
      <div class="text-h6 col ellipsis">{{ displayTitle }}</div>
      <q-btn
        flat
        dense
        round
        icon="close"
        aria-label="Close"
        data-testid="gm-game-detail-close"
        @click="$emit('close')"
      />
    </q-card-section>

    <q-card-section class="col q-pt-none gm-flow-panel__scroll">
      <div class="column items-center q-gutter-md q-mb-md">
        <q-img
          v-if="displayArt"
          :src="displayArt"
          width="160px"
          height="160px"
          fit="contain"
          spinner-color="primary"
          data-testid="gm-game-detail-art"
        />
        <q-icon v-else name="casino" size="64px" color="grey-5" />
      </div>

      <div class="text-body2 text-grey-6 q-mb-md" data-testid="gm-game-detail-meta">
        <template v-if="display.yearPublished">{{ display.yearPublished }}</template>
        <template v-if="playerRange">
          <span v-if="display.yearPublished"> · </span>{{ playerRange }}
        </template>
        <template v-if="timeLabel">
          <span v-if="display.yearPublished || playerRange"> · </span>{{ timeLabel }}
        </template>
        <template v-if="item?.kind === 'custom' && !display.yearPublished">Custom</template>
      </div>

      <div v-if="statsLine" class="text-body2 q-mb-md" data-testid="gm-game-detail-stats">
        {{ statsLine }}
      </div>

      <div
        v-if="enrichLoading"
        class="row items-center q-gutter-sm q-mb-md text-grey-6"
        data-testid="gm-game-detail-enrich-loading"
      >
        <q-spinner size="20px" color="primary" />
        <span class="text-body2">Loading catalog details…</span>
      </div>

      <div
        v-else-if="enrichError"
        class="column q-gutter-sm q-mb-md"
        data-testid="gm-game-detail-enrich-error"
      >
        <div class="text-body2 text-negative">Could not refresh catalog details.</div>
        <q-btn
          outline
          dense
          color="primary"
          label="Retry"
          data-testid="gm-game-detail-enrich-retry"
          @click="loadEnrich"
        />
      </div>

      <div
        v-if="display.description"
        class="text-body2 q-mb-md gm-flow-panel__description"
        data-testid="gm-game-detail-description"
      >
        {{ display.description }}
      </div>

      <div
        v-if="item?.kind === 'catalog'"
        class="text-caption text-grey-6 gm-flow-panel__description"
        data-testid="gm-game-detail-attribution"
      >
        {{ attribution }}
      </div>
    </q-card-section>

    <q-card-actions class="gm-flow-panel__actions q-pa-md">
      <q-btn
        class="full-width"
        unelevated
        color="primary"
        label="Start new session"
        data-testid="gm-game-detail-start-session"
        :loading="starting"
        :disable="starting"
        @click="$emit('start-session')"
      />
    </q-card-actions>
  </q-card>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { CATALOG_ATTRIBUTION } from '../catalog/catalogAttribution.js'
import { fetchBggCatalogEntry } from '../catalog/bggCatalogClient.js'
import { normalizeDescriptionText } from '../catalog/normalizeBgg.js'
import { collectionItemThumbUrl } from '../collection/collectionViewModel.js'

const props = defineProps({
  item: { type: Object, default: null },
  starting: { type: Boolean, default: false },
})

defineEmits(['close', 'start-session'])

const attribution = CATALOG_ATTRIBUTION
const enrich = ref(null)
const enrichLoading = ref(false)
const enrichError = ref(false)
let enrichSeq = 0

const display = computed(() => {
  const shelf = props.item || {}
  const e = enrich.value || {}
  return {
    title: e.title || shelf.title || '',
    yearPublished: e.yearPublished ?? shelf.yearPublished ?? null,
    minPlayers: e.minPlayers ?? shelf.minPlayers ?? null,
    maxPlayers: e.maxPlayers ?? shelf.maxPlayers ?? null,
    playingTime: e.playingTime ?? shelf.playingTime ?? null,
    minPlayTime: e.minPlayTime ?? null,
    maxPlayTime: e.maxPlayTime ?? null,
    thumbnailUrl: e.thumbnailUrl || shelf.thumbnailUrl || null,
    imageUrl: e.imageUrl || shelf.imageUrl || null,
    description: normalizeDescriptionText(e.description) || null,
    averageRating: e.averageRating ?? null,
    boardGameRank: e.boardGameRank ?? null,
    usersRated: e.usersRated ?? null,
  }
})

const displayTitle = computed(() => display.value.title || 'Game')
const displayArt = computed(
  () => display.value.imageUrl || display.value.thumbnailUrl || collectionItemThumbUrl(props.item),
)

const playerRange = computed(() => {
  const { minPlayers, maxPlayers } = display.value
  if (minPlayers == null && maxPlayers == null) return ''
  return `${minPlayers ?? '?'}\u2013${maxPlayers ?? '?'} players`
})

const timeLabel = computed(() => {
  const { playingTime, minPlayTime, maxPlayTime } = display.value
  if (minPlayTime != null && maxPlayTime != null && minPlayTime !== maxPlayTime) {
    return `${minPlayTime}\u2013${maxPlayTime} min`
  }
  if (playingTime != null) return `${playingTime} min`
  if (minPlayTime != null) return `${minPlayTime} min`
  return ''
})

const statsLine = computed(() => {
  const parts = []
  if (display.value.averageRating != null) {
    parts.push(`Rating ${Number(display.value.averageRating).toFixed(1)}`)
  }
  if (display.value.boardGameRank != null) {
    parts.push(`Rank #${display.value.boardGameRank}`)
  }
  if (display.value.usersRated != null) {
    parts.push(`${display.value.usersRated} ratings`)
  }
  return parts.join(' · ')
})

async function loadEnrich() {
  const item = props.item
  if (!item || item.kind !== 'catalog' || !item.catalogEntryId) {
    enrich.value = null
    enrichLoading.value = false
    enrichError.value = false
    return
  }
  const seq = ++enrichSeq
  enrichLoading.value = true
  enrichError.value = false
  try {
    const result = await fetchBggCatalogEntry(item.catalogEntryId)
    if (seq !== enrichSeq) return
    if (!result.ok || !result.entry) {
      enrichError.value = true
      return
    }
    enrich.value = result.entry
  } catch {
    if (seq !== enrichSeq) return
    enrichError.value = true
  } finally {
    if (seq === enrichSeq) enrichLoading.value = false
  }
}

watch(
  () => [props.item?.id, props.item?.catalogEntryId],
  () => {
    enrich.value = null
    void loadEnrich()
  },
  { immediate: true },
)
</script>
