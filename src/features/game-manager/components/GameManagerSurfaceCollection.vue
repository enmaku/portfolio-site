<template>
  <div data-testid="gm-surface-collection" class="gm-surface column q-pa-md q-gutter-md">
    <div class="row q-gutter-sm items-center">
      <q-input
        v-model="query"
        dense
        outlined
        class="col"
        data-testid="gm-collection-search-input"
      />
      <q-btn
        color="primary"
        unelevated
        dense
        data-testid="gm-collection-search-btn"
        :loading="searchPending"
        @click="onSearch"
      >
        Search
      </q-btn>
    </div>

    <div class="text-caption text-grey-6" data-testid="gm-collection-attribution">
      {{ attribution }}
    </div>

    <q-list v-if="searchResults.length" bordered separator data-testid="gm-collection-search-results">
      <q-item
        v-for="hit in searchResults"
        :key="hit.catalogEntryId"
        clickable
        v-ripple
        :data-testid="`gm-collection-hit-${hit.catalogEntryId}`"
        @click="addCatalogResult(hit)"
      >
        <q-item-section>
          <q-item-label>{{ hit.title }}</q-item-label>
          <q-item-label caption>{{ hit.yearPublished || '' }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>

    <div class="row q-gutter-sm items-center">
      <q-input
        v-model="customTitle"
        dense
        outlined
        class="col"
        data-testid="gm-collection-custom-input"
      />
      <q-btn
        outline
        dense
        color="primary"
        data-testid="gm-collection-custom-btn"
        :disable="!customTitle.trim()"
        @click="onAddCustom"
      >
        Custom
      </q-btn>
    </div>

    <q-list bordered separator data-testid="gm-collection-list">
      <q-item v-for="item in items" :key="item.id" :data-testid="`gm-collection-row-${item.id}`">
        <q-item-section>
          <q-item-label>{{ item.title }}</q-item-label>
          <q-item-label caption>{{ item.kind }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn
            flat
            dense
            round
            icon="delete"
            color="negative"
            :data-testid="`gm-collection-delete-${item.id}`"
            @click="removeItem(item.id)"
          />
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useGameManagerCollection } from '../composables/useGameManagerCollection.js'

const {
  items,
  searchResults,
  searchPending,
  attribution,
  searchCatalog,
  addCatalogResult,
  addCustom,
  removeItem,
} = useGameManagerCollection()

const query = ref('')
const customTitle = ref('')

async function onSearch() {
  await searchCatalog(query.value)
}

async function onAddCustom() {
  await addCustom(customTitle.value)
  customTitle.value = ''
}
</script>

<style scoped>
.gm-surface {
  min-height: 100%;
}
</style>
