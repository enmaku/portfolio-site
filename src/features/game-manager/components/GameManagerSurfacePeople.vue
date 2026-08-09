<template>
  <div data-testid="gm-surface-people" class="gm-surface column q-pa-md q-gutter-md">
    <div class="row items-center q-gutter-sm">
      <q-input
        v-model="draftName"
        dense
        outlined
        class="col"
        data-testid="gm-people-name-input"
        @update:model-value="onTypedName"
      />
      <q-btn
        color="primary"
        unelevated
        dense
        data-testid="gm-people-add-btn"
        :disable="!draftName.trim()"
        @click="onAdd"
      >
        Add
      </q-btn>
    </div>

    <div
      v-if="error"
      class="text-negative text-caption"
      data-testid="gm-people-error"
    >
      {{ errorMessage }}
    </div>

    <q-list v-if="suggestions.length" bordered separator data-testid="gm-people-match-list">
      <q-item
        v-for="match in suggestions"
        :key="match.id"
        clickable
        v-ripple
        :data-testid="`gm-people-match-${match.id}`"
        @click="onPickMatch(match)"
      >
        <q-item-section avatar>
          <q-avatar :style="{ backgroundColor: match.color }" size="28px" />
        </q-item-section>
        <q-item-section>{{ match.name }}</q-item-section>
      </q-item>
    </q-list>

    <q-list bordered separator data-testid="gm-people-list">
      <q-item v-for="person in people" :key="person.id" :data-testid="`gm-people-row-${person.id}`">
        <q-item-section avatar>
          <q-avatar :style="{ backgroundColor: person.color }" size="32px" />
        </q-item-section>
        <q-item-section>
          <q-item-label>{{ person.name }}</q-item-label>
        </q-item-section>
        <q-item-section side>
          <q-btn
            flat
            dense
            round
            icon="delete"
            color="negative"
            :data-testid="`gm-people-delete-${person.id}`"
            @click="deletePerson(person.id)"
          />
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useGameManagerPeople } from '../composables/useGameManagerPeople.js'

const { people, error, suggestionsForName, addOrSelectPerson, deletePerson } =
  useGameManagerPeople()

const draftName = ref('')
const suggestions = ref([])

const errorMessage = computed(() => {
  if (!error.value) return ''
  return error.value.message || String(error.value)
})

function onTypedName(value) {
  suggestions.value = suggestionsForName(String(value || ''))
}

async function onAdd() {
  await addOrSelectPerson({
    name: draftName.value,
    persistToRoster: true,
  })
  draftName.value = ''
  suggestions.value = []
}

async function onPickMatch(match) {
  await addOrSelectPerson({
    name: match.name,
    existingId: match.id,
    persistToRoster: true,
  })
  draftName.value = ''
  suggestions.value = []
}
</script>

<style scoped>
.gm-surface {
  min-height: 100%;
}
</style>
