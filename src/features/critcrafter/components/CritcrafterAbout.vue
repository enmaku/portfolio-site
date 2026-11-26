<script setup>
/** "About and rules text licence" link plus dialog; shown on the landing and loaded viewer. */
import { ref } from 'vue'
import { ASSUMPTIONS, LICENCE_SECTIONS } from '../about/aboutContent.js'

const open = ref(false)
</script>

<template>
  <div class="text-center q-pt-md">
    <q-btn flat dense no-caps size="sm" label="About and rules text licence" data-testid="cc-about-open" @click="open = true" />
    <q-dialog v-model="open">
      <q-card dark class="cc-about" data-testid="cc-about">
        <q-card-section>
          <div class="text-h6">About CritCrafter</div>
          <div class="text-subtitle2 q-mt-md">Rules assumptions</div>
          <ul class="q-pl-md q-my-sm">
            <li v-for="a in ASSUMPTIONS" :key="a" class="text-body2">{{ a }}</li>
          </ul>
          <div class="text-subtitle2 q-mt-md" data-testid="cc-licence-title">Rules text licence</div>
          <div v-for="s in LICENCE_SECTIONS" :key="s.title" class="q-mt-sm">
            <div class="text-weight-medium">{{ s.title }}</div>
            <div class="text-body2">{{ s.body }}</div>
          </div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn v-close-popup flat label="Close" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
.cc-about {
  max-width: 480px;
  max-height: 85vh;
  overflow: auto;
}
</style>
